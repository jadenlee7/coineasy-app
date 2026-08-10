import { randomBytes, timingSafeEqual } from 'node:crypto';

import {
  AccountDeletionConfigurationError,
  accountDeletionSubjectHash,
  accountDeletionSubjectKeyFingerprint,
  decryptAccountDeletionSubject,
} from './account-deletion.js';
import { accountDeletionProviderCleanupEnabled } from './account-deletion-gates.js';
import {
  AccountDeletionProviderError,
  createAccountDeletionProviders,
} from './account-deletion-providers.js';

const SUBJECT_HASH_KEY_VERSION = 1;
const ENCRYPTION_KEY_VERSION = 1;
const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 6 * 60 * 60 * 1_000;
const MAX_STAGE_ATTEMPTS = 8;

const CLAIMABLE_STATES = Object.freeze([
  'LOCAL_PURGED',
  'APPLE_REVOKED',
  'PRIVY_DELETED',
]);

const CLAIM_SQL = `
WITH candidate AS (
  SELECT "id"
  FROM "AccountDeletionRequest"
  WHERE "state" IN (
    'LOCAL_PURGED'::"AccountDeletionState",
    'APPLE_REVOKED'::"AccountDeletionState",
    'PRIVY_DELETED'::"AccountDeletionState"
  )
    AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= CURRENT_TIMESTAMP)
    AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= CURRENT_TIMESTAMP)
    AND NOT ("id" = ANY($3::text[]))
  ORDER BY COALESCE("nextAttemptAt", "requestedAt"), "requestedAt", "id"
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE "AccountDeletionRequest" AS request
SET "leaseToken" = $2,
    "leaseExpiresAt" = CURRENT_TIMESTAMP
      + ($1::integer * INTERVAL '1 millisecond'),
    "lastAttemptAt" = CURRENT_TIMESTAMP,
    "attemptCount" = request."attemptCount" + 1,
    "stateVersion" = request."stateVersion" + 1,
    "updatedAt" = CURRENT_TIMESTAMP
FROM candidate
WHERE request."id" = candidate."id"
RETURNING
  request."id",
  request."state",
  request."stateVersion",
  request."attemptCount",
  request."subjectHash",
  request."subjectHashKeyVersion",
  request."subjectHashKeyFingerprint",
  request."privyDidCiphertext",
  request."encryptionKeyVersion",
  request."leaseToken",
  request."leaseExpiresAt"
`;

const RENEW_LEASE_SQL = `
UPDATE "AccountDeletionRequest"
SET "leaseExpiresAt" = CURRENT_TIMESTAMP
      + ($1::integer * INTERVAL '1 millisecond'),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = $2::text
  AND "state" = $3::"AccountDeletionState"
  AND "stateVersion" = $4::integer
  AND "leaseToken" = $5::varchar(64)
  AND "leaseExpiresAt" > CURRENT_TIMESTAMP
`;

const FENCED_UPDATE_FIELDS = Object.freeze({
  state: { column: 'state', cast: '::"AccountDeletionState"' },
  attemptCount: { column: 'attemptCount', cast: '::integer' },
  nextAttemptAt: { column: 'nextAttemptAt', cast: '::timestamp(3)' },
  lastErrorAt: { column: 'lastErrorAt', cast: '::timestamp(3)' },
  lastErrorCode: { column: 'lastErrorCode', cast: '::varchar(100)' },
  appleRevokedAt: { column: 'appleRevokedAt', cast: '::timestamp(3)' },
  privyDeletedAt: { column: 'privyDeletedAt', cast: '::timestamp(3)' },
  completedAt: { column: 'completedAt', cast: '::timestamp(3)' },
  manualReviewAt: { column: 'manualReviewAt', cast: '::timestamp(3)' },
  privyDidCiphertext: { column: 'privyDidCiphertext', cast: '::text' },
  encryptionKeyVersion: { column: 'encryptionKeyVersion', cast: '::integer' },
  retryDelayMs: { column: 'nextAttemptAt', special: 'database_retry_delay' },
});

