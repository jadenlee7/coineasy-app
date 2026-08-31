import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  API_AUTH_ERROR_CODES,
  ApiAuthBindingError,
  createApiAuthRegistry,
} from '../utils/apiAuth.mjs';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function hasCode(code) {
  return (error) => {
    assert.equal(error instanceof ApiAuthBindingError, true);
    assert.equal(error.code, code);
    return true;
  };
}

function accessTokenFor(subject) {
  const payload = Buffer.from(JSON.stringify({ sub: subject }), 'utf8').toString('base64url');
  return `header.${payload}.signature`;
}

test('ordinary auth remains backward-compatible and fail-soft without a bound owner', async () => {
  const diagnostics = [];
  const registry = createApiAuthRegistry({
    onOptionalProviderError: (error) => diagnostics.push(error.message),
  });

  assert.deepEqual(await registry.resolveOptionalAuthHeader(), {});

  registry.setTokenProvider(async () => 'ordinary-token');
  assert.deepEqual(await registry.resolveOptionalAuthHeader(), {
    Authorization: 'Bearer ordinary-token',
  });
  assert.equal(registry.bindingSnapshot().ownerUserId, null);

  registry.setTokenProvider(async () => null);
  assert.deepEqual(await registry.resolveOptionalAuthHeader(), {});

  registry.setTokenProvider(async () => {
    throw new Error('provider offline');
  });
  assert.deepEqual(await registry.resolveOptionalAuthHeader(), {});
  assert.deepEqual(diagnostics, ['provider offline']);
});

test('a destructive request receives a token only from its explicitly bound owner', async () => {
  const registry = createApiAuthRegistry();
  const ownerToken = accessTokenFor('privy:owner-a');
  registry.setTokenProvider(async () => ownerToken, 'privy:owner-a');

  assert.deepEqual(
    await registry.resolveBoundAuthHeader('privy:owner-a'),
    { Authorization: `Bearer ${ownerToken}` },
  );

  registry.setTokenProvider(async () => ownerToken, { userId: 'privy:owner-a' });
  assert.deepEqual(
    await registry.resolveBoundAuthHeader('privy:owner-a'),
    { Authorization: `Bearer ${ownerToken}` },
  );
});

test('an initial owner mismatch aborts before provider resolution or request dispatch', async () => {
  const registry = createApiAuthRegistry();
  let providerCalls = 0;
  let fetchCalls = 0;
  registry.setTokenProvider(async () => {
    providerCalls += 1;
    return 'wrong-owner-token';
  }, 'privy:owner-b');

  const destructiveDispatch = registry
    .resolveBoundAuthHeader('privy:owner-a')
    .then(() => {
      fetchCalls += 1;
    });

  await assert.rejects(
    destructiveDispatch,
    hasCode(API_AUTH_ERROR_CODES.OWNER_MISMATCH),
  );
  assert.equal(providerCalls, 0);
  assert.equal(fetchCalls, 0);
});

test('an account switch during token resolution aborts before request dispatch', async () => {
  const registry = createApiAuthRegistry();
  const tokenRead = deferred();
  let fetchCalls = 0;
  const provider = () => tokenRead.promise;

  registry.setTokenProvider(provider, 'privy:owner-a');
  const destructiveDispatch = registry
    .resolveBoundAuthHeader('privy:owner-a')
    .then(() => {
      fetchCalls += 1;
    });

  // Rebinding even the same provider changes its authenticated owner snapshot.
  registry.setTokenProvider(provider, 'privy:owner-b');
  tokenRead.resolve(accessTokenFor('privy:owner-a'));

  await assert.rejects(
    destructiveDispatch,
    hasCode(API_AUTH_ERROR_CODES.SESSION_CHANGED),
  );
  assert.equal(fetchCalls, 0);
});

test('destructive auth never degrades to an unauthenticated request', async () => {
  const registry = createApiAuthRegistry();

  await assert.rejects(
    registry.resolveBoundAuthHeader(),
    hasCode(API_AUTH_ERROR_CODES.EXPECTED_USER_REQUIRED),
  );

  await assert.rejects(
    registry.resolveBoundAuthHeader('privy:owner-a'),
    hasCode(API_AUTH_ERROR_CODES.PROVIDER_UNAVAILABLE),
  );

  registry.setTokenProvider(async () => null, 'privy:owner-a');
  await assert.rejects(
    registry.resolveBoundAuthHeader('privy:owner-a'),
    hasCode(API_AUTH_ERROR_CODES.TOKEN_UNAVAILABLE),
  );

  registry.setTokenProvider(async () => {
    throw new Error('token read failed');
  }, 'privy:owner-a');
  await assert.rejects(
    registry.resolveBoundAuthHeader('privy:owner-a'),
    hasCode(API_AUTH_ERROR_CODES.TOKEN_UNAVAILABLE),
  );

  registry.setTokenProvider(
    async () => accessTokenFor('privy:owner-b'),
    'privy:owner-a',
  );
  await assert.rejects(
    registry.resolveBoundAuthHeader('privy:owner-a'),
    hasCode(API_AUTH_ERROR_CODES.TOKEN_OWNER_MISMATCH),
  );
});

