import assert from 'node:assert/strict';
import test from 'node:test';
import {
  awardWelcomeBonusOnce,
  WELCOME_BONUS_REASON,
  WELCOME_ORANGE,
} from '../src/lib/auth-sync.js';

test('a new user receives one welcome bonus keyed by their user id', async () => {
  const creates = [];
  const prisma = {
    orangeLedger: {
      create: async (input) => {
        creates.push(input);
        return input.data;
      },
    },
  };

  assert.equal(await awardWelcomeBonusOnce(prisma, {
    userId: 'user_1',
    isNewUser: true,
  }), true);
  assert.deepEqual(creates, [{
    data: {
      userId: 'user_1',
      delta: WELCOME_ORANGE,
      reason: WELCOME_BONUS_REASON,
      refId: 'user_1',
    },
  }]);
});

test('an existing user is never granted a welcome bonus again', async () => {
  let createCalls = 0;
  const prisma = {
    orangeLedger: {
      create: async () => {
        createCalls += 1;
      },
    },
  };

  assert.equal(await awardWelcomeBonusOnce(prisma, {
    userId: 'user_existing',
    isNewUser: false,
  }), false);
  assert.equal(createCalls, 0);
});

test('concurrent first sync unique conflicts are idempotent successes', async () => {
  const rows = [];
  const prisma = {
    orangeLedger: {
      create: async ({ data }) => {
        await Promise.resolve();
        if (rows.some((row) => row.reason === data.reason && row.refId === data.refId)) {
          const error = new Error('Unique constraint failed');
          error.code = 'P2002';
          throw error;
        }
        rows.push(data);
        return data;
      },
    },
  };

  const results = await Promise.all([
    awardWelcomeBonusOnce(prisma, { userId: 'user_race', isNewUser: true }),
    awardWelcomeBonusOnce(prisma, { userId: 'user_race', isNewUser: true }),
  ]);

  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].refId, 'user_race');
});

test('non-unique ledger failures still reject the sync operation', async () => {
  const failure = new Error('database unavailable');
  const prisma = {
    orangeLedger: {
      create: async () => {
        throw failure;
      },
    },
  };

  await assert.rejects(
    () => awardWelcomeBonusOnce(prisma, { userId: 'user_1', isNewUser: true }),
    (error) => error === failure,
  );
});