const SAFE_LOG_KEYS = new Set([
  'attemptCount',
  'claimed',
  'completed',
  'durationMs',
  'errorCode',
  'fromState',
  'halted',
  'manualReview',
  'outcome',
  'requestId',
  'retried',
  'statusClass',
  'toState',
]);

export class AccountDeletionWorkerError extends Error {
  constructor(code, {
    retryable = false,
    global = false,
    haltCycle = global,
    statusClass = 'internal',
  } = {}) {
    super(code);
    this.name = 'AccountDeletionWorkerError';
    this.code = code;
    this.retryable = Boolean(retryable);
    this.global = Boolean(global);
    this.haltCycle = Boolean(haltCycle);
    this.statusClass = statusClass;
  }
}

function configuredInteger(value, fallback, { min, max, name }) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new AccountDeletionWorkerError('account_deletion_worker_config_invalid', {
      retryable: true,
      global: true,
      statusClass: name,
    });
  }
  return parsed;
}

export function getAccountDeletionWorkerConfig(env = process.env) {
  const providerTimeoutMs = configuredInteger(
    env.ACCOUNT_DELETION_PROVIDER_TIMEOUT_MS,
    10_000,
    {
      min: 1_000,
      max: 30_000,
      name: 'provider_timeout',
    },
  );
  const leaseMs = configuredInteger(env.ACCOUNT_DELETION_WORKER_LEASE_MS, 60_000, {
    min: 30_000,
    max: 10 * 60_000,
    name: 'lease',
  });
  if (leaseMs < providerTimeoutMs * 2) {
    throw new AccountDeletionWorkerError('account_deletion_worker_lease_too_short', {
      retryable: true,
      global: true,
      statusClass: 'configuration',
    });
  }
  return {
    intervalMs: configuredInteger(env.ACCOUNT_DELETION_WORKER_INTERVAL_MS, 30_000, {
      min: 5_000,
      max: 60 * 60_000,
      name: 'interval',
    }),
    batchSize: configuredInteger(env.ACCOUNT_DELETION_WORKER_BATCH_SIZE, 10, {
      min: 1,
      max: 100,
      name: 'batch_size',
    }),
    leaseMs,
    providerTimeoutMs,
  };
}

function validatedLeaseMs(leaseMs) {
  if (!Number.isInteger(leaseMs) || leaseMs < 30_000 || leaseMs > 600_000) {
    throw new AccountDeletionWorkerError('account_deletion_worker_lease_invalid', {
      retryable: true,
      global: true,
      statusClass: 'configuration',
    });
  }
  return leaseMs;
}

export function accountDeletionRetryDelayMs(
  attemptCount,
  { random = Math.random, baseMs = RETRY_BASE_MS, maxMs = RETRY_MAX_MS } = {},
) {
  const attempt = Math.max(1, Math.min(Number(attemptCount) || 1, 32));
  const ceiling = Math.min(maxMs, baseMs * (2 ** (attempt - 1)));
  const sample = Number(random());
  const boundedSample = Number.isFinite(sample)
    ? Math.max(0, Math.min(sample, 0.999999999))
    : 0.5;
  // A zero-delay retry could be reclaimed repeatedly by this same batch and
  // exhaust a row's attempt budget in one cycle.
  return Math.min(ceiling, Math.max(1_000, Math.floor(ceiling * boundedSample)));
}

function safeLog(logger, level, fields, message) {
  const safe = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (SAFE_LOG_KEYS.has(key) && value !== undefined) safe[key] = value;
  }
  logger?.[level]?.(safe, message);
}

function validateProviderAdapters(providers) {
  if (
    !providers
    || typeof providers.apple?.resolve !== 'function'
    || typeof providers.privy?.deleteUser !== 'function'
  ) {
    throw globalConfigurationFailure('account_deletion_provider_adapters_invalid');
  }
  return providers;
}

