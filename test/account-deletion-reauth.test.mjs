import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ACCOUNT_DELETION_REAUTH_ERROR,
  AccountDeletionReauthError,
  createAccountDeletionReauthCoordinator,
} from '../utils/accountDeletionReauth.mjs';

const OWNER_A = 'did:privy:owner-a';
const OWNER_B = 'did:privy:owner-b';
const CLIENT_A = '11111111-1111-4111-8111-111111111111';
const CLIENT_B = '22222222-2222-4222-8222-222222222222';
const CHALLENGE = Object.freeze({
  challengeId: 'reauth_challenge_1',
  nonce: 'server-nonce-1',
  state: 'server-state-1',
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function rejectsWithCode(code) {
  return (error) => {
    assert.equal(error instanceof AccountDeletionReauthError, true);
    assert.equal(error.code, code);
    return true;
  };
}

function successfulDependencies(events = []) {
  return {
    isAppleAuthenticationAvailable: async () => {
      events.push('available');
      return true;
    },
    requestChallenge: async (params) => {
      events.push(['challenge', params]);
      return { ...CHALLENGE, expiresAt: '2026-08-08T12:05:00.000Z' };
    },
    signInWithApple: async (options) => {
      events.push(['apple', options]);
      return {
        authorizationCode: 'must-not-leave-native-result',
        identityToken: 'signed-apple-identity-token',
        state: CHALLENGE.state,
        user: 'must-not-leave-native-result',
      };
    },
    verifyChallenge: async (params) => {
      events.push(['verify', params]);
      return {
        challengeId: CHALLENGE.challengeId,
        reauthProof: 'one-time-server-proof',
      };
    },
  };
}

test('fresh Apple sign-in uses the server nonce/state and exposes only a verified proof', async () => {
  let currentOwner = OWNER_A;
  const events = [];
  const coordinator = createAccountDeletionReauthCoordinator({
    getCurrentOwnerUserId: () => currentOwner,
  });

  const proof = await coordinator.run({
    ownerUserId: OWNER_A,
    clientRequestId: CLIENT_A,
    ...successfulDependencies(events),
  });

  assert.deepEqual(proof, {
    challengeId: CHALLENGE.challengeId,
    reauthProof: 'one-time-server-proof',
  });
  assert.deepEqual(events[2], ['apple', {
    nonce: CHALLENGE.nonce,
    requestedScopes: [],
    state: CHALLENGE.state,
  }]);
  const verifyParams = events[3][1];
  assert.deepEqual(Object.keys(verifyParams).sort(), [
    'challengeId',
    'clientRequestId',
    'expectedAuthUserId',
    'identityToken',
    'nonce',
    'signal',
    'state',
  ]);
  assert.equal(verifyParams.identityToken, 'signed-apple-identity-token');
  assert.equal('authorizationCode' in verifyParams, false);
  assert.equal('user' in verifyParams, false);
  assert.equal(coordinator.isInFlight(), false);
  currentOwner = OWNER_B;
});

test('identical concurrent calls share one flight and another binding is rejected', async () => {
  const availability = deferred();
  let availabilityCalls = 0;
  const dependencies = successfulDependencies();
  dependencies.isAppleAuthenticationAvailable = () => {
    availabilityCalls += 1;
    return availability.promise;
  };
  const coordinator = createAccountDeletionReauthCoordinator({
    getCurrentOwnerUserId: () => OWNER_A,
  });
  const args = {
    ownerUserId: OWNER_A,
    clientRequestId: CLIENT_A,
    ...dependencies,
  };

  const first = coordinator.run(args);
  const duplicate = coordinator.run(args);
  assert.equal(first, duplicate);
  await assert.rejects(
    coordinator.run({ ...args, clientRequestId: CLIENT_B }),
    rejectsWithCode(ACCOUNT_DELETION_REAUTH_ERROR.inProgress),
  );
  availability.resolve(true);
  await first;
  assert.equal(availabilityCalls, 1);
});

test('an owner switch after any awaited boundary prevents the next step', async () => {
  const cases = ['availability', 'challenge', 'apple', 'verify'];
  for (const boundary of cases) {
    let owner = OWNER_A;
    const gate = deferred();
    const calls = [];
    const dependencies = successfulDependencies(calls);
    if (boundary === 'availability') {
      dependencies.isAppleAuthenticationAvailable = () => gate.promise;
    } else if (boundary === 'challenge') {
      dependencies.requestChallenge = () => gate.promise;
    } else if (boundary === 'apple') {
      dependencies.signInWithApple = () => gate.promise;
    } else {
      dependencies.verifyChallenge = () => gate.promise;
    }
    const coordinator = createAccountDeletionReauthCoordinator({
      getCurrentOwnerUserId: () => owner,
    });
    const pending = coordinator.run({
      ownerUserId: OWNER_A,
      clientRequestId: CLIENT_A,
      ...dependencies,
    });
    await new Promise((resolve) => setImmediate(resolve));
    owner = OWNER_B;
    if (boundary === 'availability') gate.resolve(true);
    if (boundary === 'challenge') gate.resolve({ ...CHALLENGE });
    if (boundary === 'apple') {
      gate.resolve({ identityToken: 'signed-apple-identity-token', state: CHALLENGE.state });
    }
    if (boundary === 'verify') {
      gate.resolve({ challengeId: CHALLENGE.challengeId, reauthProof: 'proof' });
    }
    await assert.rejects(
      pending,
      rejectsWithCode(ACCOUNT_DELETION_REAUTH_ERROR.sessionChanged),
      boundary,
    );
  }
});

test('cancelling an attempt aborts its server request and discards a late response', async () => {
  const challenge = deferred();
  let challengeSignal;
  let appleCalls = 0;
  const dependencies = successfulDependencies();
  dependencies.requestChallenge = ({ signal }) => {
    challengeSignal = signal;
    return challenge.promise;
  };
  dependencies.signInWithApple = async () => {
    appleCalls += 1;
  };
  const coordinator = createAccountDeletionReauthCoordinator({
    getCurrentOwnerUserId: () => OWNER_A,
  });
  const pending = coordinator.run({
    ownerUserId: OWNER_A,
    clientRequestId: CLIENT_A,
    ...dependencies,
  });
  await new Promise((resolve) => setImmediate(resolve));

  coordinator.cancel();
  assert.equal(challengeSignal.aborted, true);
  challenge.resolve({ ...CHALLENGE });
  await assert.rejects(
    pending,
    rejectsWithCode(ACCOUNT_DELETION_REAUTH_ERROR.cancelled),
  );
  assert.equal(appleCalls, 0);
  assert.equal(coordinator.isInFlight(), false);
});

test('native cancellation and malformed credentials fail closed before verification', async () => {
  for (const credential of [
    { throws: { code: 'ERR_REQUEST_CANCELED' } },
    { identityToken: null, state: CHALLENGE.state },
    { identityToken: 'signed-apple-identity-token', state: 'wrong-state' },
  ]) {
    let verifies = 0;
    const dependencies = successfulDependencies();
    dependencies.signInWithApple = async () => {
      if (credential.throws) throw credential.throws;
      return credential;
    };
    dependencies.verifyChallenge = async () => {
      verifies += 1;
      return { challengeId: CHALLENGE.challengeId, reauthProof: 'proof' };
    };
    const coordinator = createAccountDeletionReauthCoordinator({
      getCurrentOwnerUserId: () => OWNER_A,
    });
    await assert.rejects(
      coordinator.run({
        ownerUserId: OWNER_A,
        clientRequestId: CLIENT_A,
        ...dependencies,
      }),
      rejectsWithCode(
        credential.throws
          ? ACCOUNT_DELETION_REAUTH_ERROR.cancelled
          : ACCOUNT_DELETION_REAUTH_ERROR.invalidCredential,
      ),
    );
    assert.equal(verifies, 0);
  }
});

test('the UI uses direct Apple authentication and writes the marker only after verification', () => {
  const settings = readFileSync(
    new URL('../components/modals/SettingsModal.js', import.meta.url),
    'utf8',
  );
  const api = readFileSync(new URL('../utils/api.js', import.meta.url), 'utf8');

  assert.match(settings, /AppleAuthentication\.signInAsync\(options\)/);
  assert.doesNotMatch(settings, /useLoginWithOAuth|useLinkWithOAuth/);
  assert.doesNotMatch(settings, /authorizationCode|credential\.user/);
  assert.match(
    settings,
    /await deletionReauthRef\.current\.run\([\s\S]*!isCurrentDeletionOwner\(operation\)[\s\S]*reauthCompleted = true/,
  );
  assert.ok(
    settings.indexOf('deletionReauthRef.current.run')
      < settings.indexOf('submitAccountDeletionRequest({'),
  );
  assert.match(api, /\/me\/account-deletion\/reauth\/challenge/);
  assert.match(api, /\/me\/account-deletion\/reauth\/verify/);
  assert.match(api, /challengeId,[\s\S]*reauthProof,[\s\S]*walletRiskAcknowledged/);
});
