import assert from 'node:assert/strict';
import test from 'node:test';

import { MODERATION_CAPABILITIES } from '../src/lib/moderation-principal.js';
import { bindModerationRateLimitConsumerDeadline } from '../src/lib/moderation-rate-limit-deadline.js';
import { createModerationRateLimiter } from '../src/middleware/moderation-rate-limit.js';
import {
  createPostgresModerationRateLimitConsumer,
  MODERATION_RATE_LIMIT_POSTGRES_SQL,
  ModerationRateLimitStoreUnavailableError,
} from '../src/lib/moderation-rate-limit-postgres.js';

const ACTOR_ID = `wf_${'g'.repeat(32)}`;
const SCOPES = [
  MODERATION_CAPABILITIES.CONTENT_REMOVE,
  MODERATION_CAPABILITIES.QUEUE_READ,
  MODERATION_CAPABILITIES.REPORT_CLAIM,
  MODERATION_CAPABILITIES.REPORT_DECIDE,
].sort();

function policies(overrides = {}) {
  return Object.fromEntries(SCOPES.map((scope) => [scope, {
    burstCapacity: 2,
    emissionIntervalMs: 10_000,
    ...(overrides[scope] || {}),
  }]));
}

function allowedRow(expectedCount) {
  return [{
    allowed: true,
    expectedCount,
    inputCount: expectedCount,
    policyMismatch: false,
    retryAfterSeconds: null,
    writtenCount: expectedCount,
  }];
}

function deniedRow(expectedCount, retryAfterSeconds = 17n) {
  return [{
    allowed: false,
    expectedCount,
    inputCount: expectedCount,
    policyMismatch: false,
    retryAfterSeconds,
    writtenCount: 0,
  }];
}

function fakeDatabase({ consumeResult = allowedRow(1), onQuery } = {}) {
  const calls = [];
  let transactionCalls = 0;
  const tx = {
    async $queryRawUnsafe(sql, ...values) {
      calls.push({ sql, values });
      await onQuery?.({ calls, sql, values });
      if (sql === MODERATION_RATE_LIMIT_POSTGRES_SQL.timeouts) {
        return [{
          idleTimeoutMs: Number.parseInt(values[2], 10),
          lockTimeoutMs: Number.parseInt(values[0], 10),
          statementTimeoutMs: Number.parseInt(values[1], 10),
        }];
      }
      if (sql === MODERATION_RATE_LIMIT_POSTGRES_SQL.lock) {
        return [{ lockAcquired: true }];
      }
      if (sql === MODERATION_RATE_LIMIT_POSTGRES_SQL.consume) {
        return typeof consumeResult === 'function'
          ? consumeResult({ calls, values })
          : consumeResult;
      }
      assert.fail('unexpected SQL');
    },
  };
  return {
    calls,
    get transactionCalls() { return transactionCalls; },
    db: {
      async $transaction(callback, options) {
        transactionCalls += 1;
        calls.push({ options, transaction: true });
        return callback(tx);
      },
    },
  };
}

function create(db, overrides = {}) {
  return createPostgresModerationRateLimitConsumer({
    db,
    policies: policies(),
    policyVersion: 'moderation-gcra-test-v1',
    ...overrides,
  });
}

test('sorts and atomically submits only opaque actor scopes with bounded DB deadlines', async () => {
  const fake = fakeDatabase({ consumeResult: allowedRow(2) });
  const consume = create(fake.db);
  const signal = new AbortController().signal;
  const outcome = await consume({
    actorId: ACTOR_ID,
    scopes: [
      MODERATION_CAPABILITIES.REPORT_DECIDE,
      MODERATION_CAPABILITIES.CONTENT_REMOVE,
    ],
  }, { signal });

  assert.deepEqual(outcome, { allowed: true });
  assert.equal(Object.isFrozen(outcome), true);
  assert.equal(fake.transactionCalls, 1);
  assert.deepEqual(fake.calls[0].options, { maxWait: 200, timeout: 1_400 });
  const lockCalls = fake.calls.filter(({ sql }) => sql === MODERATION_RATE_LIMIT_POSTGRES_SQL.lock);
  assert.deepEqual(lockCalls.map(({ values }) => values), [
    [ACTOR_ID, MODERATION_CAPABILITIES.CONTENT_REMOVE],
    [ACTOR_ID, MODERATION_CAPABILITIES.REPORT_DECIDE],
  ]);
  const consumeCall = fake.calls.find(({ sql }) => sql === MODERATION_RATE_LIMIT_POSTGRES_SQL.consume);
  assert.ok(consumeCall);
  assert.equal(consumeCall.values[0], ACTOR_ID);
  assert.equal(consumeCall.values[2], 'moderation-gcra-test-v1');
  assert.equal(consumeCall.values[3], 2);
  assert.deepEqual(
    JSON.parse(consumeCall.values[1]).map(({ scope }) => scope),
    [MODERATION_CAPABILITIES.CONTENT_REMOVE, MODERATION_CAPABILITIES.REPORT_DECIDE],
  );
  assert.equal(consumeCall.sql.includes(ACTOR_ID), false);
});

