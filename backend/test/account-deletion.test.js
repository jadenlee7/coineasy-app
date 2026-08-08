import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  accountDeletionEnabled,
  AccountDeletionBlockedError,
  acquireAccountDeletionLocks,
  deriveAppleStableProviderIdentity,
  deriveStableProviderIdentity,
  accountDeletionSubjectHash,
  accountDeletionSubjectKeyFingerprint,
  decryptAccountDeletionSubject,
  encryptAccountDeletionSubject,
  findAccountDeletionRequest,
  redactOwnedPost,
  requestAccountDeletion,
  runWithAccountDeletionGuard,
} from '../src/lib/account-deletion.js';

const PRIVY_DID = 'did:privy:account-to-delete';
const APPLE_SUBJECT = 'apple-stable-subject';
const CLIENT_REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const TEST_ENV = Object.freeze({
  ACCOUNT_DELETION_ENABLED: 'true',
  ACCOUNT_DELETION_SUBJECT_HMAC_KEY: 'h'.repeat(32),
  ACCOUNT_DELETION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
});
const TEST_KEY_FINGERPRINT = accountDeletionSubjectKeyFingerprint(TEST_ENV);
const TEST_APPLE_IDENTITY = deriveAppleStableProviderIdentity(APPLE_SUBJECT, TEST_ENV);
const TEST_RECENT_AUTH_INPUT = Object.freeze({
  recentAuth: Object.freeze({
    sessionId: 'session_recent_auth',
    challengeId: 'challenge_recent_auth',
    reauthProof: 'proof_recent_auth',
  }),
  consumeRecentAuth: async () => {},
});

test('the foundation release brake keeps destructive deletion disabled', () => {
  assert.equal(accountDeletionEnabled({}), false);
  assert.equal(accountDeletionEnabled({ ACCOUNT_DELETION_ENABLED: 'false' }), false);
  assert.equal(accountDeletionEnabled({ ACCOUNT_DELETION_ENABLED: 'TRUE' }), false);
});

test('the status route never hides a tombstone behind the activation brake', () => {
  const route = readFileSync(
    new URL('../src/routes/me.js', import.meta.url),
    'utf8',
  );
  assert.match(route, /export function createAccountDeletionStatusHandler/u);
  assert.match(route, /findDeletionRequest\(db, req\.user\.privyDid, env\)/u);
  assert.match(route, /if \(request\)/u);
  assert.match(route, /deletionCapability\(env\)/u);
});

test('subject lookup is deterministic and provider identity encryption is authenticated', () => {
  const subjectHash = accountDeletionSubjectHash(PRIVY_DID, TEST_ENV);
  assert.match(subjectHash, /^[a-f0-9]{64}$/);
  assert.equal(accountDeletionSubjectHash(PRIVY_DID, TEST_ENV), subjectHash);
  assert.equal(subjectHash.includes(PRIVY_DID), false);

  const encrypted = encryptAccountDeletionSubject(PRIVY_DID, subjectHash, TEST_ENV, {
    bytes: (length) => Buffer.alloc(length, 9),
  });
  assert.equal(encrypted.includes(PRIVY_DID), false);
  assert.equal(decryptAccountDeletionSubject(encrypted, subjectHash, TEST_ENV), PRIVY_DID);
  assert.throws(
    () => decryptAccountDeletionSubject(`${encrypted.slice(0, -1)}x`, subjectHash, TEST_ENV),
    /account_deletion_ciphertext_invalid/,
  );
});