export async function claimAccountDeletionRequest({
  db,
  leaseMs = 60_000,
  bytes = randomBytes,
  excludeRequestIds = [],
} = {}) {
  if (!db || typeof db.$queryRawUnsafe !== 'function') {
    throw new AccountDeletionWorkerError('account_deletion_worker_database_unavailable', {
      retryable: true,
      global: true,
    });
  }
  const leaseDurationMs = validatedLeaseMs(leaseMs);
  if (!Array.isArray(excludeRequestIds) || excludeRequestIds.length > 100) {
    throw new AccountDeletionWorkerError('account_deletion_worker_exclusions_invalid', {
      retryable: true,
      global: true,
    });
  }
  const exclusions = excludeRequestIds.map((value) => String(value));
  const leaseToken = bytes(32).toString('hex');
  if (!/^[a-f0-9]{64}$/u.test(leaseToken)) {
    throw new AccountDeletionWorkerError('account_deletion_worker_lease_token_invalid', {
      retryable: true,
      global: true,
    });
  }
  const rows = await db.$queryRawUnsafe(
    CLAIM_SQL,
    leaseDurationMs,
    leaseToken,
    exclusions,
  );
  return rows?.[0] || null;
}

function constantTimeEqual(left, right) {
  const first = Buffer.from(String(left || ''), 'utf8');
  const second = Buffer.from(String(right || ''), 'utf8');
  return first.length === second.length && timingSafeEqual(first, second);
}

function globalConfigurationFailure(code) {
  return new AccountDeletionWorkerError(code, {
    retryable: true,
    global: true,
    statusClass: 'configuration',
  });
}

function rowFailure(code) {
  return new AccountDeletionWorkerError(code, {
    retryable: false,
    global: false,
    statusClass: 'row',
  });
}

export function resolvePrivyDeletionSubject(request, env = process.env) {
  if (request?.subjectHashKeyVersion !== SUBJECT_HASH_KEY_VERSION) {
    throw globalConfigurationFailure('account_deletion_subject_key_version_unsupported');
  }
  if (request?.encryptionKeyVersion !== ENCRYPTION_KEY_VERSION) {
    throw globalConfigurationFailure('account_deletion_encryption_key_version_unsupported');
  }

  let configuredFingerprint;
  try {
    configuredFingerprint = accountDeletionSubjectKeyFingerprint(env, { required: true });
  } catch {
    throw globalConfigurationFailure('account_deletion_hash_key_unavailable');
  }
  if (!constantTimeEqual(configuredFingerprint, request?.subjectHashKeyFingerprint)) {
    throw globalConfigurationFailure('account_deletion_hash_key_mismatch');
  }
  if (!request?.privyDidCiphertext) throw rowFailure('account_deletion_provider_subject_missing');

  let privyDid;
  try {
    privyDid = decryptAccountDeletionSubject(
      request.privyDidCiphertext,
      request.subjectHash,
      env,
    );
  } catch (error) {
    if (error instanceof AccountDeletionConfigurationError
      && ['account_deletion_encryption_key_missing', 'account_deletion_encryption_key_invalid']
        .includes(error.code)) {
      throw globalConfigurationFailure('account_deletion_encryption_key_unavailable');
    }
    throw rowFailure('account_deletion_provider_subject_corrupt');
  }

  if (!/^did:privy:[A-Za-z0-9._:-]{1,220}$/u.test(privyDid)) {
    throw rowFailure('account_deletion_provider_subject_invalid');
  }
  let calculatedHash;
  try {
    calculatedHash = accountDeletionSubjectHash(privyDid, env, { required: true });
  } catch {
    throw globalConfigurationFailure('account_deletion_hash_key_unavailable');
  }
  if (!constantTimeEqual(calculatedHash, request.subjectHash)) {
    // The configured fingerprint already matched this row. A different
    // recalculated digest is therefore isolated row corruption/tampering, not
    // evidence of a fleet-wide key outage.
    throw rowFailure('account_deletion_subject_hash_mismatch');
  }
  return privyDid;
}

