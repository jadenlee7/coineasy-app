import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ModerationActivationDatabaseContractsError,
  verifyModerationActivationDatabaseContracts,
} from '../src/lib/moderation-readiness.js';
import { MODERATION_DATABASE_CONTRACT_SQL } from '../src/lib/moderation-database.js';
import {
  MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL,
  MODERATION_RATE_LIMIT_DATABASE_TIMEOUTS_SQL,
} from '../src/lib/moderation-rate-limit-database.js';

test('default activation readiness executes both physical database verifiers', async () => {
  const observed = [];
  const db = {
    async $queryRawUnsafe(sql) {
      observed.push({ sql });
      assert.equal(sql, MODERATION_DATABASE_CONTRACT_SQL);
      return [{ contractReady: true }];
    },
    async $transaction(callback, options) {
      observed.push({ options });
      return callback({
        async $queryRawUnsafe(sql) {
          observed.push({ sql });
          if (sql === MODERATION_RATE_LIMIT_DATABASE_TIMEOUTS_SQL) {
            return [{
              idleTimeoutMs: 1_400,
              lockTimeoutMs: 250,
              statementTimeoutMs: 1_000,
            }];
          }
          assert.equal(sql, MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL);
          return [{ contractReady: true }];
        },
      });
    },
  };

  assert.equal(await verifyModerationActivationDatabaseContracts(db), true);
  assert.equal(
    observed.filter(({ sql }) => sql === MODERATION_DATABASE_CONTRACT_SQL).length,
    1,
  );
  assert.equal(
    observed.filter(({ sql }) => sql === MODERATION_RATE_LIMIT_DATABASE_TIMEOUTS_SQL).length,
    1,
  );
  assert.equal(
    observed.filter(({ sql }) => sql === MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL).length,
    1,
  );
  assert.deepEqual(observed.find(({ options }) => options)?.options, {
    maxWait: 200,
    timeout: 1_400,
  });
});

test('activation readiness requires both queue and rate-limit database contracts', async () => {
  const db = { name: 'shared-database-client' };
  const observed = [];
  assert.equal(await verifyModerationActivationDatabaseContracts(db, {
    async verifyQueueContract(value) {
      observed.push(['queue', value]);
      return true;
    },
    async verifyRateLimitContract(value) {
      observed.push(['rate-limit', value]);
      return true;
    },
  }), true);
  assert.deepEqual(observed, [
    ['queue', db],
    ['rate-limit', db],
  ]);
});

test('activation readiness never treats either database contract as optional', async () => {
  for (const [queueReady, rateLimitReady] of [
    [false, true],
    [true, false],
    [false, false],
    [undefined, true],
    [true, 'true'],
  ]) {
    await assert.rejects(
      () => verifyModerationActivationDatabaseContracts({}, {
        async verifyQueueContract() { return queueReady; },
        async verifyRateLimitContract() { return rateLimitReady; },
      }),
      ModerationActivationDatabaseContractsError,
    );
  }
});

test('activation readiness exposes one fixed identity-free error', async () => {
  const secret = `wf_${'s'.repeat(32)}`;
  for (const failure of ['queue', 'rate-limit']) {
    await assert.rejects(
      () => verifyModerationActivationDatabaseContracts({}, {
        async verifyQueueContract() {
          if (failure === 'queue') throw new Error(secret);
          return true;
        },
        async verifyRateLimitContract() {
          if (failure === 'rate-limit') throw new Error(secret);
          return true;
        },
      }),
      (error) => {
        assert.equal(error instanceof ModerationActivationDatabaseContractsError, true);
        assert.equal(error.message, 'moderation activation database contracts are unavailable');
        assert.equal(error.message.includes(secret), false);
        assert.equal(Object.hasOwn(error, 'cause'), false);
        return true;
      },
    );
  }

  await assert.rejects(
    () => verifyModerationActivationDatabaseContracts({}, {
      verifyQueueContract: null,
    }),
    ModerationActivationDatabaseContractsError,
  );
});
