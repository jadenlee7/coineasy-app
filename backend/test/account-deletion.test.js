import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  accountDeletionEnabled,
  AccountDeletionBlockedError,
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
const CLIENT_REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const TEST_ENV = Object.freeze({
  ACCOUNT_DELETION_ENABLED: 'true',
  ACCOUNT_DELETION_SUBJECT_HMAC_KEY: 'h'.repeat(32),
  ACCOUNT_DELETION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
});
const TEST_KEY_FINGERPRINT = accountDeletionSubjectKeyFingerprint(TEST_ENV);

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
  const handler = route.match(
    /meRouter\.get\('\/account-deletion'[\s\S]*?\n\}\)\);/u,
  )?.[0] || '';
  assert.match(handler, /findAccountDeletionRequest\(prisma, req\.user\.privyDid\)/u);
  assert.match(handler, /available: accountDeletionEnabled\(\) && !request/u);
  assert.doesNotMatch(handler, /if \(!accountDeletionEnabled\(\)\)/u);
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

function deletionDb({ user = { id: 'user_1' }, existingRequest = null } = {}) {
  const calls = [];
  let storedRequest = existingRequest;
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
        return storedRequest;
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
    user: {
      async findUnique(options) {
        calls.push(['user.findUnique', options]);
        return user;
      },
      async delete(options) {
        calls.push(['user.delete', options]);
        return user;
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
    clientRequestId: CLIENT_REQUEST_ID,
    env: TEST_ENV,
    now,
    allowFoundationExecution: true,
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
    calls.find(([name]) => name === 'user.delete')[1],
    { where: { id: 'user_1' } },
  );

  const created = calls.find(([name]) => name === 'request.create')[1];
  assert.equal(JSON.stringify(created).includes(PRIVY_DID), false);
  assert.match(created.subjectHash, /^[a-f0-9]{64}$/);
  assert.equal(created.privyDidCiphertext.includes(PRIVY_DID), false);
});

test('a missing local user still creates a provider-cleanup tombstone', async () => {
  const { calls, prisma } = deletionDb({ user: null });
  const result = await requestAccountDeletion({
    prisma,
    privyDid: PRIVY_DID,
    clientRequestId: CLIENT_REQUEST_ID,
    env: TEST_ENV,
    allowFoundationExecution: true,
  });

  assert.equal(result.state, 'LOCAL_PURGED');
  assert.equal(result.redactedPosts, 0);
  assert.equal(calls.some(([name]) => name === 'post.updateMany'), false);
  assert.equal(calls.some(([name]) => name === 'user.delete'), false);
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
    clientRequestId: CLIENT_REQUEST_ID,
    env: TEST_ENV,
    allowFoundationExecution: true,
  });

  assert.equal(result.requestId, existingRequest.id);
  assert.equal(result.created, false);
  assert.equal(calls.some(([name]) => name === 'request.create'), false);
  assert.equal(calls.some(([name]) => name === 'post.updateMany'), false);
  assert.equal(calls.some(([name]) => name === 'user.delete'), false);
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