function normalizedFailure(error) {
  if (error instanceof AccountDeletionProviderError
    || error instanceof AccountDeletionWorkerError) return error;
  return new AccountDeletionWorkerError('account_deletion_provider_unclassified_failure', {
    retryable: true,
    haltCycle: true,
    statusClass: 'unknown',
  });
}

async function fencedUpdate(db, request, data) {
  if (!db || typeof db.$executeRawUnsafe !== 'function') {
    throw globalConfigurationFailure('account_deletion_worker_database_unavailable');
  }

  const assignments = [];
  const assignedColumns = new Set();
  const values = [];
  for (const [key, value] of Object.entries(data || {})) {
    const field = FENCED_UPDATE_FIELDS[key];
    if (!field || value === undefined || assignedColumns.has(field.column)) {
      throw globalConfigurationFailure('account_deletion_worker_update_invalid');
    }
    assignedColumns.add(field.column);
    values.push(value);
    if (field.special === 'database_retry_delay') {
      if (!Number.isInteger(value) || value < 1_000 || value > RETRY_MAX_MS) {
        throw globalConfigurationFailure('account_deletion_worker_update_invalid');
      }
      assignments.push(
        `"${field.column}" = CURRENT_TIMESTAMP`
        + ` + ($${values.length}::integer * INTERVAL '1 millisecond')`,
      );
    } else {
      assignments.push(`"${field.column}" = $${values.length}${field.cast}`);
    }
  }
  if (assignments.length === 0) {
    throw globalConfigurationFailure('account_deletion_worker_update_invalid');
  }

  const idParameter = values.push(request.id);
  const stateParameter = values.push(request.state);
  const versionParameter = values.push(request.stateVersion);
  const tokenParameter = values.push(request.leaseToken);
  const sql = `
UPDATE "AccountDeletionRequest"
SET ${assignments.join(',\n    ')},
    "stateVersion" = "stateVersion" + 1,
    "leaseToken" = NULL,
    "leaseExpiresAt" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = $${idParameter}::text
  AND "state" = $${stateParameter}::"AccountDeletionState"
  AND "stateVersion" = $${versionParameter}::integer
  AND "leaseToken" = $${tokenParameter}::varchar(64)
  AND "leaseExpiresAt" > CURRENT_TIMESTAMP
`;
  const count = await db.$executeRawUnsafe(sql, ...values);
  return Number(count) === 1;
}

async function renewClaimLease(db, request, leaseMs) {
  if (!db || typeof db.$executeRawUnsafe !== 'function') {
    throw globalConfigurationFailure('account_deletion_worker_database_unavailable');
  }
  const count = await db.$executeRawUnsafe(
    RENEW_LEASE_SQL,
    validatedLeaseMs(leaseMs),
    request.id,
    request.state,
    request.stateVersion,
    request.leaseToken,
  );
  return Number(count) === 1;
}

async function scheduleRetry({ db, request, failure, now, random }) {
  const delayMs = accountDeletionRetryDelayMs(request.attemptCount, { random });
  const updated = await fencedUpdate(db, request, {
    retryDelayMs: delayMs,
    lastErrorAt: now,
    lastErrorCode: failure.code,
  });
  return {
    outcome: updated ? 'retry_scheduled' : 'lease_lost',
    haltCycle: Boolean(failure.haltCycle || failure.global),
    errorCode: failure.code,
    statusClass: failure.statusClass,
  };
}

async function sendToManualReview({ db, request, failure, now }) {
  const updated = await fencedUpdate(db, request, {
    state: 'MANUAL_REVIEW',
    nextAttemptAt: null,
    lastErrorAt: now,
    lastErrorCode: failure.code,
    manualReviewAt: now,
  });
  return {
    outcome: updated ? 'manual_review' : 'lease_lost',
    haltCycle: Boolean(failure.haltCycle),
    errorCode: failure.code,
    statusClass: failure.statusClass,
  };
}

