import assert from 'node:assert/strict';
import test from 'node:test';
import {
  exportLegacySocialData,
  exportLocalUserData,
} from '../src/lib/account-data.js';

test('local data export is versioned and excludes ephemeral SIWE secrets', async () => {
  let query;
  const prisma = {
    user: {
      findUnique: async (options) => {
        query = options;
        return { id: 'user_1', consent: null, ledger: [] };
      },
    },
  };
  const now = new Date('2026-07-21T12:00:00.000Z');
  const result = await exportLocalUserData(prisma, 'did:privy:test', now);

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.scope, 'easygo_local_database');
  assert.equal(result.exportedAt, now.toISOString());
  assert.deepEqual(query.where, { privyDid: 'did:privy:test' });
  assert.equal(query.select.siweNonceHash, undefined);
  assert.equal(query.select.siweNonceAddress, undefined);
  assert.equal(query.select.siweNonceExpiresAt, undefined);
  assert.equal(query.select.subname, true);
  assert.equal(query.select.subnameStatus, true);
  assert.equal(query.select.subnameChallengeHash, undefined);
  assert.equal(query.select.subnameChallengeExpiresAt, undefined);
  assert.deepEqual(query.select.stableProviderIdentities.select, {
    provider: true,
    context: true,
    keyVersion: true,
    createdAt: true,
  });
  assert.equal(
    query.select.stableProviderIdentities.select.providerIdentityHash,
    undefined,
  );
  assert.equal(
    query.select.stableProviderIdentities.select.keyFingerprint,
    undefined,
  );
  assert.equal(query.select.consent, true);
  assert.ok(query.select.questCompletions);
  assert.ok(query.select.segments);
});

test('legacy social export is purpose-specific and excludes identity and wallet data', async () => {
  let query;
  const prisma = {
    user: {
      findUnique: async (options) => {
        query = options;
        return {
          id: 'user_1',
          username: 'easygo',
          displayName: 'EasyGo',
          pfp: null,
          bio: 'Hello',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          posts: [{ id: 'post_1', body: 'Hello' }],
          likes: [{ postId: 'post_2', createdAt: new Date('2026-01-03T00:00:00.000Z') }],
          following: [{
            createdAt: new Date('2026-01-04T00:00:00.000Z'),
            followee: { id: 'user_2', username: 'friend', displayName: 'Friend', pfp: null },
          }],
          followers: [],
        };
      },
    },
  };
  const now = new Date('2026-07-21T12:00:00.000Z');
  const result = await exportLegacySocialData(prisma, 'did:privy:test', now);

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.scope, 'easygo_legacy_social');
  assert.equal(result.data.profile.username, 'easygo');
  assert.equal(result.data.following[0].user.username, 'friend');
  assert.equal(query.select.privyDid, undefined);
  assert.equal(query.select.walletAddress, undefined);
  assert.equal(query.select.verifiedAddress, undefined);
  assert.equal(query.select.consent, undefined);
  assert.equal(query.select.ledger, undefined);
  assert.equal(query.select.questCompletions, undefined);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('did:privy'), false);
  assert.equal(serialized.includes('wallet'), false);
});
