import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MODERATION_RATE_LIMIT_CLEANUP_SQL,
  MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL,
  MODERATION_RATE_LIMIT_DATABASE_TIMEOUTS_SQL,
  ModerationRateLimitDatabaseContractError,
  verifyModerationRateLimitDatabaseContract,
} from '../src/lib/moderation-rate-limit-database.js';

test('accepts only an exact ready database contract row', async () => {
  const observed = [];
  const readyTimeouts = [{
    idleTimeoutMs: 1_400,
    lockTimeoutMs: 250,
    statementTimeoutMs: 1_000,
  }];
  const createDb = (result, timeoutResult = readyTimeouts) => ({
    async $transaction(callback, options) {
      observed.push({ options });
      return callback({
        async $queryRawUnsafe(sql) {
          observed.push({ sql });
          return sql === MODERATION_RATE_LIMIT_DATABASE_TIMEOUTS_SQL
            ? timeoutResult
            : result;
        },
      });
    },
  });
  const db = createDb([{ contractReady: true }]);
  assert.equal(await verifyModerationRateLimitDatabaseContract(db), true);
  assert.deepEqual(observed, [
    { options: { maxWait: 200, timeout: 1_400 } },
    { sql: MODERATION_RATE_LIMIT_DATABASE_TIMEOUTS_SQL },
    { sql: MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL },
  ]);

  for (const result of [
    [],
    [{ contractReady: false }],
    [{ contractReady: true, extra: true }],
    [{ contractReady: 'true' }],
  ]) {
    await assert.rejects(
      () => verifyModerationRateLimitDatabaseContract(createDb(result)),
      ModerationRateLimitDatabaseContractError,
    );
  }

  for (const timeoutResult of [
    [],
    [{ ...readyTimeouts[0], extra: true }],
    [{ ...readyTimeouts[0], statementTimeoutMs: 999 }],
  ]) {
    await assert.rejects(
      () => verifyModerationRateLimitDatabaseContract(
        createDb([{ contractReady: true }], timeoutResult),
      ),
      ModerationRateLimitDatabaseContractError,
    );
  }

  await assert.rejects(
    () => verifyModerationRateLimitDatabaseContract({}),
    ModerationRateLimitDatabaseContractError,
  );
});

test('database contract errors are fixed and identity-free', async () => {
  const secret = `wf_${'s'.repeat(32)}`;
  const db = {
    async $transaction(callback) {
      return callback({
        async $queryRawUnsafe() { throw new Error(secret); },
      });
    },
  };
  await assert.rejects(
    () => verifyModerationRateLimitDatabaseContract(db),
    (error) => {
      assert.equal(error instanceof ModerationRateLimitDatabaseContractError, true);
      assert.equal(error.message.includes(secret), false);
      return true;
    },
  );
});

test('cleanup SQL is bounded, database-clock based, and identity-free', () => {
  assert.match(MODERATION_RATE_LIMIT_CLEANUP_SQL, /FOR UPDATE OF bucket SKIP LOCKED/u);
  assert.match(MODERATION_RATE_LIMIT_CLEANUP_SQL, /"theoreticalArrivalAt" <= clock\."nowAt"/u);
  assert.match(MODERATION_RATE_LIMIT_CLEANUP_SQL, /LIMIT \$2::integer/u);
  assert.equal((MODERATION_RATE_LIMIT_CLEANUP_SQL.match(/clock_timestamp\(\)/gu) || []).length, 1);
});

test('database readiness requires schema usage and every DML privilege independently', () => {
  assert.match(MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL, /has_schema_privilege\([\s\S]*?'USAGE'/u);
  for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    assert.match(
      MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL,
      new RegExp(`has_table_privilege\\([\\s\\S]*?'${privilege}'`),
    );
  }
  assert.doesNotMatch(
    MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL,
    /'SELECT,INSERT,UPDATE,DELETE'/u,
  );
  assert.match(MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL, /privilege\.grantee = 0/u);
  assert.match(MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL, /COUNT\(\*\) FILTER \(WHERE/u);
  assert.match(MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL, /SELECT COUNT\(\*\) = 6/u);
  assert.match(MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL, /SELECT COUNT\(\*\) = 2/u);
  assert.match(MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL, /pg_get_constraintdef/u);
  assert.match(MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL, /index_row\.indpred IS NULL/u);
  assert.match(MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL, /access_method\.amname = 'btree'/u);
});