async function handleFailure({ db, request, error, now, random }) {
  const failure = normalizedFailure(error);
  // Global configuration/authentication failures stay retryable and stop this
  // cycle. They must never fan out into per-user MANUAL_REVIEW records.
  if (failure.global) {
    return scheduleRetry({ db, request, failure, now, random });
  }
  if (!failure.retryable || request.attemptCount >= MAX_STAGE_ATTEMPTS) {
    return sendToManualReview({ db, request, failure, now });
  }
  return scheduleRetry({ db, request, failure, now, random });
}

function validLease(request) {
  const expiresAt = new Date(request?.leaseExpiresAt || 0);
  return Boolean(
    request?.id
    && CLAIMABLE_STATES.includes(request?.state)
    && Number.isInteger(request?.stateVersion)
    && Number.isInteger(request?.attemptCount)
    && /^[a-f0-9]{64}$/u.test(String(request?.leaseToken || ''))
    && Number.isFinite(expiresAt.getTime())
  );
}

export async function processClaimedAccountDeletion({
  db,
  request,
  providers,
  env = process.env,
  clock = () => new Date(),
  random = Math.random,
  leaseMs = 60_000,
  logger,
} = {}) {
  const startedAt = Date.now();
  const leaseDurationMs = validatedLeaseMs(leaseMs);
  if (!validLease(request)) {
    return { outcome: 'lease_lost', haltCycle: false };
  }

  try {
    let updated;
    let toState;
    if (request.state === 'LOCAL_PURGED') {
      if (!await renewClaimLease(db, request, leaseDurationMs)) {
        return { outcome: 'lease_lost', haltCycle: false };
      }
      const resolution = await providers?.apple?.resolve({
        requestId: request.id,
        attemptCount: request.attemptCount,
      });
      // The current schema can truthfully represent only an actual revocation.
      // NOT_APPLICABLE/Privy-confirmed dispositions require the later schema.
      if (resolution?.outcome !== 'revoked') {
        throw rowFailure('apple_revocation_unproven');
      }
      const now = clock();
      toState = 'APPLE_REVOKED';
      updated = await fencedUpdate(db, request, {
        state: toState,
        attemptCount: 0,
        // NULL is immediately eligible under the database clock. The cycle's
        // request-ID exclusion prevents this row from running twice in one batch.
        nextAttemptAt: null,
        lastErrorAt: null,
        lastErrorCode: null,
        appleRevokedAt: now,
      });
    } else if (request.state === 'APPLE_REVOKED') {
      const privyDid = resolvePrivyDeletionSubject(request, env);
      if (!await renewClaimLease(db, request, leaseDurationMs)) {
        return { outcome: 'lease_lost', haltCycle: false };
      }
      const deletion = await providers?.privy?.deleteUser({
        privyDid,
        attemptCount: request.attemptCount,
      });
      if (deletion?.outcome !== 'deleted') {
        throw rowFailure('privy_deletion_unproven');
      }
      const now = clock();
      toState = 'PRIVY_DELETED';
      updated = await fencedUpdate(db, request, {
        state: toState,
        attemptCount: 0,
        // Do not let a skewed process clock postpone the next durable stage.
        nextAttemptAt: null,
        lastErrorAt: null,
        lastErrorCode: null,
        privyDeletedAt: now,
      });
    } else {
      const now = clock();
      toState = 'COMPLETED';
      updated = await fencedUpdate(db, request, {
        state: toState,
        attemptCount: 0,
        nextAttemptAt: null,
        lastErrorAt: null,
        lastErrorCode: null,
        completedAt: now,
        privyDidCiphertext: null,
        encryptionKeyVersion: null,
      });
    }

    const result = {
      outcome: updated ? (toState === 'COMPLETED' ? 'completed' : 'advanced') : 'lease_lost',
      haltCycle: false,
      toState: updated ? toState : undefined,
    };
    safeLog(logger, 'info', {
      requestId: request.id,
      fromState: request.state,
      toState: result.toState,
      attemptCount: request.attemptCount,
      outcome: result.outcome,
      durationMs: Date.now() - startedAt,
    }, 'account deletion provider step finished');
    return result;
  } catch (error) {
    const result = await handleFailure({
      db,
      request,
      error,
      now: clock(),
      random,
    });
    safeLog(logger, result.outcome === 'manual_review' ? 'error' : 'warn', {
      requestId: request.id,
      fromState: request.state,
      attemptCount: request.attemptCount,
      outcome: result.outcome,
      errorCode: result.errorCode,
      statusClass: result.statusClass,
      durationMs: Date.now() - startedAt,
    }, 'account deletion provider step did not advance');
    return result;
  }
}

