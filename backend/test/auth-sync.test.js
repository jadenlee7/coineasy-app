import assert from 'node:assert/strict';
import test from 'node:test';
import {
  awardWelcomeBonusOnce,
  getOrangeBalance,
  WELCOME_BONUS_REASON,
  WELCOME_ORANGE,
} from '../src/lib/auth-sync.js';
import { PrivyConfigurationError } from '../src/lib/privy.js';
import {
  createAuthSyncHandler,
  express4AsyncHandler,
} from '../src/routes/auth.js';

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

test('an existing user missing a welcome ledger row is repaired on sync', async () => {
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
    userId: 'user_existing',
  }), true);
  assert.equal(creates.length, 1);
  assert.equal(creates[0].data.refId, 'user_existing');
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
    awardWelcomeBonusOnce(prisma, { userId: 'user_race' }),
    awardWelcomeBonusOnce(prisma, { userId: 'user_race' }),
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
    () => awardWelcomeBonusOnce(prisma, { userId: 'user_1' }),
    (error) => error === failure,
  );
});

test('Orange balance sums the final ledger state', async () => {
  const prisma = {
    orangeLedger: {
      aggregate: async (query) => {
        assert.deepEqual(query, {
          where: { userId: 'user_1' },
          _sum: { delta: true },
        });
        return { _sum: { delta: 135 } };
      },
    },
  };

  assert.equal(await getOrangeBalance(prisma, 'user_1'), 135);
});

function responseDouble() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function authSyncDb({ failUpsert = null, existingUser = true } = {}) {
  const ledger = [];
  const user = { id: 'easygo_user_1', privyDid: 'did:privy:apple-user' };
  return {
    ledger,
    db: {
      user: {
        async findUnique() {
          return existingUser ? { id: user.id } : null;
        },
        async upsert() {
          if (failUpsert) throw failUpsert;
          return user;
        },
      },
      orangeLedger: {
        async create({ data }) {
          if (ledger.some((row) => row.reason === data.reason && row.refId === data.refId)) {
            const error = new Error('unique welcome bonus');
            error.code = 'P2002';
            throw error;
          }
          ledger.push(data);
          return data;
        },
        async aggregate({ where }) {
          return {
            _sum: {
              delta: ledger
                .filter((row) => row.userId === where.userId)
                .reduce((total, row) => total + row.delta, 0),
            },
          };
        },
      },
    },
  };
}

function privyAppleUser() {
  return {
    id: 'did:privy:apple-user',
    linkedAccounts: [{
      type: 'wallet',
      chainType: 'ethereum',
      address: '0x0000000000000000000000000000000000000001',
    }],
  };
}

test('auth sync repairs a partial existing user and returns the final balance', async () => {
  const { db, ledger } = authSyncDb();
  const handler = createAuthSyncHandler({
    db,
    fetchPrivyUser: async () => privyAppleUser(),
  });
  const request = {
    user: { privyDid: 'did:privy:apple-user' },
    log: { warn() {} },
  };

  const first = responseDouble();
  await handler(request, first);
  assert.equal(first.statusCode, 200);
  assert.deepEqual(Object.keys(first.body).sort(), ['isNew', 'orangeBalance', 'user']);
  assert.equal(first.body.isNew, false);
  assert.equal(first.body.orangeBalance, WELCOME_ORANGE);
  assert.equal(ledger.length, 1);

  const retry = responseDouble();
  await handler(request, retry);
  assert.equal(retry.statusCode, 200);
  assert.equal(retry.body.orangeBalance, WELCOME_ORANGE);
  assert.equal(ledger.length, 1);
});

test('auth sync preserves the additive isNew response contract', async () => {
  const { db } = authSyncDb({ existingUser: false });
  const response = responseDouble();
  await createAuthSyncHandler({
    db,
    fetchPrivyUser: async () => privyAppleUser(),
  })({
    user: { privyDid: 'did:privy:apple-user' },
    log: { warn() {} },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.isNew, true);
  assert.equal(response.body.orangeBalance, WELCOME_ORANGE);
});

test('auth sync maps Privy lookup failures to safe 502 and 503 responses', async (t) => {
  const cases = [
    {
      name: 'upstream failure',
      failure: new Error('provider response contained sensitive details'),
      status: 502,
      code: 'privy_unavailable',
    },
    {
      name: 'server configuration failure',
      failure: new PrivyConfigurationError(),
      status: 503,
      code: 'privy_not_configured',
    },
    {
      name: 'upstream rejects invalid server credentials',
      failure: Object.assign(new Error('dashboard secret rejected'), { status: 401 }),
      status: 503,
      code: 'privy_not_configured',
    },
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      const response = responseDouble();
      const handler = createAuthSyncHandler({
        db: {},
        fetchPrivyUser: async () => { throw item.failure; },
      });
      await handler({
        user: { privyDid: 'did:privy:apple-user' },
        log: { warn() {} },
      }, response);

      assert.equal(response.statusCode, item.status);
      assert.deepEqual(response.body, { error: item.code });
      assert.equal(JSON.stringify(response.body).includes('sensitive'), false);
    });
  }
});

test('Express 4 wrapper forwards rejected auth sync work to error middleware', async () => {
  const databaseFailure = new Error('database temporarily unavailable');
  const { db } = authSyncDb({ failUpsert: databaseFailure });
  const wrapped = express4AsyncHandler(createAuthSyncHandler({
    db,
    fetchPrivyUser: async () => privyAppleUser(),
  }));
  let forwarded = null;

  await wrapped({
    user: { privyDid: 'did:privy:apple-user' },
    log: { warn() {} },
  }, responseDouble(), (error) => {
    forwarded = error;
  });

  assert.equal(forwarded, databaseFailure);
});
