import { createHash } from 'node:crypto';

import { MODERATION_CAPABILITIES } from './moderation-principal.js';
import {
  MODERATION_RATE_LIMIT_DEPENDENCY_TIMEOUT_DEFAULT_MS,
  bindModerationRateLimitConsumerDeadline,
} from './moderation-rate-limit-deadline.js';

const ACTOR_ID_PATTERN = /^wf_[A-Za-z0-9_-]{22,60}$/u;
const POLICY_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u;
const POLICY_SCOPES = Object.freeze([
  MODERATION_CAPABILITIES.CONTENT_REMOVE,
  MODERATION_CAPABILITIES.QUEUE_READ,
  MODERATION_CAPABILITIES.REPORT_CLAIM,
  MODERATION_CAPABILITIES.REPORT_DECIDE,
].sort());
const POLICY_SCOPE_SET = new Set(POLICY_SCOPES);
const FACTORY_KEYS = new Set([
  'db',
  'dependencyTimeoutMs',
  'lockTimeoutMs',
  'policies',
  'policyVersion',
  'statementTimeoutMs',
  'transactionMaxWaitMs',
  'transactionTimeoutMs',
]);
const POLICY_KEYS = Object.freeze(['burstCapacity', 'emissionIntervalMs']);
const CONSUME_INPUT_KEYS = Object.freeze(['actorId', 'scopes']);
const CONSUME_OPTIONS_KEYS = Object.freeze(['signal']);
const RESULT_KEYS = Object.freeze([
  'allowed',
  'expectedCount',
  'inputCount',
  'policyMismatch',
  'retryAfterSeconds',
  'writtenCount',
]);
const LOCK_RESULT_KEYS = Object.freeze(['lockAcquired']);
const TIMEOUT_RESULT_KEYS = Object.freeze([
  'idleTimeoutMs',
  'lockTimeoutMs',
  'statementTimeoutMs',
]);
const EMISSION_INTERVAL_MIN_MS = 1_000;
const EMISSION_INTERVAL_MAX_MS = 3_600_000;
const BURST_CAPACITY_MAX = 100;
const MAX_DEBT_HORIZON_MS = 3_600_000;
const RETRY_AFTER_MAX_SECONDS = 3_600n;

const SET_LOCAL_TIMEOUTS_SQL = `
WITH "configured" AS MATERIALIZED (
  SELECT
    set_config('lock_timeout', $1, true),
    set_config('statement_timeout', $2, true),
    set_config('idle_in_transaction_session_timeout', $3, true)
)
SELECT
  (EXTRACT(EPOCH FROM current_setting('lock_timeout')::interval) * 1000)::integer
    AS "lockTimeoutMs",
  (EXTRACT(EPOCH FROM current_setting('statement_timeout')::interval) * 1000)::integer
    AS "statementTimeoutMs",
  (EXTRACT(EPOCH FROM current_setting('idle_in_transaction_session_timeout')::interval) * 1000)::integer
    AS "idleTimeoutMs"
FROM "configured"
`;

const LOCK_BUCKET_SQL = `
WITH "locked" AS MATERIALIZED (
  SELECT pg_advisory_xact_lock(
    hashtextextended('easygo:moderation-rate:v1:' || $1 || ':' || $2, 0)
  )
)
SELECT true AS "lockAcquired" FROM "locked"
`;

