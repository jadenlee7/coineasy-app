export function apiTokenProviderFor({ authenticated = false, userId = null, getAccessToken } = {}) {
  if (!authenticated || !userId || typeof getAccessToken !== 'function') return null;
  return () => getAccessToken();
}

// A freshly completed native OAuth transition can briefly outrun Privy's
// access-token propagation. Keep retries short and finite so the authenticated
// UI remains usable even when the backend is temporarily unavailable.
export const AUTH_SYNC_RETRY_DELAYS_MS = Object.freeze([500, 1500, 3000]);

function httpStatusFor(error) {
  const status = Number(error?.status);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}

export function isAccountDeletionBlocked(error) {
  const status = httpStatusFor(error);
  const code = error?.body?.error;
  return (status === 410 && code === 'account_deletion_in_progress')
    || (status === 503 && code === 'account_deletion_guard_unavailable');
}

export function isTransientAuthSyncError(error) {
  const status = httpStatusFor(error);
  if (status !== null) {
    return status === 401
      || status === 408
      || status === 425
      || status === 429
      || status >= 500;
  }

  // React Native's fetch implementation reports connection failures as a
  // TypeError. Other unclassified application errors should not be retried.
  return error instanceof TypeError;
}

export function safeAuthSyncError(error) {
  const status = httpStatusFor(error);
  const retryable = isTransientAuthSyncError(error);
  const deletionBlocked = isAccountDeletionBlocked(error);
  const deletionCode = error?.body?.error === 'account_deletion_guard_unavailable'
    ? 'account_deletion_guard_unavailable'
    : 'account_deletion_in_progress';
  return Object.freeze({
    code: deletionBlocked
      ? deletionCode
      : status === null
        ? (retryable ? 'network_unavailable' : 'sync_failed')
        : `http_${status}`,
    status,
    retryable,
    deletionBlocked,
  });
}

const defaultWait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

export function createTransitionSingleFlight() {
  let activeTransitionKey = null;
  let inFlightPromise = null;
  let successfulPromise = null;

  return {
    run(transitionKey, operation) {
      if (!transitionKey || typeof operation !== 'function') return Promise.resolve(null);

      if (activeTransitionKey !== transitionKey) {
        activeTransitionKey = transitionKey;
        inFlightPromise = null;
        successfulPromise = null;
      }
      if (inFlightPromise) return inFlightPromise;
      if (successfulPromise) return successfulPromise;

      // Rerenders share one in-flight logical operation. A successful result is
      // retained for the transition, while a failed/null result releases the
      // gate so an explicit resync can recover after a longer backend outage.
      let promise;
      promise = Promise.resolve()
        .then(operation)
        .then((result) => {
          if (
            activeTransitionKey === transitionKey
            && result !== null
            && result !== undefined
          ) {
            successfulPromise = Promise.resolve(result);
          }
          return result;
        })
        .finally(() => {
          if (inFlightPromise === promise) inFlightPromise = null;
        });
      inFlightPromise = promise;
      return promise;
    },

    reset() {
      activeTransitionKey = null;
      inFlightPromise = null;
      successfulPromise = null;
    },
  };
}

/**
 * Execute one logical auth-sync operation with bounded transient retries.
 *
 * The caller owns single-flight de-duplication. This helper checks transition
 * currency before/after every request and retry delay so an old account can
 * never publish a result or start another request after logout/account switch.
 */