test('stable provider HMACs are deterministic and domain separated', () => {
  const apple = deriveAppleStableProviderIdentity(APPLE_SUBJECT, TEST_ENV);
  const same = deriveAppleStableProviderIdentity(APPLE_SUBJECT, TEST_ENV);
  const otherContext = deriveStableProviderIdentity({
    provider: 'apple_oauth',
    context: 'signin-with-apple.subject.v2',
    subject: APPLE_SUBJECT,
  }, TEST_ENV);
  const otherProvider = deriveStableProviderIdentity({
    provider: 'google_oauth',
    context: 'google-openid.subject.v1',
    subject: APPLE_SUBJECT,
  }, TEST_ENV);

  assert.deepEqual(apple, same);
  assert.match(apple.providerIdentityHash, /^[a-f0-9]{64}$/);
  assert.notEqual(apple.providerIdentityHash, accountDeletionSubjectHash(APPLE_SUBJECT, TEST_ENV));
  assert.notEqual(apple.providerIdentityHash, otherContext.providerIdentityHash);
  assert.notEqual(apple.providerIdentityHash, otherProvider.providerIdentityHash);
  assert.equal(JSON.stringify(apple).includes(APPLE_SUBJECT), false);
});

test('combined deletion locks are deduplicated and globally deterministic', async () => {
  const googleIdentity = deriveStableProviderIdentity({
    provider: 'google_oauth',
    context: 'google-openid.subject.v1',
    subject: 'google-stable-subject',
  }, TEST_ENV);
  const captureLocks = () => {
    const lockKeys = [];
    return {
      lockKeys,
      tx: {
        async $queryRawUnsafe(_query, lockKey) {
          lockKeys.push(lockKey);
        },
      },
    };
  };
  const first = captureLocks();
  const reversed = captureLocks();
  const subjectHash = accountDeletionSubjectHash(PRIVY_DID, TEST_ENV);
  await acquireAccountDeletionLocks(first.tx, subjectHash, [
    TEST_APPLE_IDENTITY,
    googleIdentity,
    TEST_APPLE_IDENTITY,
  ]);
  await acquireAccountDeletionLocks(reversed.tx, subjectHash, [
    googleIdentity,
    TEST_APPLE_IDENTITY,
  ]);
  assert.deepEqual(first.lockKeys, [...new Set(first.lockKeys)].sort());
  assert.deepEqual(reversed.lockKeys, first.lockKeys);
  assert.equal(first.lockKeys.length, 3);
  assert.ok(first.lockKeys.includes(subjectHash));
  assert.ok(first.lockKeys.some((value) => value.startsWith('provider:apple_oauth:')));
});

function deletionDb({
  user = {
    id: 'user_1',
    privyDid: PRIVY_DID,
    stableProviderIdentities: [TEST_APPLE_IDENTITY],
  },
  users = null,
  existingRequest = null,
  existingProviderIdentity = null,
} = {}) {
  const calls = [];
  let storedRequest = existingRequest
    ? {
      subjectHash: accountDeletionSubjectHash(PRIVY_DID, TEST_ENV),
      ...existingRequest,
    }
    : null;
  let storedProviderIdentity = existingProviderIdentity;
  const tx = {
    async $queryRawUnsafe(query, subjectHash) {
      calls.push(['lock', query, subjectHash]);
      return [];
    },
    accountDeletionKeyRegistry: {
      async createMany(options) {
        calls.push(['registry.createMany', options]);
        return { count: 1 };
      },
      async findUnique(options) {
        calls.push(['registry.findUnique', options]);
        return { fingerprint: TEST_KEY_FINGERPRINT };
      },
    },
    accountDeletionRequest: {
      async findUnique({ where }) {
        calls.push(['request.findUnique', where]);
        return storedRequest?.subjectHash === where.subjectHash
          ? storedRequest
          : null;
      },
      async create({ data }) {
        calls.push(['request.create', data]);
        storedRequest = {
          id: 'deletion_1',
          requestedAt: new Date('2026-08-02T10:00:00.000Z'),
          localPurgedAt: null,
          completedAt: null,
          ...data,
        };
        return storedRequest;
      },
      async update({ where, data }) {
        calls.push(['request.update', where, data]);
        storedRequest = {
          ...storedRequest,
          ...data,
          stateVersion: (storedRequest.stateVersion || 0) + 1,
        };
        return storedRequest;
      },
    },
    accountDeletionProviderIdentity: {
      async findMany(options) {
        calls.push(['providerIdentity.findMany', options]);
        if (!storedProviderIdentity) return [];
        if (options.select?.request) {
          return [{ request: storedRequest }];
        }
        return [storedProviderIdentity];
      },
      async create({ data }) {
        calls.push(['providerIdentity.create', data]);
        storedProviderIdentity = { id: 'provider_identity_1', ...data };
        return storedProviderIdentity;
      },
    },
    user: {
      async findUnique(options) {
        calls.push(['user.findUnique', options]);
        const candidates = users || (user ? [user] : []);
        return candidates.find((candidate) => (
          candidate.privyDid === options.where.privyDid
        )) || null;
      },
      async findMany(options) {
        calls.push(['user.findMany', options]);
        if (users) return users;
        return user ? [user] : [];
      },
      async deleteMany(options) {
        calls.push(['user.deleteMany', options]);
        return { count: users?.length ?? (user ? 1 : 0) };
      },
    },
    post: {
      async updateMany(options) {
        calls.push(['post.updateMany', options]);
        return { count: 2 };
      },
    },
  };
  return {
    calls,
    prisma: { $transaction: async (callback) => callback(tx) },
    storedRequest: () => storedRequest,
    tx,
  };
}