test('returns only a frozen bounded denial and never retries a transaction', async () => {
  const fake = fakeDatabase({ consumeResult: deniedRow(1, 37n) });
  const outcome = await create(fake.db)({
    actorId: ACTOR_ID,
    scopes: [MODERATION_CAPABILITIES.QUEUE_READ],
  }, { signal: new AbortController().signal });
  assert.deepEqual(outcome, { allowed: false, retryAfterSeconds: 37 });
  assert.equal(Object.isFrozen(outcome), true);
  assert.equal(fake.transactionCalls, 1);
});

test('fails closed on policy mismatch, oversized retry, malformed rows, and dependency errors', async () => {
  const invalidResults = [
    [{
      ...deniedRow(1)[0],
      policyMismatch: true,
      retryAfterSeconds: null,
    }],
    deniedRow(1, 3_601n),
    [{ ...allowedRow(1)[0], writtenCount: 0 }],
    [{ ...deniedRow(1)[0], retryAfterSeconds: 1 }],
    [{ ...deniedRow(1)[0], extra: 'unexpected' }],
  ];
  for (const consumeResult of invalidResults) {
    const fake = fakeDatabase({ consumeResult });
    await assert.rejects(
      () => create(fake.db)({
        actorId: ACTOR_ID,
        scopes: [MODERATION_CAPABILITIES.QUEUE_READ],
      }, { signal: new AbortController().signal }),
      ModerationRateLimitStoreUnavailableError,
    );
    assert.equal(fake.transactionCalls, 1);
  }

  let transactionCalls = 0;
  const db = {
    async $transaction() {
      transactionCalls += 1;
      throw new Error(`${ACTOR_ID} must stay private`);
    },
  };
  await assert.rejects(
    () => create(db)({
      actorId: ACTOR_ID,
      scopes: [MODERATION_CAPABILITIES.QUEUE_READ],
    }, { signal: new AbortController().signal }),
    (error) => {
      assert.equal(error instanceof ModerationRateLimitStoreUnavailableError, true);
      assert.equal(error.message.includes(ACTOR_ID), false);
      return true;
    },
  );
  assert.equal(transactionCalls, 1);
});

test('honors abort before DB access and between ordered locks', async () => {
  const preAborted = new AbortController();
  preAborted.abort();
  const untouched = fakeDatabase();
  await assert.rejects(
    () => create(untouched.db)({
      actorId: ACTOR_ID,
      scopes: [MODERATION_CAPABILITIES.QUEUE_READ],
    }, { signal: preAborted.signal }),
    ModerationRateLimitStoreUnavailableError,
  );
  assert.equal(untouched.transactionCalls, 0);

  const controller = new AbortController();
  let lockCalls = 0;
  const interrupted = fakeDatabase({
    consumeResult: () => assert.fail('consume SQL must not run after abort'),
    onQuery({ sql }) {
      if (sql === MODERATION_RATE_LIMIT_POSTGRES_SQL.lock) {
        lockCalls += 1;
        if (lockCalls === 1) controller.abort();
      }
    },
  });
  await assert.rejects(
    () => create(interrupted.db)({
      actorId: ACTOR_ID,
      scopes: [
        MODERATION_CAPABILITIES.REPORT_DECIDE,
        MODERATION_CAPABILITIES.CONTENT_REMOVE,
      ],
    }, { signal: controller.signal }),
    ModerationRateLimitStoreUnavailableError,
  );
  assert.equal(lockCalls, 1);
});