const CONSUME_BUCKETS_SQL = `
WITH "dbClock" AS MATERIALIZED (
  SELECT clock_timestamp() AS "nowAt"
), "input" AS MATERIALIZED (
  SELECT
    entry."scope",
    entry."emissionIntervalMs",
    entry."burstCapacity",
    entry."policyFingerprint"
  FROM jsonb_to_recordset($2::jsonb) AS entry(
    "scope" text,
    "emissionIntervalMs" integer,
    "burstCapacity" integer,
    "policyFingerprint" text
  )
), "base" AS MATERIALIZED (
  SELECT
    input."scope",
    input."emissionIntervalMs",
    input."burstCapacity",
    input."policyFingerprint",
    clock."nowAt",
    bucket."actorId" IS NOT NULL
      AND (
        bucket."policyVersion" IS DISTINCT FROM $3
        OR bucket."policyFingerprint" IS DISTINCT FROM input."policyFingerprint"
      ) AS "policyMismatch",
    GREATEST(
      COALESCE(bucket."theoreticalArrivalAt", clock."nowAt"),
      clock."nowAt"
    ) AS "baseTat"
  FROM "input" input
  CROSS JOIN "dbClock" clock
  LEFT JOIN "ModerationRateLimitBucket" bucket
    ON bucket."actorId" = $1
   AND bucket."scope" = input."scope"
), "decision" AS MATERIALIZED (
  SELECT
    "scope",
    "policyFingerprint",
    "nowAt",
    "policyMismatch",
    "baseTat"
      - (("burstCapacity" - 1) * "emissionIntervalMs")
        * INTERVAL '1 millisecond' AS "allowAt",
    "baseTat"
      + "emissionIntervalMs" * INTERVAL '1 millisecond' AS "nextTat"
  FROM "base"
), "summary" AS MATERIALIZED (
  SELECT
    COUNT(*)::integer AS "inputCount",
    COALESCE(BOOL_OR("policyMismatch"), false) AS "policyMismatch",
    COUNT(*) = $4::integer
      AND COALESCE(BOOL_AND(
        NOT "policyMismatch" AND "nowAt" >= "allowAt"
      ), false) AS "allowed",
    MAX(
      CEIL(EXTRACT(EPOCH FROM ("allowAt" - "nowAt")))::bigint
    ) FILTER (
      WHERE NOT "policyMismatch" AND "nowAt" < "allowAt"
    ) AS "retryAfterSeconds"
  FROM "decision"
), "written" AS (
  INSERT INTO "ModerationRateLimitBucket" (
    "actorId",
    "scope",
    "policyVersion",
    "policyFingerprint",
    "theoreticalArrivalAt",
    "updatedAt"
  )
  SELECT
    $1,
    decision."scope",
    $3,
    decision."policyFingerprint",
    decision."nextTat",
    decision."nowAt"
  FROM "decision" decision
  CROSS JOIN "summary" summary
  WHERE summary."allowed" AND NOT summary."policyMismatch"
  ON CONFLICT ("actorId", "scope") DO UPDATE
  SET
    "policyVersion" = EXCLUDED."policyVersion",
    "policyFingerprint" = EXCLUDED."policyFingerprint",
    "theoreticalArrivalAt" = EXCLUDED."theoreticalArrivalAt",
    "updatedAt" = EXCLUDED."updatedAt"
  WHERE "ModerationRateLimitBucket"."policyVersion" = EXCLUDED."policyVersion"
    AND "ModerationRateLimitBucket"."policyFingerprint"
      = EXCLUDED."policyFingerprint"
  RETURNING "scope"
)
SELECT
  summary."allowed",
  $4::integer AS "expectedCount",
  summary."inputCount",
  summary."policyMismatch",
  CASE
    WHEN summary."allowed" OR summary."policyMismatch" THEN NULL::bigint
    ELSE summary."retryAfterSeconds"
  END AS "retryAfterSeconds",
  (SELECT COUNT(*)::integer FROM "written") AS "writtenCount"
FROM "summary" summary
`;

export class ModerationRateLimitStoreUnavailableError extends Error {
  constructor() {
    super('moderation rate-limit storage is unavailable');
    this.name = 'ModerationRateLimitStoreUnavailableError';
  }
}

function unavailable() {
  throw new ModerationRateLimitStoreUnavailableError();
}

function dataDescriptors(value, allowedKeys, requiredKeys = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== 'string' || !allowedKeys.has(key))
    || keys.some((key) => !Object.hasOwn(descriptors[key], 'value'))
    || requiredKeys.some((key) => !Object.hasOwn(descriptors, key))
  ) {
    return null;
  }
  return descriptors;
}

function exactDataDescriptors(value, expectedKeys) {
  const allowed = new Set(expectedKeys);
  const descriptors = dataDescriptors(value, allowed, expectedKeys);
  if (!descriptors) return null;
  const keys = Reflect.ownKeys(descriptors).sort();
  return keys.length === expectedKeys.length
    && keys.every((key, index) => key === [...expectedKeys].sort()[index])
    ? descriptors
    : null;
}

function arrayDataValues(value, maxLength) {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxLength) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  const expected = [
    ...Array.from({ length: value.length }, (_, index) => String(index)),
    'length',
  ];
  if (
    keys.some((key) => typeof key !== 'string')
    || keys.length !== expected.length
    || expected.some((key) => !Object.hasOwn(descriptors, key))
    || expected.some((key) => !Object.hasOwn(descriptors[key], 'value'))
    || descriptors.length.value !== value.length
  ) {
    return null;
  }
  return expected.slice(0, -1).map((key) => descriptors[key].value);
}

function normalizePositiveInteger(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) return null;
  return value;
}