test('local purge redacts only the owner posts and preserves every reply row', async () => {
  const now = new Date('2026-08-02T12:00:00.000Z');
  const { calls, prisma } = deletionDb();
  const result = await requestAccountDeletion({
    prisma,
    privyDid: PRIVY_DID,
    appleSubject: APPLE_SUBJECT,
    clientRequestId: CLIENT_REQUEST_ID,
    env: TEST_ENV,
    now,
    allowFoundationExecution: true,
    ...TEST_RECENT_AUTH_INPUT,
  });

  assert.deepEqual(result, {
    requestId: 'deletion_1',
    state: 'LOCAL_PURGED',
    created: true,
    localDataDeleted: true,
    providerDeletionPending: true,
    redactedPosts: 2,
  });
  const redaction = calls.find(([name]) => name === 'post.updateMany');
  assert.deepEqual(redaction[1], {
    where: { authorId: 'user_1' },
    data: {
      authorId: null,
      body: '',
      mediaUrl: null,
      deletedAt: now,
    },
  });
  assert.equal(calls.some(([name]) => name === 'post.deleteMany'), false);
  assert.equal(calls.some(([name]) => name === 'post.delete'), false);
  assert.deepEqual(
    calls.find(([name]) => name === 'user.deleteMany')[1],
    { where: { id: { in: ['user_1'] } } },
  );

  const created = calls.find(([name]) => name === 'request.create')[1];
  assert.equal(JSON.stringify(created).includes(PRIVY_DID), false);
  assert.match(created.subjectHash, /^[a-f0-9]{64}$/);
  assert.equal(created.privyDidCiphertext.includes(PRIVY_DID), false);
  const providerIdentity = calls.find(([name]) => name === 'providerIdentity.create')[1];
  assert.deepEqual(
    {
      provider: providerIdentity.provider,
      context: providerIdentity.context,
      providerIdentityHash: providerIdentity.providerIdentityHash,
    },
    TEST_APPLE_IDENTITY,
  );
  assert.equal(JSON.stringify(calls).includes(APPLE_SUBJECT), false);
  assert.ok(
    calls.findIndex(([name]) => name === 'providerIdentity.create')
      < calls.findIndex(([name]) => name === 'post.updateMany'),
  );
});