export async function runAccountDeletionCleanupCycle({
  db,
  env = process.env,
  logger,
  providerFactory = createAccountDeletionProviders,
  clock = () => new Date(),
  random = Math.random,
  bytes = randomBytes,
  allowFoundationExecution = false,
} = {}) {
  if (!allowFoundationExecution && !accountDeletionProviderCleanupEnabled(env)) {
    return {
      dormant: true,
      claimed: 0,
      completed: 0,
      retried: 0,
      manualReview: 0,
      halted: false,
    };
  }

  const config = getAccountDeletionWorkerConfig(env);
  // Construct and validate adapters before leasing a row. The default Privy
  // adapter remains lazy and does not initialize the SDK or make a network
  // request until a claimed PRIVY_DELETED step actually needs it.
  const providers = validateProviderAdapters(await providerFactory({
    privyOptions: { timeoutMs: config.providerTimeoutMs },
  }));
  const summary = {
    dormant: false,
    claimed: 0,
    completed: 0,
    retried: 0,
    manualReview: 0,
    halted: false,
  };
  const claimedRequestIds = [];

  for (let index = 0; index < config.batchSize; index += 1) {
    const request = await claimAccountDeletionRequest({
      db,
      leaseMs: config.leaseMs,
      bytes,
      excludeRequestIds: claimedRequestIds,
    });
    if (!request) break;
    summary.claimed += 1;
    claimedRequestIds.push(request.id);
    const result = await processClaimedAccountDeletion({
      db,
      request,
      providers,
      env,
      clock,
      random,
      leaseMs: config.leaseMs,
      logger,
    });
    if (result.outcome === 'completed') summary.completed += 1;
    if (result.outcome === 'retry_scheduled') summary.retried += 1;
    if (result.outcome === 'manual_review') summary.manualReview += 1;
    if (result.haltCycle) {
      summary.halted = true;
      break;
    }
  }

  safeLog(logger, 'info', summary, 'account deletion provider cycle finished');
  return summary;
}

export function abortableWait(ms, signal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    let timeout;

    function finish() {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }

    function onAbort() {
      finish();
    }

    timeout = setTimeout(finish, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
    // AbortSignal does not replay an abort to a listener registered after the
    // event. Close the check/register race without leaving the timer pending.
    if (signal?.aborted) finish();
  });
}

export async function runAccountDeletionCleanupLoop({
  db,
  env = process.env,
  logger,
  signal,
  once = false,
  runCycle = runAccountDeletionCleanupCycle,
  allowFoundationExecution = false,
} = {}) {
  if (!allowFoundationExecution && !accountDeletionProviderCleanupEnabled(env)) {
    return { dormant: true };
  }
  const { intervalMs } = getAccountDeletionWorkerConfig(env);
  while (!signal?.aborted) {
    await runCycle({ db, env, logger, allowFoundationExecution });
    if (once || signal?.aborted) break;
    await abortableWait(intervalMs, signal);
  }
  return { dormant: false };
}
