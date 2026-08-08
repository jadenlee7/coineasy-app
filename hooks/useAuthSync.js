// hooks/useAuthSync.js
// Bridge between Privy auth state and EasyGo backend.
// Runs one bounded POST /auth/sync operation per login transition and caches profile.
// Also wires an owner-bound Privy token provider into utils/api.js. Private
// calls must name that owner; explicitly public discovery calls stay anonymous.
// See backend/src/routes/auth.js and EASYGO_BUILD_PLAN.md §11.

import { useEffect, useState, useRef, useCallback } from 'react';
import { api, setApiTokenProvider } from '../utils/api';
import {
  apiTokenProviderFor,
  createAuthSyncLifecycle,
  createTransitionSingleFlight,
  profileFromAuthSyncResult,
  runAuthSyncWithRetries,
  safeAuthSyncError,
} from './authSyncLifecycle.mjs';

// ---------------------------------------------------------------------------
// useAuthSync(privy)
//
// privy: the object returned from Privy SDK usePrivy() — must expose:
//   - isReady: boolean (legacy integrations may expose `ready`)
//   - user: { id, ... } | null
//   - getAccessToken: () => Promise<string>
//
// We accept it as a parameter (rather than importing usePrivy directly) so this
// hook stays SDK-agnostic and easier to mock in Phase 1 before the real Privy
// app ID is provisioned.
// ---------------------------------------------------------------------------
export function useAuthSync(privy, { enabled = true } = {}) {
  const [profile, setProfile] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [resolution, setResolution] = useState(null);
  const lifecycle = useRef(null);
  const singleFlight = useRef(null);
  const syncAllowedRef = useRef(Boolean(enabled));
  syncAllowedRef.current = Boolean(enabled);
  if (!lifecycle.current) lifecycle.current = createAuthSyncLifecycle();
  if (!singleFlight.current) singleFlight.current = createTransitionSingleFlight();

  const ready = privy?.isReady ?? privy?.ready ?? false;
  const authenticated = privy?.authenticated ?? Boolean(privy?.user);
  const userId = privy?.user?.id ?? null;
  const getAccessToken = privy?.getAccessToken;

  // Authentication and account identity are dependencies on purpose. Logout
  // clears the global provider, so a same-function re-login must wire it again.
  useEffect(() => {
    const tokenProvider = apiTokenProviderFor({ authenticated, userId, getAccessToken });
    if (!tokenProvider) {
      setApiTokenProvider(null);
      return undefined;
    }

    setApiTokenProvider(tokenProvider, userId);
    return () => setApiTokenProvider(null);
  }, [authenticated, userId, getAccessToken]);

  const syncTransition = useCallback((transitionKey, ownerUserId) => {
    if (!syncAllowedRef.current || !lifecycle.current.isCurrent(transitionKey)) {
      return Promise.resolve(null);
    }

    return singleFlight.current.run(transitionKey, () => {
      setSyncing(true);
      setError(null);
      setResolution({ userId: ownerUserId, status: 'syncing' });

      return runAuthSyncWithRetries({
        transitionKey,
        isCurrent: (candidate) => (
          syncAllowedRef.current && lifecycle.current.isCurrent(candidate)
        ),
        syncProfile: () => api.syncProfile({
          expectedAuthUserId: ownerUserId,
        }),
      })
        .then((outcome) => {
          if (
            outcome.status === 'stale'
            || !syncAllowedRef.current
            || !lifecycle.current.isCurrent(transitionKey)
          ) {
            return null;
          }

          if (outcome.status === 'failed') {
            setError(outcome.error);
            setProfile(null);
            setResolution({
              userId: ownerUserId,
              status: outcome.error.deletionBlocked ? 'deletion-blocked' : 'failed',
            });
            console.warn(`[auth-sync] ${outcome.error.code}`);
            return null;
          }

          const syncedProfile = profileFromAuthSyncResult(outcome.result);
          if (syncedProfile) {
            setProfile(syncedProfile);
            setResolution({ userId: ownerUserId, status: 'success' });
          } else {
            const safeError = safeAuthSyncError(null);
            setProfile(null);
            setError(safeError);
            setResolution({ userId: ownerUserId, status: 'failed' });
          }
          return syncedProfile;
        })
        .catch(() => {
          // Don't throw — fail soft and never surface raw SDK/network errors.
          const safeError = safeAuthSyncError(null);
          if (syncAllowedRef.current && lifecycle.current.isCurrent(transitionKey)) {
            setError(safeError);
            setProfile(null);
            setResolution({ userId: ownerUserId, status: 'failed' });
            console.warn(`[auth-sync] ${safeError.code}`);
          }
          return null;
        })
        .finally(() => {
          if (syncAllowedRef.current && lifecycle.current.isCurrent(transitionKey)) {
            setSyncing(false);
          }
        });
    });
  }, []);

  // Auto-sync once when Privy reaches an authenticated, ready transition.
  // The logical operation is claimed before its first request, preventing
  // rerender-driven loops. It may perform only the bounded transient retries
  // defined by runAuthSyncWithRetries; only a new auth transition renews that
  // budget. `resync` joins in-flight work, reuses a successful result, or starts
  // one fresh bounded operation after a failed attempt.
  useEffect(() => {
    const syncAllowed = Boolean(enabled);
    const observed = lifecycle.current.observe({
      ready: ready && syncAllowed,
      authenticated: authenticated && syncAllowed,
      userId: syncAllowed ? userId : null,
    });

    if (!observed.active || observed.sessionChanged) {
      singleFlight.current.reset();
      setProfile(null);
      setError(null);
      setSyncing(false);
      setResolution(null);
    }

    if (
      observed.canAutoSync &&
      lifecycle.current.claimAutomaticSync(observed.transitionKey)
    ) {
      syncTransition(observed.transitionKey, userId);
    }
  }, [ready, authenticated, userId, enabled, syncTransition]);

  const resync = useCallback(() => {
    if (!enabled || !ready || !authenticated || !userId) return Promise.resolve(null);
    const transitionKey = lifecycle.current.currentTransitionKey();
    if (!transitionKey) return Promise.resolve(null);
    return syncTransition(transitionKey, userId);
  }, [enabled, ready, authenticated, userId, syncTransition]);

  const currentResolution = resolution?.userId === userId ? resolution : null;
  return {
    profile,
    syncing,
    error,
    resync,
    status: !enabled
      ? 'blocked'
      : currentResolution?.status || (authenticated && userId ? 'pending' : 'idle'),
    deletionBlocked: currentResolution?.status === 'deletion-blocked',
    canUseFallback: Boolean(enabled) && currentResolution?.status === 'failed',
  };
}

export default useAuthSync;