test('a new deletion atomically consumes recent auth before creating its tombstone', async () => {
  const { calls, prisma, tx } = deletionDb();
  const recentAuth = {
    sessionId: 'session_recent_auth',
    challengeId: 'challenge_recent_auth',
    reauthProof: 'proof_recent_auth',
  };

  const result = await requestAccountDeletion({
    prisma,
    privyDid: PRIVY_DID,
    appleSubject: APPLE_SUBJECT,
    clientRequestId: CLIENT_REQUEST_ID,
    recentAuth,
    consumeRecentAuth: async (actualTx, input) => {
      assert.equal(actualTx, tx);
      calls.push(['reauth.consume', input]);
    },
    env: TEST_ENV,
    allowFoundationExecution: true,
  });

  assert.equal(result.localDataDeleted, true);
  const consumeIndex = calls.findIndex(([name]) => name === 'reauth.consume');
  const createIndex = calls.findIndex(([name]) => name === 'request.create');
  const purgeIndex = calls.findIndex(([name]) => name === 'post.updateMany');
  assert.ok(consumeIndex >= 0);
  assert.ok(consumeIndex < createIndex);
  assert.ok(createIndex < purgeIndex);
  const consumeInput = calls[consumeIndex][1];
  assert.equal(consumeInput.privyDid, PRIVY_DID);
  assert.equal(consumeInput.clientRequestId, CLIENT_REQUEST_ID);
  assert.equal(consumeInput.challengeId, recentAuth.challengeId);
  assert.equal(consumeInput.reauthProof, recentAuth.reauthProof);
  assert.deepEqual(consumeInput.stableProviderIdentity, TEST_APPLE_IDENTITY);
  const created = calls[createIndex][1];
  assert.equal(created.recentAuthChallengeId, recentAuth.challengeId);
});

test('a recent-auth consumption failure rolls back before tombstone or purge mutations', async () => {
  const { calls, prisma } = deletionDb();

  await assert.rejects(
    () => requestAccountDeletion({
      prisma,
      privyDid: PRIVY_DID,
      appleSubject: APPLE_SUBJECT,
      clientRequestId: CLIENT_REQUEST_ID,
      recentAuth: {
        sessionId: 'session_recent_auth',
        challengeId: 'challenge_recent_auth',
        reauthProof: 'wrong_proof',
      },
      consumeRecentAuth: async () => {
        throw new Error('account_deletion_reauth_invalid');
      },
      env: TEST_ENV,
      allowFoundationExecution: true,
    }),
    /account_deletion_reauth_invalid/,
  );

  assert.equal(calls.some(([name]) => name === 'request.create'), false);
  assert.equal(calls.some(([name]) => name === 'providerIdentity.create'), false);
  assert.equal(calls.some(([name]) => name === 'post.updateMany'), false);
  assert.equal(calls.some(([name]) => name === 'user.deleteMany'), false);
});

test('a committed tombstone recovery never consumes a second recent-auth proof', async () => {
  const { prisma } = deletionDb({
    existingRequest: {
      id: 'deletion_existing',
      state: 'LOCAL_PURGED',
      subjectHashKeyFingerprint: TEST_KEY_FINGERPRINT,
      localPurgedAt: new Date('2026-08-02T12:00:00.000Z'),
      completedAt: null,
    },
  });
  let consumeCalls = 0;

  const result = await requestAccountDeletion({
    prisma,
    privyDid: PRIVY_DID,
    appleSubject: APPLE_SUBJECT,
    clientRequestId: CLIENT_REQUEST_ID,
    consumeRecentAuth: async () => { consumeCalls += 1; },
    env: TEST_ENV,
    allowFoundationExecution: true,
  });

  assert.equal(result.requestId, 'deletion_existing');
  assert.equal(consumeCalls, 0);
});

test('a missing or legacy-unmapped local user cannot consume proof or purge', async () => {
  const { calls, prisma } = deletionDb({ user: null });
  await assert.rejects(
    () => requestAccountDeletion({
      prisma,
      privyDid: PRIVY_DID,
      appleSubject: APPLE_SUBJECT,
      clientRequestId: CLIENT_REQUEST_ID,
      env: TEST_ENV,
      allowFoundationExecution: true,
      ...TEST_RECENT_AUTH_INPUT,
    }),
    /stable_provider_identity_missing/,
  );
  assert.equal(calls.some(([name]) => name === 'request.create'), false);
  assert.equal(calls.some(([name]) => name === 'post.updateMany'), false);
  assert.equal(calls.some(([name]) => name === 'user.deleteMany'), false);
});