test('privacy exports, consent writes, and course rewards are owner-bound before fetch', async () => {
  const previousBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  const previousFetch = globalThis.fetch;
  process.env.EXPO_PUBLIC_BACKEND_URL = 'https://api.easygo.invalid';
  let fetchCalls = 0;
  let tokenProviderCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('fetch must not run for an owner mismatch');
  };

  try {
    const { api, setApiTokenProvider } = await import('../utils/api.js?owner-bound-test');
    setApiTokenProvider(
      async () => {
        tokenProviderCalls += 1;
        return accessTokenFor('privy:owner-b');
      },
      'privy:owner-b',
    );

    const attempts = [
      () => api.syncProfile({ expectedAuthUserId: 'privy:owner-a' }),
      () => api.me({ expectedAuthUserId: 'privy:owner-a' }),
      () => api.siweNonce('0x0000000000000000000000000000000000000000', {
        expectedAuthUserId: 'privy:owner-a',
      }),
      () => api.siweVerify({
        message: 'message',
        signature: 'signature',
        expectedAuthUserId: 'privy:owner-a',
      }),
      () => api.consent({ expectedAuthUserId: 'privy:owner-a' }),
      () => api.updateConsent({}, { expectedAuthUserId: 'privy:owner-a' }),
      () => api.exportMyData({ expectedAuthUserId: 'privy:owner-a' }),
      () => api.exportMySocialData({ expectedAuthUserId: 'privy:owner-a' }),
      () => api.registerPushToken({
        token: 'ExponentPushToken[test]',
        platform: 'ios',
        expectedAuthUserId: 'privy:owner-a',
      }),
      () => api.unregisterPushToken({
        token: 'ExponentPushToken[test]',
        expectedAuthUserId: 'privy:owner-a',
      }),
      () => api.accountDeletionStatus({ expectedAuthUserId: 'privy:owner-a' }),
      () => api.accountDeletionReauthChallenge({
        clientRequestId: 'request-id',
        expectedAuthUserId: 'privy:owner-a',
      }),
      () => api.accountDeletionReauthVerify({
        challengeId: 'challenge-id',
        clientRequestId: 'request-id',
        expectedAuthUserId: 'privy:owner-a',
      }),
      () => api.requestAccountDeletion({
        challengeId: 'challenge-id',
        clientRequestId: 'request-id',
        reauthProof: 'proof',
        expectedAuthUserId: 'privy:owner-a',
      }),
      () => api.subnameStatus({ expectedAuthUserId: 'privy:owner-a' }),
      () => api.subnameChallenge({ expectedAuthUserId: 'privy:owner-a' }),
      () => api.issueSubname({
        message: 'message',
        signature: 'signature',
        expectedAuthUserId: 'privy:owner-a',
      }),
      () => api.segments({ expectedAuthUserId: 'privy:owner-a' }),
      () => api.quests({ expectedAuthUserId: 'privy:owner-a' }),
      () => api.startQuest('quest-1', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.completeQuest('course-1', {}, {
        expectedAuthUserId: 'privy:owner-a',
      }),
      () => api.orangeBalance(null, { expectedAuthUserId: 'privy:owner-a' }),
      () => api.orangeHistory(null, { expectedAuthUserId: 'privy:owner-a' }),
      () => api.orangeRewardStatus({ expectedAuthUserId: 'privy:owner-a' }),
      () => api.orangeClaimFirstReward({ expectedAuthUserId: 'privy:owner-a' }),
      () => api.orangeClaimDailyCheckin({ expectedAuthUserId: 'privy:owner-a' }),
      () => api.orangeClaimCourseQuiz({
        courseId: 'course-1',
        sectionId: 'section-1',
        expectedAuthUserId: 'privy:owner-a',
      }),
      () => api.profiles.me({ expectedAuthUserId: 'privy:owner-a' }),
      () => api.profiles.updateMe({}, { expectedAuthUserId: 'privy:owner-a' }),
      () => api.profiles.get('user-1', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.profiles.byUsername('alice', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.profiles.search('ali', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.posts.feed({ expectedAuthUserId: 'privy:owner-a' }),
      () => api.posts.timeline('user-1', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.posts.get('post-1', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.posts.replies('post-1', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.posts.create({}, { expectedAuthUserId: 'privy:owner-a' }),
      () => api.posts.update('post-1', {}, { expectedAuthUserId: 'privy:owner-a' }),
      () => api.posts.remove('post-1', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.posts.report('post-1', 'SPAM', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.posts.like('post-1', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.posts.unlike('post-1', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.follows.follow('user-1', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.follows.unfollow('user-1', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.follows.status('user-1', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.follows.followers('user-1', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.follows.following('user-1', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.blocks.list({ expectedAuthUserId: 'privy:owner-a' }),
      () => api.blocks.block('user-1', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.blocks.unblock('user-1', { expectedAuthUserId: 'privy:owner-a' }),
      () => api.notifications.list({ expectedAuthUserId: 'privy:owner-a' }),
    ];
    for (const attempt of attempts) {
      await assert.rejects(
        attempt(),
        hasCode(API_AUTH_ERROR_CODES.OWNER_MISMATCH),
      );
    }
    assert.equal(fetchCalls, 0);
    assert.equal(tokenProviderCalls, 0);

    const publicRequests = [];
    globalThis.fetch = async (url, options) => {
      publicRequests.push({ url, options });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ rows: [] }),
      };
    };
    await api.socialStatus();
    assert.equal(publicRequests.length, 1);
    assert.equal(tokenProviderCalls, 0);
    for (const request of publicRequests) {
      assert.equal(request.options.headers.Authorization, undefined);
    }

    const apiSource = readFileSync(new URL('../utils/api.js', import.meta.url), 'utf8');
    assert.match(apiSource, /auth = false/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousBackendUrl === undefined) delete process.env.EXPO_PUBLIC_BACKEND_URL;
    else process.env.EXPO_PUBLIC_BACKEND_URL = previousBackendUrl;
  }
});
