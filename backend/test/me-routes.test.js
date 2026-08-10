import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accountDeletionSubjectHash,
  DELETE_ACCOUNT_CONFIRMATION,
  deriveAppleStableProviderIdentity,
} from '../src/lib/account-deletion.js';
import { PrivyConfigurationError } from '../src/lib/privy.js';
import { AccountDeletionReauthError } from '../src/lib/account-deletion-reauth.js';
import {
  createAccountDeletionReauthChallengeHandler,
  createAccountDeletionReauthVerifyHandler,
  createAccountDeletionRequestHandler,
  createAccountDeletionStatusHandler,
  DELETE_DATA_CONFIRMATION,
  meRouter,
} from '../src/routes/me.js';

const DELETION_ENV = Object.freeze({
  ACCOUNT_DELETION_SUBJECT_HMAC_KEY: 'h'.repeat(32),
});
const REQUEST_BODY = Object.freeze({
  confirmation: DELETE_ACCOUNT_CONFIRMATION,
  challengeId: 'challenge_recent_auth',
  clientRequestId: '11111111-1111-4111-8111-111111111111',
  expectedPrivyDid: 'did:privy:test',
  reauthProof: 'p'.repeat(43),
  walletRiskAcknowledged: true,
});

function authenticatedUser(privyDid = 'did:privy:test') {
  return { privyDid, claims: { sessionId: 'privy-session-test' } };
}

function routeTable() {
  return meRouter.stack
    .filter((layer) => layer.route)
    .flatMap((layer) => Object.keys(layer.route.methods)
      .map((method) => `${method.toUpperCase()} ${layer.route.path}`));
}

function responseDouble() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set() {
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('S3 privacy route surface is mounted on the me router', () => {
  assert.deepEqual(routeTable(), [
    'GET /consent',
    'PUT /consent',
    'GET /data',
    'GET /social-export',
    'GET /account-deletion',
    'POST /account-deletion/reauth/challenge',
    'POST /account-deletion/reauth/verify',
    'POST /account-deletion',
    'DELETE /data',
  ]);
});

test('data deletion rejects requests without the explicit confirmation phrase', async () => {
  const layer = meRouter.stack.find((item) => item.route?.path === '/data'
    && item.route.methods.delete);
  const handler = layer.route.stack.at(-1).handle;
  const response = responseDouble();

  await handler({ body: {}, user: authenticatedUser() }, response);
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    error: 'confirmation_required',
    confirmation: DELETE_DATA_CONFIRMATION,
  });
});

test('confirmed legacy data deletion is retired without deleting anything', async () => {
  const layer = meRouter.stack.find((item) => item.route?.path === '/data'
    && item.route.methods.delete);
  const handler = layer.route.stack.at(-1).handle;
  const response = responseDouble();

  await handler({
    body: { confirmation: DELETE_DATA_CONFIRMATION },
    user: authenticatedUser(),
  }, response);
  assert.equal(response.statusCode, 410);
  assert.deepEqual(response.body, {
    error: 'account_deletion_endpoint_moved',
    path: '/me/account-deletion',
  });
});

test('account deletion rejects a confirmed request when the verified token owner changed', async () => {
  const layer = meRouter.stack.find((item) => item.route?.path === '/account-deletion'
    && item.route.methods.post);
  const handler = layer.route.stack.at(-1).handle;
  const response = responseDouble();
  let forwardedError = null;

  await handler({
    body: {
      confirmation: DELETE_ACCOUNT_CONFIRMATION,
      clientRequestId: '11111111-1111-4111-8111-111111111111',
      expectedPrivyDid: 'did:privy:owner-a',
      walletRiskAcknowledged: true,
    },
    user: { privyDid: 'did:privy:owner-b' },
  }, response, (error) => { forwardedError = error; });

  assert.equal(forwardedError, null);
  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body, { error: 'account_deletion_session_changed' });
});

test('dormant deletion status stays behavior-neutral without calling Privy', async () => {
  let providerCalls = 0;
  const response = responseDouble();
  await createAccountDeletionStatusHandler({
    findDeletionRequest: async () => null,
    deletionCapability: () => false,
    stableIdentityEnforced: () => false,
    fetchPrivyUser: async () => {
      providerCalls += 1;
      return null;
    },
  })({
    user: authenticatedUser(),
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    available: false,
    state: null,
    requestId: null,
    localDataDeleted: false,
    completed: false,
  });
  assert.equal(providerCalls, 0);
});