test('an existing legacy user without an Apple mapping also fails before proof consumption', async () => {
  const { calls, prisma } = deletionDb({
    user: { id: 'legacy_user', privyDid: PRIVY_DID, stableProviderIdentities: [] },
  });
  let consumeCalls = 0;
  await assert.rejects(
    () => requestAccountDeletion({
      prisma,
      privyDid: PRIVY_DID,
      appleSubject: APPLE_SUBJECT,
      clientRequestId: CLIENT_REQUEST_ID,
      recentAuth: TEST_RECENT_AUTH_INPUT.recentAuth,
      consumeRecentAuth: async () => { consumeCalls += 1; },
      env: TEST_ENV,
      allowFoundationExecution: true,
    }),
    /stable_provider_identity_missing/,
  );
  assert.equal(consumeCalls, 0);
  assert.equal(calls.some(([name]) => name === 'request.create'), false);
  assert.equal(calls.some(([name]) => name === 'post.updateMany'), false);
});

test('a relinked Apple subject cannot replace the local deletion identity binding', async () => {
  const originalIdentity = deriveAppleStableProviderIdentity('original-apple-subject', TEST_ENV);
  const { calls, prisma } = deletionDb({
    user: {
      id: 'user_1',
      privyDid: PRIVY_DID,
      stableProviderIdentities: [originalIdentity],
    },
  });

  await assert.rejects(
    () => requestAccountDeletion({
      prisma,
      privyDid: PRIVY_DID,
      appleSubject: APPLE_SUBJECT,
      clientRequestId: CLIENT_REQUEST_ID,
      env: TEST_ENV,
      allowFoundationExecution: true,
      ...TEST_RECENT_AUTH_INPUT,
    }),
    /stable_provider_identity_conflict/,
  );
  assert.equal(calls.some(([name]) => name === 'request.create'), false);
  assert.equal(calls.some(([name]) => name === 'post.updateMany'), false);
});

test('repeated deletion requests return the durable request without purging twice', async () => {
  const existingRequest = {
    id: 'deletion_existing',
    state: 'LOCAL_PURGED',
    subjectHashKeyFingerprint: TEST_KEY_FINGERPRINT,
    localPurgedAt: new Date('2026-08-02T12:00:00.000Z'),
    completedAt: null,
  };
  const { calls, prisma } = deletionDb({ existingRequest });
  const result = await requestAccountDeletion({
    prisma,
    privyDid: PRIVY_DID,
    appleSubject: APPLE_SUBJECT,
    clientRequestId: CLIENT_REQUEST_ID,
    env: TEST_ENV,
    allowFoundationExecution: true,
    ...TEST_RECENT_AUTH_INPUT,
  });

  assert.equal(result.requestId, existingRequest.id);
  assert.equal(result.created, false);
  assert.equal(calls.some(([name]) => name === 'request.create'), false);
  assert.equal(calls.some(([name]) => name === 'post.updateMany'), false);
  assert.equal(calls.some(([name]) => name === 'user.deleteMany'), false);
});

test('a same-Apple cross-DID race records manual review before any local purge', async () => {
  const secondDid = 'did:privy:race-winner';
  const { calls, prisma } = deletionDb({
    users: [
      {
        id: 'user_a',
        privyDid: PRIVY_DID,
        stableProviderIdentities: [TEST_APPLE_IDENTITY],
      },
      {
        id: 'user_b',
        privyDid: secondDid,
        stableProviderIdentities: [TEST_APPLE_IDENTITY],
      },
    ],
  });

  const result = await requestAccountDeletion({
    prisma,
    privyDid: PRIVY_DID,
    appleSubject: APPLE_SUBJECT,
    clientRequestId: CLIENT_REQUEST_ID,
    env: TEST_ENV,
    allowFoundationExecution: true,
    ...TEST_RECENT_AUTH_INPUT,
  });
  assert.equal(result.state, 'MANUAL_REVIEW');
  assert.equal(result.localDataDeleted, false);
  assert.equal(calls.some(([name]) => name === 'request.create'), true);
  assert.equal(calls.some(([name]) => name === 'providerIdentity.create'), true);
  assert.equal(
    calls.find(([name]) => name === 'request.update')[2].state,
    'MANUAL_REVIEW',
  );
  assert.equal(calls.some(([name]) => name === 'post.updateMany'), false);
  assert.equal(calls.some(([name]) => name === 'user.deleteMany'), false);
});