function normalizePolicies(value, policyVersion) {
  const descriptors = exactDataDescriptors(value, POLICY_SCOPES);
  if (!descriptors) throw new TypeError('moderation rate-limit policies are invalid');
  const policies = Object.create(null);
  for (const scope of POLICY_SCOPES) {
    const policyDescriptors = exactDataDescriptors(
      descriptors[scope].value,
      POLICY_KEYS,
    );
    if (!policyDescriptors) throw new TypeError('moderation rate-limit policy is invalid');
    const burstCapacity = normalizePositiveInteger(
      policyDescriptors.burstCapacity.value,
      1,
      BURST_CAPACITY_MAX,
    );
    const emissionIntervalMs = normalizePositiveInteger(
      policyDescriptors.emissionIntervalMs.value,
      EMISSION_INTERVAL_MIN_MS,
      EMISSION_INTERVAL_MAX_MS,
    );
    if (
      !burstCapacity
      || !emissionIntervalMs
      || emissionIntervalMs * burstCapacity > MAX_DEBT_HORIZON_MS
    ) {
      throw new TypeError('moderation rate-limit policy is invalid');
    }
    const policyFingerprint = createHash('sha256').update(JSON.stringify({
      algorithm: 'gcra-v1',
      burstCapacity,
      emissionIntervalMs,
      policyVersion,
      scope,
    })).digest('hex');
    policies[scope] = Object.freeze({
      burstCapacity,
      emissionIntervalMs,
      policyFingerprint,
    });
  }
  return Object.freeze(policies);
}

function normalizeScopes(value) {
  const scopes = arrayDataValues(value, POLICY_SCOPES.length);
  if (
    !scopes
    || scopes.some((scope) => typeof scope !== 'string' || !POLICY_SCOPE_SET.has(scope))
    || new Set(scopes).size !== scopes.length
  ) {
    unavailable();
  }
  return Object.freeze([...scopes].sort());
}

function normalizeConsumeArguments(input, options) {
  const inputDescriptors = exactDataDescriptors(input, CONSUME_INPUT_KEYS);
  const optionDescriptors = exactDataDescriptors(options, CONSUME_OPTIONS_KEYS);
  if (!inputDescriptors || !optionDescriptors) unavailable();
  const actorId = inputDescriptors.actorId.value;
  const signal = optionDescriptors.signal.value;
  if (
    typeof actorId !== 'string'
    || !ACTOR_ID_PATTERN.test(actorId)
    || !(signal instanceof AbortSignal)
  ) {
    unavailable();
  }
  if (signal.aborted) unavailable();
  return Object.freeze({ actorId, scopes: normalizeScopes(inputDescriptors.scopes.value), signal });
}

function strictRow(value, expectedKeys) {
  const descriptors = exactDataDescriptors(value, expectedKeys);
  if (!descriptors) unavailable();
  return descriptors;
}

function validateTimeoutResult(value, expected) {
  if (!Array.isArray(value) || value.length !== 1) unavailable();
  const row = strictRow(value[0], TIMEOUT_RESULT_KEYS);
  if (
    row.lockTimeoutMs.value !== expected.lockTimeoutMs
    || row.statementTimeoutMs.value !== expected.statementTimeoutMs
    || row.idleTimeoutMs.value !== expected.idleTimeoutMs
  ) {
    unavailable();
  }
}

function validateLockResult(value) {
  if (!Array.isArray(value) || value.length !== 1) unavailable();
  const row = strictRow(value[0], LOCK_RESULT_KEYS);
  if (row.lockAcquired.value !== true) unavailable();
}

function normalizeResult(value, expectedCount) {
  if (!Array.isArray(value) || value.length !== 1) unavailable();
  const row = strictRow(value[0], RESULT_KEYS);
  const allowed = row.allowed.value;
  const inputCount = row.inputCount.value;
  const outputExpectedCount = row.expectedCount.value;
  const policyMismatch = row.policyMismatch.value;
  const retryAfterSeconds = row.retryAfterSeconds.value;
  const writtenCount = row.writtenCount.value;
  if (
    typeof allowed !== 'boolean'
    || typeof policyMismatch !== 'boolean'
    || !Number.isSafeInteger(inputCount)
    || !Number.isSafeInteger(outputExpectedCount)
    || !Number.isSafeInteger(writtenCount)
    || inputCount !== expectedCount
    || outputExpectedCount !== expectedCount
  ) {
    unavailable();
  }
  if (policyMismatch) unavailable();
  if (allowed) {
    if (retryAfterSeconds !== null || writtenCount !== expectedCount) unavailable();
    return Object.freeze({ allowed: true });
  }
  if (
    writtenCount !== 0
    || typeof retryAfterSeconds !== 'bigint'
    || retryAfterSeconds < 1n
    || retryAfterSeconds > RETRY_AFTER_MAX_SECONDS
  ) {
    unavailable();
  }
  return Object.freeze({
    allowed: false,
    retryAfterSeconds: Number(retryAfterSeconds),
  });
}

