export function apiTokenProviderFor({ authenticated = false, userId = null, getAccessToken } = {}) {
  if (!authenticated || !userId || typeof getAccessToken !== 'function') return null;
  return () => getAccessToken();
}

/**
 * Small state machine for the Privy -> EasyGo auth-sync boundary.
 *
 * A transition is an authenticated Privy user session. Readiness may flicker
 * while Privy settles, but logout/re-login and account changes create a fresh
 * transition. Each transition can claim exactly one automatic sync attempt;
 * callers may still explicitly retry a failed attempt via `resync`.
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