export async function runAuthSyncWithRetries({
  transitionKey,
  isCurrent,
  syncProfile,
  retryDelaysMs = AUTH_SYNC_RETRY_DELAYS_MS,
  wait = defaultWait,
} = {}) {
  if (!transitionKey || typeof isCurrent !== 'function' || typeof syncProfile !== 'function') {
    return { status: 'stale', attempts: 0, result: null };
  }

  const delays = Array.isArray(retryDelaysMs)
    ? retryDelaysMs.filter((delay) => Number.isFinite(delay) && delay >= 0)
    : [];

  for (let attemptIndex = 0; attemptIndex <= delays.length; attemptIndex += 1) {
    if (!isCurrent(transitionKey)) {
      return { status: 'stale', attempts: attemptIndex, result: null };
    }

    if (attemptIndex > 0) {
      await wait(delays[attemptIndex - 1]);
      if (!isCurrent(transitionKey)) {
        return { status: 'stale', attempts: attemptIndex, result: null };
      }
    }

    try {
      const result = await syncProfile();
      if (!isCurrent(transitionKey)) {
        return { status: 'stale', attempts: attemptIndex + 1, result: null };
      }
      return { status: 'success', attempts: attemptIndex + 1, result };
    } catch (error) {
      if (!isCurrent(transitionKey)) {
        return { status: 'stale', attempts: attemptIndex + 1, result: null };
      }

      const canRetry = isTransientAuthSyncError(error) && attemptIndex < delays.length;
      if (!canRetry) {
        return {
          status: 'failed',
          attempts: attemptIndex + 1,
          error: safeAuthSyncError(error),
          result: null,
        };
      }
    }
  }

  // The finite loop always returns, but retain a safe terminal value for
  // defensive callers and future edits.
  return { status: 'failed', attempts: 0, error: safeAuthSyncError(null), result: null };
}

export function profileFromAuthSyncResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null;

  const profile = result.user && typeof result.user === 'object' && !Array.isArray(result.user)
    ? result.user
    : result;
  const rawOrangeBalance = result.orangeBalance ?? profile.orangeBalance;
  if (rawOrangeBalance === null || rawOrangeBalance === undefined || rawOrangeBalance === '') {
    return profile;
  }
  const orangeBalance = Number(rawOrangeBalance);

  if (!Number.isFinite(orangeBalance)) return profile;
  return { ...profile, orangeBalance };
}

/**
 * Small state machine for the Privy -> EasyGo auth-sync boundary.
 *
 * A transition is an authenticated Privy user session. Readiness may flicker
 * while Privy settles, but logout/re-login and account changes create a fresh
 * transition. Each transition can claim exactly one automatic logical sync;
 * that operation owns a finite retry budget managed above.
 */
export function createAuthSyncLifecycle() {
  let generation = 0;
  let activeUserId = null;
  let currentReady = false;
  let automaticAttemptedFor = null;

  const currentTransitionKey = () =>
    activeUserId === null ? null : `${generation}:${activeUserId}`;

  return {
    observe({ ready = false, authenticated = false, userId = null } = {}) {
      const normalizedUserId =
        userId === null || userId === undefined ? null : String(userId).trim() || null;
      const active = Boolean(authenticated && normalizedUserId);
      let sessionChanged = false;

      currentReady = Boolean(ready);

      if (!active) {
        sessionChanged = activeUserId !== null;
        activeUserId = null;
        automaticAttemptedFor = null;
        return {
          active: false,
          canAutoSync: false,
          sessionChanged,
          transitionKey: null,
        };
      }

      if (activeUserId !== normalizedUserId) {
        generation += 1;
        activeUserId = normalizedUserId;
        automaticAttemptedFor = null;
        sessionChanged = true;
      }

      return {
        active: true,
        canAutoSync: currentReady,
        sessionChanged,
        transitionKey: currentTransitionKey(),
      };
    },

    claimAutomaticSync(transitionKey) {
      const currentKey = currentTransitionKey();
      if (
        !currentReady ||
        !transitionKey ||
        transitionKey !== currentKey ||
        automaticAttemptedFor === transitionKey
      ) {
        return false;
      }

      // Claim before starting async work. A rejected attempt therefore cannot
      // trigger an effect-driven retry loop on the same auth transition.
      automaticAttemptedFor = transitionKey;
      return true;
    },

    currentTransitionKey,

    isCurrent(transitionKey) {
      return Boolean(transitionKey && transitionKey === currentTransitionKey());
    },
  };
}

export default createAuthSyncLifecycle;