test('rejects unsafe factory policy, timeout, input, array, and accessor shapes', async () => {
  const fake = fakeDatabase();
  const valid = {
    db: fake.db,
    policies: policies(),
    policyVersion: 'moderation-gcra-test-v1',
  };
  for (const options of [
    {},
    { ...valid, extra: true },
    { ...valid, policyVersion: '../unsafe' },
    { ...valid, policies: { ...policies(), unknown: policies()[SCOPES[0]] } },
    {
      ...valid,
      policies: policies({
        [MODERATION_CAPABILITIES.QUEUE_READ]: { emissionIntervalMs: 999 },
      }),
    },
    {
      ...valid,
      policies: policies({
        [MODERATION_CAPABILITIES.QUEUE_READ]: {
          burstCapacity: 100,
          emissionIntervalMs: 3_600_000,
        },
      }),
    },
    { ...valid, dependencyTimeoutMs: 1_500 },
    { ...valid, lockTimeoutMs: 1_001, statementTimeoutMs: 1_000 },
  ]) {
    assert.throws(
      () => createPostgresModerationRateLimitConsumer(options),
      TypeError,
    );
  }

  const consume = create(fake.db);
  const inputCases = [
    { actorId: 'wf_short', scopes: [MODERATION_CAPABILITIES.QUEUE_READ] },
    { actorId: ACTOR_ID, scopes: [] },
    { actorId: ACTOR_ID, scopes: ['unknown.scope'] },
    {
      actorId: ACTOR_ID,
      scopes: [MODERATION_CAPABILITIES.QUEUE_READ, MODERATION_CAPABILITIES.QUEUE_READ],
    },
    { actorId: ACTOR_ID, scopes: [MODERATION_CAPABILITIES.QUEUE_READ], extra: true },
  ];
  for (const input of inputCases) {
    await assert.rejects(
      () => consume(input, { signal: new AbortController().signal }),
      ModerationRateLimitStoreUnavailableError,
    );
  }

  let actorReads = 0;
  const accessorInput = {
    scopes: [MODERATION_CAPABILITIES.QUEUE_READ],
  };
  Object.defineProperty(accessorInput, 'actorId', {
    enumerable: true,
    get() { actorReads += 1; return ACTOR_ID; },
  });
  await assert.rejects(
    () => consume(accessorInput, { signal: new AbortController().signal }),
    ModerationRateLimitStoreUnavailableError,
  );
  assert.equal(actorReads, 0);
});

test('fingerprints actual thresholds so reusing a policy version cannot hide drift', async () => {
  const fingerprints = [];
  const fake = fakeDatabase({
    consumeResult({ values }) {
      fingerprints.push(JSON.parse(values[1])[0].policyFingerprint);
      return allowedRow(1);
    },
  });
  const input = {
    actorId: ACTOR_ID,
    scopes: [MODERATION_CAPABILITIES.QUEUE_READ],
  };
  await create(fake.db)(input, { signal: new AbortController().signal });
  await create(fake.db, {
    policies: policies({
      [MODERATION_CAPABILITIES.QUEUE_READ]: { emissionIntervalMs: 11_000 },
    }),
  })(input, { signal: new AbortController().signal });
  assert.equal(fingerprints.length, 2);
  assert.notEqual(fingerprints[0], fingerprints[1]);
  assert.match(fingerprints[0], /^[0-9a-f]{64}$/u);
});

test('binds the database budget to the middleware outer deadline', () => {
  const fake = fakeDatabase();
  const consume = create(fake.db, { dependencyTimeoutMs: 3_000 });
  assert.doesNotThrow(() => createModerationRateLimiter({
    consume,
    dependencyTimeoutMs: 3_000,
  }));
  assert.throws(
    () => createModerationRateLimiter({ consume, dependencyTimeoutMs: 2_000 }),
    /deadline does not match middleware/u,
  );
  const wrapper = async (...args) => consume(...args);
  assert.throws(
    () => createModerationRateLimiter({ consume: wrapper, dependencyTimeoutMs: 3_000 }),
    /deadline is unbound/u,
  );
  bindModerationRateLimitConsumerDeadline(wrapper, 3_000);
  assert.doesNotThrow(() => createModerationRateLimiter({
    consume: wrapper,
    dependencyTimeoutMs: 3_000,
  }));
});
