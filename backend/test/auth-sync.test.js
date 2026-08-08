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
  accountDeletionSubjectKeyFingerprint,
  deriveAppleStableProviderIdentity,
} from '../src/lib/account-deletion.js';
import { express4AsyncHandler } from '../src/lib/express-async.js';
import {
  createAuthSyncHandler,
} from '../src/routes/auth.js';

const DELETION_GUARD_ENV = Object.freeze({
  ACCOUNT_DELETION_ENABLED: 'false',
  ACCOUNT_DELETION_SUBJECT_HMAC_KEY: 'h'.repeat(32),
});
const DELETION_KEY_FINGERPRINT = accountDeletionSubjectKeyFingerprint(
  DELETION_GUARD_ENV,
  { required: true },
);

test('a new user receives one welcome bonus keyed by their user id', async () => {
  const creates = [];
  const prisma = {
    orangeLedger: {
      createMany: async (input) => {
        creates.push(input);
        return { count: 1 };
      },
    },
  };

  assert.equal(await awardWelcomeBonusOnce(prisma, {
    userId: 'user_1',
  }), true);
  assert.deepEqual(creates, [{
    data: [{
      userId: 'user_1',
      delta: WELCOME_ORANGE,
      reason: WELCOME_BONUS_REASON,
      refId: 'user_1',
    }],
    skipDuplicates: true,
  }]);
});

test('an existing user missing a welcome ledger row is repaired on sync', async () => {
  const creates = [];
  const prisma = {
    orangeLedger: {
      createMany: async (input) => {
        creates.push(input);
        return { count: 1 };
      },
    },
  };

  assert.equal(await awardWelcomeBonusOnce(prisma, {
    userId: 'user_existing',
  }), true);
  assert.equal(creates.length, 1);
  assert.equal(creates[0].data[0].refId, 'user_existing');
});

