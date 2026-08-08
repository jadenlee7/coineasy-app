const REAUTH_ERROR = Object.freeze({
  cancelled: 'account_deletion_reauth_cancelled',
  inProgress: 'account_deletion_reauth_in_progress',
  invalidChallenge: 'account_deletion_reauth_challenge_invalid',
  invalidCredential: 'account_deletion_reauth_credential_invalid',
  invalidProof: 'account_deletion_reauth_proof_invalid',
  sessionChanged: 'account_deletion_reauth_session_changed',
  unavailable: 'account_deletion_reauth_unavailable',
  failed: 'account_deletion_reauth_failed',
});

export const ACCOUNT_DELETION_REAUTH_ERROR = REAUTH_ERROR;

export class AccountDeletionReauthError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AccountDeletionReauthError';
    this.code = code;
  }
}

function fail(code) {
  throw new AccountDeletionReauthError(code);
}

function nonEmptyString(value, maxLength = 4_096) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength;
}

function validOwner(ownerUserId) {
  return nonEmptyString(ownerUserId, 512);
}

function validClientRequestId(clientRequestId) {
  return nonEmptyString(clientRequestId, 128);
}

function parseChallenge(value) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || !nonEmptyString(value.challengeId, 256)
    || !nonEmptyString(value.nonce, 1_024)
    || !nonEmptyString(value.state, 1_024)
  ) {
    fail(REAUTH_ERROR.invalidChallenge);
  }
  return {
    challengeId: value.challengeId,
    nonce: value.nonce,
    state: value.state,
  };
}

function parseCredential(value, expectedState) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || value.state !== expectedState
    || !nonEmptyString(value.identityToken, 32_768)
  ) {
    fail(REAUTH_ERROR.invalidCredential);
  }
  return value.identityToken;
}

function parseProof(value, expectedChallengeId) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || value.challengeId !== expectedChallengeId
    || !nonEmptyString(value.reauthProof, 4_096)
  ) {
    fail(REAUTH_ERROR.invalidProof);
  }
  return {
    challengeId: value.challengeId,
    reauthProof: value.reauthProof,
  };
}

function isAppleCancellation(error) {
  return error?.code === 'ERR_REQUEST_CANCELED';
}

/**
 * Owns one short-lived, memory-only Apple reauthentication attempt at a time.
 * The native Apple credential is sent directly to the verifier and is never
 * returned, persisted, logged, or copied into React state.
 */
export function createAccountDeletionReauthCoordinator({
  getCurrentOwnerUserId,
} = {}) {
  if (typeof getCurrentOwnerUserId !== 'function') {
    throw new Error('account_deletion_reauth_owner_reader_required');
  }

  let generation = 0;
  let activeAttempt = null;

  const assertCurrent = (attempt) => {
    if (
      activeAttempt !== attempt
      || generation !== attempt.generation
      || attempt.controller.signal.aborted
    ) {
      fail(REAUTH_ERROR.cancelled);
    }
    let currentOwnerUserId = null;
    try {
      currentOwnerUserId = getCurrentOwnerUserId();
    } catch {
      fail(REAUTH_ERROR.sessionChanged);
    }
    if (currentOwnerUserId !== attempt.ownerUserId) {
      fail(REAUTH_ERROR.sessionChanged);
    }
  };

  const execute = async (attempt, dependencies) => {
    const {
      isAppleAuthenticationAvailable,
      requestChallenge,
      signInWithApple,
      verifyChallenge,
    } = dependencies;
    if (
      typeof isAppleAuthenticationAvailable !== 'function'
      || typeof requestChallenge !== 'function'
      || typeof signInWithApple !== 'function'
      || typeof verifyChallenge !== 'function'
    ) {
      fail(REAUTH_ERROR.failed);
    }

    assertCurrent(attempt);
    const available = await isAppleAuthenticationAvailable();
    assertCurrent(attempt);
    if (available !== true) fail(REAUTH_ERROR.unavailable);

    const challengeResponse = await requestChallenge({
      clientRequestId: attempt.clientRequestId,
      expectedAuthUserId: attempt.ownerUserId,
      signal: attempt.controller.signal,
    });
    assertCurrent(attempt);
    const challenge = parseChallenge(challengeResponse);

    let identityToken = null;
    try {
      const credential = await signInWithApple({
        nonce: challenge.nonce,
        requestedScopes: [],
        state: challenge.state,
      });
      assertCurrent(attempt);
      identityToken = parseCredential(credential, challenge.state);

      const proofResponse = await verifyChallenge({
        challengeId: challenge.challengeId,
        clientRequestId: attempt.clientRequestId,
        expectedAuthUserId: attempt.ownerUserId,
        identityToken,
        nonce: challenge.nonce,
        signal: attempt.controller.signal,
        state: challenge.state,
      });
      assertCurrent(attempt);
      return Object.freeze(parseProof(proofResponse, challenge.challengeId));
    } catch (error) {
      if (isAppleCancellation(error)) fail(REAUTH_ERROR.cancelled);
      throw error;
    } finally {
      identityToken = null;
      challenge.nonce = null;
      challenge.state = null;
    }
  };

  const run = ({ ownerUserId, clientRequestId, ...dependencies } = {}) => {
    if (!validOwner(ownerUserId) || !validClientRequestId(clientRequestId)) {
      return Promise.reject(new AccountDeletionReauthError(REAUTH_ERROR.failed));
    }
    if (activeAttempt) {
      if (
        activeAttempt.ownerUserId === ownerUserId
        && activeAttempt.clientRequestId === clientRequestId
      ) {
        return activeAttempt.promise;
      }
      return Promise.reject(new AccountDeletionReauthError(REAUTH_ERROR.inProgress));
    }

    const attempt = {
      clientRequestId,
      controller: new AbortController(),
      generation: generation + 1,
      ownerUserId,
      promise: null,
    };
    generation = attempt.generation;
    activeAttempt = attempt;
    attempt.promise = execute(attempt, dependencies)
      .catch((error) => {
        // A rejected await is still an async boundary. Re-check both the
        // attempt generation and authenticated owner before classifying it.
        assertCurrent(attempt);
        if (error instanceof AccountDeletionReauthError) throw error;
        fail(REAUTH_ERROR.failed);
      })
      .finally(() => {
        if (activeAttempt === attempt) activeAttempt = null;
      });
    return attempt.promise;
  };

  const cancel = () => {
    generation += 1;
    const attempt = activeAttempt;
    activeAttempt = null;
    attempt?.controller.abort();
  };

  return Object.freeze({
    cancel,
    isInFlight: () => activeAttempt !== null,
    run,
  });
}