test('an old completed provider tombstone never reports a different DID as deleted', async () => {
  const secondDid = 'did:privy:recreated-user';
  const existingRequest = {
    id: 'deletion_old',
    state: 'COMPLETED',
    localPurgedAt: new Date('2026-08-02T12:00:00.000Z'),
    completedAt: new Date('2026-08-02T12:05:00.000Z'),
  };
  const { calls, prisma } = deletionDb({
    existingRequest,
    existingProviderIdentity: {
      accountDeletionRequestId: existingRequest.id,
      ...TEST_APPLE_IDENTITY,
    },
    users: [{
      id: 'user_b',
      privyDid: secondDid,
      stableProviderIdentities: [TEST_APPLE_IDENTITY],
    }],
  });

  await assert.rejects(
    () => requestAccountDeletion({
      prisma,
      privyDid: secondDid,
      appleSubject: APPLE_SUBJECT,
      clientRequestId: CLIENT_REQUEST_ID,
      env: TEST_ENV,
      allowFoundationExecution: true,
    }),
    /stable_provider_identity_component_conflict/,
  );
  assert.equal(calls.some(([name]) => name === 'post.updateMany'), false);
  assert.equal(calls.some(([name]) => name === 'user.deleteMany'), false);
});

test('initial deletion refuses to purge without a stable provider identity', async () => {
  let transactionCalls = 0;
  await assert.rejects(
    () => requestAccountDeletion({
      prisma: {
        async $transaction() {
          transactionCalls += 1;
        },
      },
      privyDid: PRIVY_DID,
      clientRequestId: CLIENT_REQUEST_ID,
      env: TEST_ENV,
      allowFoundationExecution: true,
    }),
    /stable_provider_identity_required/,
  );
  assert.equal(transactionCalls, 0);
});

test('ordinary post deletion redacts one owned node instead of deleting its replies', async () => {
  let mutation;
  const prisma = {
    post: {
      async updateMany(options) {
        mutation = options;
        return { count: 1 };
      },
    },
  };
  const now = new Date('2026-08-02T12:00:00.000Z');
  assert.equal(await redactOwnedPost(prisma, {
    postId: 'post_1',
    authorId: 'user_1',
    now,
  }), true);
  assert.deepEqual(mutation, {
    where: { id: 'post_1', authorId: 'user_1', deletedAt: null },
    data: { authorId: null, body: '', mediaUrl: null, deletedAt: now },
  });
});

test('a tombstone blocks guarded writes after the shared advisory lock', async () => {
  const subjectHash = accountDeletionSubjectHash(PRIVY_DID, TEST_ENV);
  const calls = [];
  const tx = {
    async $queryRawUnsafe(_query, actualHash) {
      calls.push(['lock', actualHash]);
    },
    accountDeletionKeyRegistry: {
      async createMany() {
        calls.push(['registry.createMany']);
        return { count: 0 };
      },
      async findUnique() {
        calls.push(['registry.findUnique']);
        return { fingerprint: TEST_KEY_FINGERPRINT };
      },
    },
    accountDeletionRequest: {
      async findUnique({ where }) {
        calls.push(['find', where]);
        return { id: 'deletion_1', state: 'LOCAL_PURGED' };
      },
    },
  };
  const prisma = { $transaction: async (callback) => callback(tx) };
  let ran = false;

  await assert.rejects(
    () => runWithAccountDeletionGuard({
      prisma,
      privyDid: PRIVY_DID,
      env: TEST_ENV,
      operation: async () => { ran = true; },
    }),
    (error) => error instanceof AccountDeletionBlockedError,
  );
  assert.equal(ran, false);
  assert.deepEqual(calls, [
    ['registry.createMany'],
    ['registry.findUnique'],
    ['lock', subjectHash],
    ['find', { subjectHash }],
  ]);
});