test('status returns an exact DID tombstone without a provider lookup', async () => {
  let providerCalls = 0;
  const response = responseDouble();
  await createAccountDeletionStatusHandler({
    findDeletionRequest: async () => ({
      id: 'deletion_1',
      state: 'LOCAL_PURGED',
      localPurgedAt: new Date(),
      completedAt: null,
    }),
    deletionCapability: () => false,
    fetchPrivyUser: async () => {
      providerCalls += 1;
      throw new Error('deleted provider user');
    },
  })({
    user: authenticatedUser(),
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.requestId, 'deletion_1');
  assert.equal(response.body.localDataDeleted, true);
  assert.equal(providerCalls, 0);
});

test('the dormant recent-auth route refuses challenge issuance with zero mutations', async () => {
  let issueCalls = 0;
  const response = responseDouble();
  await createAccountDeletionReauthChallengeHandler({
    recentAuthCapability: () => false,
    issueChallenge: async () => { issueCalls += 1; },
  })({
    body: {
      clientRequestId: REQUEST_BODY.clientRequestId,
      expectedPrivyDid: REQUEST_BODY.expectedPrivyDid,
    },
    user: authenticatedUser(),
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: 'account_deletion_reauth_disabled' });
  assert.equal(issueCalls, 0);
});

test('challenge issuance binds the verified Privy session and client request', async () => {
  let issueInput;
  let boundIdentityDid;
  const response = responseDouble();
  await createAccountDeletionReauthChallengeHandler({
    env: DELETION_ENV,
    recentAuthCapability: () => true,
    findBoundIdentity: async (_db, privyDid) => {
      boundIdentityDid = privyDid;
      return deriveAppleStableProviderIdentity('bound-apple-subject', DELETION_ENV);
    },
    issueChallenge: async (input) => {
      issueInput = input;
      return {
        challengeId: 'challenge_recent_auth',
        nonce: 'n'.repeat(43),
        state: 's'.repeat(43),
        expiresAt: '2026-08-08T12:05:00.000Z',
      };
    },
  })({
    body: {
      clientRequestId: REQUEST_BODY.clientRequestId,
      expectedPrivyDid: REQUEST_BODY.expectedPrivyDid,
    },
    user: authenticatedUser(),
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(boundIdentityDid, REQUEST_BODY.expectedPrivyDid);
  assert.equal(issueInput.privyDid, REQUEST_BODY.expectedPrivyDid);
  assert.equal(issueInput.sessionId, 'privy-session-test');
  assert.equal(issueInput.clientRequestId, REQUEST_BODY.clientRequestId);
});

test('recent-auth verification uses only the immutable locally bound Apple identity', async () => {
  const rawSubject = 'apple-recent-auth-subject';
  const boundIdentity = deriveAppleStableProviderIdentity(rawSubject, DELETION_ENV);
  const identityToken = `${'a'.repeat(32)}.${'b'.repeat(32)}.${'c'.repeat(32)}`;
  let verifyInput;
  const response = responseDouble();
  await createAccountDeletionReauthVerifyHandler({
    env: DELETION_ENV,
    recentAuthCapability: () => true,
    findBoundIdentity: async (_db, privyDid) => {
      assert.equal(privyDid, REQUEST_BODY.expectedPrivyDid);
      return boundIdentity;
    },
    verifyChallenge: async (input) => {
      verifyInput = input;
      return {
        challengeId: REQUEST_BODY.challengeId,
        reauthProof: REQUEST_BODY.reauthProof,
      };
    },
  })({
    body: {
      challengeId: REQUEST_BODY.challengeId,
      clientRequestId: REQUEST_BODY.clientRequestId,
      expectedPrivyDid: REQUEST_BODY.expectedPrivyDid,
      identityToken,
      nonce: 'n'.repeat(43),
      state: 's'.repeat(43),
    },
    user: authenticatedUser(),
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(verifyInput.sessionId, 'privy-session-test');
  assert.match(verifyInput.stableProviderIdentity.providerIdentityHash, /^[a-f0-9]{64}$/u);
  assert.equal(JSON.stringify(verifyInput.stableProviderIdentity).includes(rawSubject), false);
  assert.equal(JSON.stringify(response.body).includes(identityToken), false);
});

test('recent-auth challenge fails closed when the account has no bound Apple identity', async () => {
  let issueCalls = 0;
  const response = responseDouble();
  await createAccountDeletionReauthChallengeHandler({
    env: DELETION_ENV,
    recentAuthCapability: () => true,
    findBoundIdentity: async () => {
      throw new AccountDeletionReauthError(
        'account_deletion_reauth_stable_apple_identity_required',
        { status: 409 },
      );
    },
    issueChallenge: async () => { issueCalls += 1; },
  })({
    body: {
      clientRequestId: REQUEST_BODY.clientRequestId,
      expectedPrivyDid: REQUEST_BODY.expectedPrivyDid,
    },
    user: authenticatedUser(),
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body, {
    error: 'account_deletion_reauth_stable_apple_identity_required',
  });
  assert.equal(issueCalls, 0);
});

test('provider lookup failure causes zero deletion mutations', async (t) => {
  const failures = [
    { failure: new Error('upstream included sensitive data'), status: 502, code: 'privy_unavailable' },
    { failure: new PrivyConfigurationError(), status: 503, code: 'privy_not_configured' },
  ];
  for (const item of failures) {
    await t.test(item.code, async () => {
      let deletionCalls = 0;
      const response = responseDouble();
      await createAccountDeletionRequestHandler({
        env: DELETION_ENV,
        deletionCapability: () => true,
        findDeletionRequest: async () => null,
        fetchPrivyUser: async () => { throw item.failure; },
        requestDeletion: async () => {
          deletionCalls += 1;
        },
      })({
        body: REQUEST_BODY,
        user: authenticatedUser(),
        log: { warn() {}, error() {} },
      }, response);

      assert.equal(response.statusCode, item.status);
      assert.deepEqual(response.body, { error: item.code });
      assert.equal(deletionCalls, 0);
      assert.equal(JSON.stringify(response.body).includes('sensitive'), false);
    });
  }
});

test('conflicting Apple identities cause zero deletion mutations', async () => {
  let deletionCalls = 0;
  const response = responseDouble();
  await createAccountDeletionRequestHandler({
    env: DELETION_ENV,
    deletionCapability: () => true,
    findDeletionRequest: async () => null,
    fetchPrivyUser: async () => ({
      id: 'did:privy:test',
      linkedAccounts: [
        { type: 'apple_oauth', subject: 'apple-a' },
        { type: 'apple_oauth', subject: 'apple-b' },
      ],
    }),
    requestDeletion: async () => {
      deletionCalls += 1;
    },
  })({
    body: REQUEST_BODY,
    user: authenticatedUser(),
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 502);
  assert.equal(deletionCalls, 0);
});

test('a new deletion without a verified recent-auth proof stops before Privy', async () => {
  let providerCalls = 0;
  let deletionCalls = 0;
  const response = responseDouble();
  await createAccountDeletionRequestHandler({
    deletionCapability: () => true,
    findDeletionRequest: async () => null,
    fetchPrivyUser: async () => { providerCalls += 1; },
    requestDeletion: async () => { deletionCalls += 1; },
  })({
    body: {
      confirmation: DELETE_ACCOUNT_CONFIRMATION,
      clientRequestId: REQUEST_BODY.clientRequestId,
      expectedPrivyDid: REQUEST_BODY.expectedPrivyDid,
      walletRiskAcknowledged: true,
    },
    user: authenticatedUser(),
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { error: 'account_deletion_reauth_required' });
  assert.equal(providerCalls, 0);
  assert.equal(deletionCalls, 0);
});

test('successful request forwards only the hashed Apple identity', async () => {
  const rawSubject = 'apple-route-subject';
  const rawEmail = 'relay-route@example.com';
  let deletionInput;
  const response = responseDouble();
  await createAccountDeletionRequestHandler({
    env: DELETION_ENV,
    deletionCapability: () => true,
    findDeletionRequest: async () => null,
    fetchPrivyUser: async () => ({
      id: 'did:privy:test',
      linkedAccounts: [{ type: 'apple_oauth', subject: rawSubject, email: rawEmail }],
    }),
    requestDeletion: async (input) => {
      deletionInput = input;
      return {
        requestId: 'deletion_1',
        state: 'LOCAL_PURGED',
        created: true,
        localDataDeleted: true,
        providerDeletionPending: true,
        redactedPosts: 0,
      };
    },
  })({
    body: REQUEST_BODY,
    user: authenticatedUser(),
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 202);
  assert.match(
    deletionInput.stableProviderIdentities[0].providerIdentityHash,
    /^[a-f0-9]{64}$/,
  );
  assert.deepEqual(deletionInput.recentAuth, {
    sessionId: 'privy-session-test',
    challengeId: REQUEST_BODY.challengeId,
    reauthProof: REQUEST_BODY.reauthProof,
  });
  assert.equal(typeof deletionInput.consumeRecentAuth, 'function');
  const serialized = JSON.stringify({
    privyDid: deletionInput.privyDid,
    stableProviderIdentities: deletionInput.stableProviderIdentities,
    clientRequestId: deletionInput.clientRequestId,
    env: deletionInput.env,
  });
  assert.equal(serialized.includes(rawSubject), false);
  assert.equal(serialized.includes(rawEmail), false);
  assert.equal(JSON.stringify(response.body).includes(rawSubject), false);
});

test('a lost-response retry recovers its DID tombstone before brakes or Privy', async () => {
  let capabilityCalls = 0;
  let providerCalls = 0;
  let deletionCalls = 0;
  const response = responseDouble();
  await createAccountDeletionRequestHandler({
    deletionCapability: () => {
      capabilityCalls += 1;
      return false;
    },
    findDeletionRequest: async () => ({
      id: 'deletion_committed',
      state: 'PRIVY_DELETED',
      localPurgedAt: new Date(),
      completedAt: null,
    }),
    fetchPrivyUser: async () => {
      providerCalls += 1;
      throw new Error('provider user already deleted');
    },
    requestDeletion: async () => {
      deletionCalls += 1;
    },
  })({
    body: REQUEST_BODY,
    user: authenticatedUser(),
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 202);
  assert.equal(response.body.requestId, 'deletion_committed');
  assert.equal(response.body.localDataDeleted, true);
  assert.equal(capabilityCalls, 0);
  assert.equal(providerCalls, 0);
  assert.equal(deletionCalls, 0);
});

test('provider recovery never claims a different DID was locally deleted', async () => {
  const currentDid = 'did:privy:test';
  const oldDid = 'did:privy:old';
  let lookups = 0;
  const response = responseDouble();
  await createAccountDeletionStatusHandler({
    env: DELETION_ENV,
    deletionCapability: () => false,
    stableIdentityEnforced: () => true,
    fetchPrivyUser: async () => ({
      id: currentDid,
      linkedAccounts: [{ type: 'apple_oauth', subject: 'apple-route-subject' }],
    }),
    findDeletionRequest: async (_db, _did, _env, options) => {
      lookups += 1;
      if (!options?.stableProviderIdentities) return null;
      return {
        id: 'deletion_old',
        subjectHash: accountDeletionSubjectHash(oldDid, DELETION_ENV, { required: true }),
        state: 'COMPLETED',
        localPurgedAt: new Date(),
        completedAt: new Date(),
      };
    },
  })({
    user: { privyDid: currentDid },
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(lookups, 2);
  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body, {
    error: 'stable_provider_identity_component_conflict',
    requestId: 'deletion_old',
    state: 'COMPLETED',
    localDataDeleted: false,
  });
});

test('manual-review results are never returned as accepted deletion', async () => {
  const response = responseDouble();
  await createAccountDeletionRequestHandler({
    env: DELETION_ENV,
    deletionCapability: () => true,
    findDeletionRequest: async () => null,
    fetchPrivyUser: async () => ({
      id: 'did:privy:test',
      linkedAccounts: [{ type: 'apple_oauth', subject: 'apple-route-subject' }],
    }),
    requestDeletion: async () => ({
      requestId: 'deletion_review',
      state: 'MANUAL_REVIEW',
      localDataDeleted: false,
    }),
  })({
    body: REQUEST_BODY,
    user: authenticatedUser(),
    log: { warn() {}, error() {} },
  }, response);

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body, {
    error: 'account_deletion_manual_review',
    requestId: 'deletion_review',
    state: 'MANUAL_REVIEW',
    localDataDeleted: false,
  });
});