function throwIfAborted(signal) {
  if (signal.aborted) unavailable();
}

function validateTransactionClient(tx) {
  if (!tx || typeof tx.$queryRawUnsafe !== 'function') unavailable();
}

export function createPostgresModerationRateLimitConsumer(options = {}) {
  const descriptors = dataDescriptors(options, FACTORY_KEYS, [
    'db',
    'policies',
    'policyVersion',
  ]);
  if (!descriptors) throw new TypeError('moderation rate-limit store options are invalid');

  const db = descriptors.db.value;
  const policyVersion = descriptors.policyVersion.value;
  if (
    !db
    || typeof db.$transaction !== 'function'
    || typeof policyVersion !== 'string'
    || !POLICY_VERSION_PATTERN.test(policyVersion)
  ) {
    throw new TypeError('moderation rate-limit store options are invalid');
  }
  const policies = normalizePolicies(descriptors.policies.value, policyVersion);
  const dependencyTimeoutMs = descriptors.dependencyTimeoutMs?.value
    ?? MODERATION_RATE_LIMIT_DEPENDENCY_TIMEOUT_DEFAULT_MS;
  const transactionMaxWaitMs = descriptors.transactionMaxWaitMs?.value ?? 200;
  const transactionTimeoutMs = descriptors.transactionTimeoutMs?.value ?? 1_400;
  const statementTimeoutMs = descriptors.statementTimeoutMs?.value ?? 1_000;
  const lockTimeoutMs = descriptors.lockTimeoutMs?.value ?? 250;
  if (
    !normalizePositiveInteger(dependencyTimeoutMs, 500, 10_000)
    || !normalizePositiveInteger(transactionMaxWaitMs, 10, 2_000)
    || !normalizePositiveInteger(transactionTimeoutMs, 100, 5_000)
    || !normalizePositiveInteger(statementTimeoutMs, 50, transactionTimeoutMs)
    || !normalizePositiveInteger(lockTimeoutMs, 10, statementTimeoutMs)
    || transactionMaxWaitMs + transactionTimeoutMs > dependencyTimeoutMs - 250
  ) {
    throw new TypeError('moderation rate-limit store timeouts are invalid');
  }
  const timeoutValues = Object.freeze({
    idleTimeoutMs: transactionTimeoutMs,
    lockTimeoutMs,
    statementTimeoutMs,
  });

  const consumeModerationRateLimit = async function consumeModerationRateLimit(
    input,
    consumeOptions,
  ) {
    const { actorId, scopes, signal } = normalizeConsumeArguments(input, consumeOptions);
    const policyInput = JSON.stringify(scopes.map((scope) => ({
      burstCapacity: policies[scope].burstCapacity,
      emissionIntervalMs: policies[scope].emissionIntervalMs,
      policyFingerprint: policies[scope].policyFingerprint,
      scope,
    })));
    try {
      return await db.$transaction(async (tx) => {
        validateTransactionClient(tx);
        throwIfAborted(signal);
        const timeoutResult = await tx.$queryRawUnsafe(
          SET_LOCAL_TIMEOUTS_SQL,
          `${timeoutValues.lockTimeoutMs}ms`,
          `${timeoutValues.statementTimeoutMs}ms`,
          `${timeoutValues.idleTimeoutMs}ms`,
        );
        validateTimeoutResult(timeoutResult, timeoutValues);
        throwIfAborted(signal);
        for (const scope of scopes) {
          throwIfAborted(signal);
          const lockResult = await tx.$queryRawUnsafe(LOCK_BUCKET_SQL, actorId, scope);
          validateLockResult(lockResult);
          throwIfAborted(signal);
        }
        const result = await tx.$queryRawUnsafe(
          CONSUME_BUCKETS_SQL,
          actorId,
          policyInput,
          policyVersion,
          scopes.length,
        );
        throwIfAborted(signal);
        return normalizeResult(result, scopes.length);
      }, {
        maxWait: transactionMaxWaitMs,
        timeout: transactionTimeoutMs,
      });
    } catch (error) {
      if (error instanceof ModerationRateLimitStoreUnavailableError) throw error;
      throw new ModerationRateLimitStoreUnavailableError();
    }
  };
  return bindModerationRateLimitConsumerDeadline(
    consumeModerationRateLimit,
    dependencyTimeoutMs,
  );
}

export const MODERATION_RATE_LIMIT_POSTGRES_SQL = Object.freeze({
  consume: CONSUME_BUCKETS_SQL,
  lock: LOCK_BUCKET_SQL,
  timeouts: SET_LOCAL_TIMEOUTS_SQL,
});