test('tombstone lookup never queries by raw provider identity', async () => {
  let query;
  const tx = {
    async $queryRawUnsafe() {},
    accountDeletionKeyRegistry: {
      async createMany() { return { count: 0 }; },
      async findUnique() { return { fingerprint: TEST_KEY_FINGERPRINT }; },
    },
    accountDeletionRequest: {
      async findUnique(options) {
        query = options;
        return null;
      },
    },
  };
  const prisma = { async $transaction(callback) { return callback(tx); } };
  await findAccountDeletionRequest(prisma, PRIVY_DID, TEST_ENV);
  assert.match(query.where.subjectHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(query).includes(PRIVY_DID), false);
});

test('schema and migration enforce nullable redacted authors with a durable tombstone', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  const migration = readFileSync(
    new URL('../prisma/migrations/20260802120000_safe_account_deletion/migration.sql', import.meta.url),
    'utf8',
  );
  const stableIdentityMigration = readFileSync(
    new URL(
      '../prisma/migrations/20260808120000_stable_provider_deletion_identity/migration.sql',
      import.meta.url,
    ),
    'utf8',
  );

  assert.match(schema, /authorId\s+String\?/);
  assert.match(schema, /author\s+User\?.*onDelete: SetNull/);
  assert.match(schema, /model AccountDeletionRequest/);
  assert.match(schema, /model AccountDeletionKeyRegistry/);
  const requestModel = schema.match(/model AccountDeletionRequest \{([\s\S]*?)\n\}/u)?.[1] || '';
  assert.doesNotMatch(requestModel, /\buser\s+User\??\b/);
  assert.match(migration, /Post_deleted_redacted_check/);
  assert.match(migration, /ON DELETE SET NULL/);
  assert.match(migration, /AccountDeletionRequest_subjectHash_key/);
  assert.match(migration, /subjectHashKeyFingerprint/);
  assert.match(migration, /AccountDeletionRequest_subject_key_fkey/);
  assert.match(schema, /model UserStableProviderIdentity/);
  assert.match(schema, /model AccountDeletionProviderIdentity/);
  assert.match(schema, /providerIdentityHash\s+String\s+@db\.Char\(64\)/);
  assert.doesNotMatch(stableIdentityMigration, /"email"/i);
  assert.match(stableIdentityMigration, /uniq_user_stable_provider_identity/);
  assert.match(stableIdentityMigration, /uniq_deletion_stable_provider_identity/);
  assert.match(stableIdentityMigration, /AccountDeletionProviderIdentity_immutable/);
  assert.match(stableIdentityMigration, /BEFORE UPDATE OR DELETE/);
  assert.match(stableIdentityMigration, /AccountDeletionRequest_attemptCount_nonnegative_check/);
  assert.match(stableIdentityMigration, /AccountDeletionRequest_lease_pair_check/);
  assert.match(stableIdentityMigration, /AccountDeletionRequest_completed_ciphertext_cleared_check/);
});

test('a changed HMAC key fails closed before tombstone lookup', async () => {
  let lookupRan = false;
  const tx = {
    async $queryRawUnsafe() {},
    accountDeletionKeyRegistry: {
      async createMany() { return { count: 0 }; },
      async findUnique() {
        return { fingerprint: TEST_KEY_FINGERPRINT };
      },
    },
    accountDeletionRequest: {
      async findUnique() {
        lookupRan = true;
        return null;
      },
    },
  };
  const prisma = { async $transaction(callback) { return callback(tx); } };
  await assert.rejects(
    () => findAccountDeletionRequest(prisma, PRIVY_DID, {
      ...TEST_ENV,
      ACCOUNT_DELETION_SUBJECT_HMAC_KEY: 'x'.repeat(32),
    }),
    /account_deletion_hash_key_mismatch/,
  );
  assert.equal(lookupRan, false);
});