test('concurrent first sync unique conflicts are idempotent successes', async () => {
  const rows = [];
  const prisma = {
    orangeLedger: {
      createMany: async ({ data: [data], skipDuplicates }) => {
        await Promise.resolve();
        if (rows.some((row) => row.reason === data.reason && row.refId === data.refId)) {
          assert.equal(skipDuplicates, true);
          return { count: 0 };
        }
        rows.push(data);
        return { count: 1 };
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
      createMany: async () => {
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
        async createMany({ data: [data] }) {
          if (ledger.some((row) => row.reason === data.reason && row.refId === data.refId)) {
            return { count: 0 };
          }
          ledger.push(data);
          return { count: 1 };
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

function privyAppleUser({
  id = 'did:privy:apple-user',
  subject = 'apple-stable-subject',
} = {}) {
  return {
    id,
    linkedAccounts: [
      {
        type: 'apple_oauth',
        subject,
        email: 'relay-never-persist@example.com',
      },
      {
        type: 'wallet',
        chainType: 'ethereum',
        address: '0x0000000000000000000000000000000000000001',
      },
    ],
  };
}

function guardedAuthSyncDb({
  privyDid = 'did:privy:apple-user',
  existingUser = null,
  existingStableIdentities = [],
  providerTombstone = null,
} = {}) {
  const calls = [];
  const ledger = [];
  const user = existingUser || { id: 'easygo_user_guarded', privyDid };
  const tx = {
    async $queryRawUnsafe(_query, lockKey) {
      calls.push(['lock', lockKey]);
    },
    accountDeletionKeyRegistry: {
      async createMany(options) {
        calls.push(['registry.createMany', options]);
        return { count: 0 };
      },
      async findUnique(options) {
        calls.push(['registry.findUnique', options]);
        return { fingerprint: DELETION_KEY_FINGERPRINT };
      },
    },
    accountDeletionRequest: {
      async findUnique(options) {
        calls.push(['request.findUnique', options]);
        return null;
      },
    },
    accountDeletionProviderIdentity: {
      async findMany(options) {
        calls.push(['deletionIdentity.findMany', options]);
        return providerTombstone ? [{ request: providerTombstone }] : [];
      },
    },
    user: {
      async findUnique(options) {
        calls.push(['user.findUnique', options]);
        return existingUser ? { id: existingUser.id } : null;
      },
      async upsert(options) {
        calls.push(['user.upsert', options]);
        return user;
      },
    },
    userStableProviderIdentity: {
      async findMany(options) {
        calls.push(['liveIdentity.findMany', options]);
        return existingStableIdentities;
      },
      async create(options) {
        calls.push(['liveIdentity.create', options]);
        return { id: 'live_identity_1', ...options.data };
      },
    },
    orangeLedger: {
      async createMany({ data: [data] }) {
        calls.push(['ledger.createMany', data]);
        ledger.push(data);
        return { count: 1 };
      },
      async aggregate() {
        return { _sum: { delta: WELCOME_ORANGE } };
      },
    },
  };
  return {
    calls,
    db: { async $transaction(callback) { return callback(tx); } },
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

test('auth sync rejects a tombstoned subject before calling Privy', async () => {
  let providerCalls = 0;
  let tombstoneQuery;
  const response = responseDouble();
  const tx = {
    async $queryRawUnsafe() {},
    accountDeletionKeyRegistry: {
      async createMany() { return { count: 0 }; },
      async findUnique() {
        return { fingerprint: DELETION_KEY_FINGERPRINT };
      },
    },
    accountDeletionRequest: {
      async findUnique(options) {
        tombstoneQuery = options;
        return {
          id: 'deletion_1',
          state: 'LOCAL_PURGED',
          requestedAt: new Date(),
          localPurgedAt: new Date(),
          completedAt: null,
        };
      },
    },
  };
  const handler = createAuthSyncHandler({
    db: {
      async $transaction(callback) { return callback(tx); },
    },
    fetchPrivyUser: async () => {
      providerCalls += 1;
      return privyAppleUser();
    },
    env: DELETION_GUARD_ENV,
  });

  await handler({
    user: { privyDid: 'did:privy:apple-user' },
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 410);
  assert.deepEqual(response.body, { error: 'account_deletion_in_progress' });
  assert.equal(providerCalls, 0);
  assert.match(tombstoneQuery.where.subjectHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(tombstoneQuery).includes('did:privy'), false);
});

test('auth sync rechecks the tombstone under lock after the Privy lookup', async () => {
  let operationCalls = 0;
  let tombstoneChecks = 0;
  const response = responseDouble();
  const tx = {
    async $queryRawUnsafe() {},
    accountDeletionKeyRegistry: {
      async createMany() { return { count: 0 }; },
      async findUnique() {
        return { fingerprint: DELETION_KEY_FINGERPRINT };
      },
    },
    accountDeletionRequest: {
      async findUnique() {
        tombstoneChecks += 1;
        return tombstoneChecks === 1
          ? null
          : { id: 'deletion_race', state: 'REQUESTED' };
      },
    },
    accountDeletionProviderIdentity: {
      async findMany() { return []; },
    },
    user: {
      async findUnique() { operationCalls += 1; },
      async upsert() { operationCalls += 1; },
    },
  };
  const db = {
    async $transaction(callback) { return callback(tx); },
  };

  await createAuthSyncHandler({
    db,
    fetchPrivyUser: async () => privyAppleUser(),
    env: DELETION_GUARD_ENV,
  })({
    user: { privyDid: 'did:privy:apple-user' },
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(tombstoneChecks, 2);
  assert.equal(operationCalls, 0);
  assert.equal(response.statusCode, 410);
  assert.deepEqual(response.body, { error: 'account_deletion_in_progress' });
});

test('a new Privy DID carrying a tombstoned Apple subject is blocked', async () => {
  const newDid = 'did:privy:replacement-user';
  const providerTombstone = { id: 'deletion_apple', state: 'LOCAL_PURGED' };
  const { calls, db } = guardedAuthSyncDb({
    privyDid: newDid,
    providerTombstone,
  });
  const response = responseDouble();

  await createAuthSyncHandler({
    db,
    env: DELETION_GUARD_ENV,
    fetchPrivyUser: async () => privyAppleUser({ id: newDid }),
  })({
    user: { privyDid: newDid },
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 410);
  assert.deepEqual(response.body, { error: 'account_deletion_in_progress' });
  assert.equal(calls.some(([name]) => name === 'user.upsert'), false);
  assert.equal(calls.some(([name]) => name === 'ledger.createMany'), false);
  const lookup = calls.find(([name]) => name === 'deletionIdentity.findMany')[1];
  const serialized = JSON.stringify(lookup);
  assert.match(serialized, /providerIdentityHash/u);
  assert.equal(serialized.includes('apple-stable-subject'), false);
});

test('auth sync persists only the HMAC Apple identity binding', async () => {
  const { calls, db } = guardedAuthSyncDb();
  const response = responseDouble();
  await createAuthSyncHandler({
    db,
    env: DELETION_GUARD_ENV,
    fetchPrivyUser: async () => privyAppleUser(),
  })({
    user: { privyDid: 'did:privy:apple-user' },
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 200);
  const binding = calls.find(([name]) => name === 'liveIdentity.create')[1].data;
  assert.deepEqual(
    {
      provider: binding.provider,
      context: binding.context,
      providerIdentityHash: binding.providerIdentityHash,
    },
    deriveAppleStableProviderIdentity('apple-stable-subject', DELETION_GUARD_ENV),
  );
  const persistedCalls = JSON.stringify(calls.filter(([name]) => (
    name === 'user.upsert'
    || name === 'liveIdentity.create'
    || name === 'deletionIdentity.findMany'
  )));
  assert.equal(persistedCalls.includes('apple-stable-subject'), false);
  assert.equal(persistedCalls.includes('relay-never-persist@example.com'), false);
});

test('the dormant stable-identity latch keeps a new Google-only sync behavior-neutral', async () => {
  const { calls, db } = guardedAuthSyncDb({
    privyDid: 'did:privy:google-user',
  });
  const response = responseDouble();
  await createAuthSyncHandler({
    db,
    env: {
      ...DELETION_GUARD_ENV,
      NODE_ENV: 'production',
    },
    fetchPrivyUser: async () => ({
      id: 'did:privy:google-user',
      linkedAccounts: [{
        type: 'google_oauth',
        subject: 'google-subject-not-yet-supported',
        email: 'google@example.com',
      }],
    }),
  })({
    user: { privyDid: 'did:privy:google-user' },
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(calls.some(([name]) => name === 'user.upsert'), true);
  assert.equal(calls.some(([name]) => name === 'liveIdentity.create'), false);
});

test('conflicting Apple accounts fail before user or ledger writes', async () => {
  const { calls, db } = guardedAuthSyncDb();
  const response = responseDouble();
  await createAuthSyncHandler({
    db,
    env: DELETION_GUARD_ENV,
    fetchPrivyUser: async () => ({
      id: 'did:privy:apple-user',
      linkedAccounts: [
        { type: 'apple_oauth', subject: 'apple-a' },
        { type: 'apple_oauth', subject: 'apple-b' },
      ],
    }),
  })({
    user: { privyDid: 'did:privy:apple-user' },
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.body, { error: 'privy_unavailable' });
  assert.equal(calls.some(([name]) => name === 'user.upsert'), false);
  assert.equal(calls.some(([name]) => name === 'ledger.createMany'), false);
});

test('an existing Apple binding cannot be silently cleared by a provider snapshot', async () => {
  const storedIdentity = deriveAppleStableProviderIdentity(
    'apple-stable-subject',
    DELETION_GUARD_ENV,
  );
  const { calls, db } = guardedAuthSyncDb({
    existingUser: { id: 'easygo_user_guarded', privyDid: 'did:privy:apple-user' },
    existingStableIdentities: [storedIdentity],
  });
  const response = responseDouble();
  await createAuthSyncHandler({
    db,
    env: DELETION_GUARD_ENV,
    fetchPrivyUser: async () => ({
      id: 'did:privy:apple-user',
      linkedAccounts: [],
    }),
  })({
    user: { privyDid: 'did:privy:apple-user' },
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: 'account_deletion_guard_unavailable' });
  assert.equal(calls.some(([name]) => name === 'user.upsert'), false);
  assert.equal(calls.some(([name]) => name === 'ledger.createMany'), false);
});

test('auth sync fails closed when deletion is enabled without its hash key', async () => {
  let providerCalls = 0;
  const response = responseDouble();
  await createAuthSyncHandler({
    db: {},
    fetchPrivyUser: async () => {
      providerCalls += 1;
      return privyAppleUser();
    },
    env: { ACCOUNT_DELETION_ENABLED: 'true' },
  })({
    user: { privyDid: 'did:privy:apple-user' },
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: 'account_deletion_guard_unavailable' });
  assert.equal(providerCalls, 0);
});

test('production auth sync requires the deletion guard key even while deletion is off', async () => {
  let providerCalls = 0;
  const response = responseDouble();
  await createAuthSyncHandler({
    db: {},
    fetchPrivyUser: async () => {
      providerCalls += 1;
      return privyAppleUser();
    },
    env: { NODE_ENV: 'production', ACCOUNT_DELETION_ENABLED: 'false' },
  })({
    user: { privyDid: 'did:privy:apple-user' },
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: 'account_deletion_guard_unavailable' });
  assert.equal(providerCalls, 0);
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

test('Express 4 wrapper forwards rejected asynchronous work to error middleware', async () => {
  const databaseFailure = new Error('database temporarily unavailable');
  const wrapped = express4AsyncHandler(async () => { throw databaseFailure; });
  let forwarded = null;

  await wrapped({
    user: { privyDid: 'did:privy:apple-user' },
    log: { warn() {} },
  }, responseDouble(), (error) => {
    forwarded = error;
  });

  assert.equal(forwarded, databaseFailure);
});

test('a sync transaction failure is a deletion-guard outage, never fallback-safe', async () => {
  const databaseFailure = new Error('database temporarily unavailable');
  const { db } = authSyncDb({ failUpsert: databaseFailure });
  const response = responseDouble();
  await createAuthSyncHandler({
    db,
    fetchPrivyUser: async () => privyAppleUser(),
  })({
    user: { privyDid: 'did:privy:apple-user' },
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: 'account_deletion_guard_unavailable' });
});
