// hooks/useAuthSync.js
// Bridge between Privy auth state and EasyGo backend.
// Calls POST /auth/sync once on login (idempotent on backend), caches profile.
// Also wires the Privy access token into utils/api.js so all subsequent calls are authenticated.
// See backend/src/routes/auth.js and EASYGO_BUILD_PLAN.md §11.

import { useEffect, useState, useRef, useCallback } from 'react';
import { api, setApiTokenProvider, ApiError } from '../utils/api';
import { apiTokenProviderFor, createAuthSyncLifecycle } from './authSyncLifecycle.mjs';

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
export function useAuthSync(privy) {
  const [profile, setProfile] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const profileRef = useRef(null);
  const syncedTransitionKey = useRef(null);
  const inFlightSync = useRef(null);
  const lifecycle = useRef(null);
  if (!lifecycle.current) lifecycle.current = createAuthSyncLifecycle();

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

    setApiTokenProvider(tokenProvider);
    return () => setApiTokenProvider(null);
  }, [authenticated, userId, getAccessToken]);

  const syncTransition = useCallback((transitionKey) => {
    if (!lifecycle.current.isCurrent(transitionKey)) return Promise.resolve(null);
    if (syncedTransitionKey.current === transitionKey) {
      return Promise.resolve(profileRef.current);
    }

    const existing = inFlightSync.current;
    if (existing?.transitionKey === transitionKey) return existing.promise;

    setSyncing(true);
    setError(null);

    let promise;
    promise = Promise.resolve()
      .then(() => api.syncProfile())
      .then((result) => {
        if (!lifecycle.current.isCurrent(transitionKey)) return null;

        const syncedProfile = result?.user ?? result ?? null;
        if (syncedProfile) {
          syncedTransitionKey.current = transitionKey;
          profileRef.current = syncedProfile;
          setProfile(syncedProfile);
        }
        return syncedProfile;
      })
      .catch((e) => {
        // Don't throw — fail soft so UI stays usable in dev before backend is reachable.
        if (!(e instanceof ApiError)) console.warn('[auth-sync] unexpected', e);
        if (lifecycle.current.isCurrent(transitionKey)) setError(e);
        return null;
      })
      .finally(() => {
        if (inFlightSync.current?.promise !== promise) return;
        inFlightSync.current = null;
        if (lifecycle.current.isCurrent(transitionKey)) setSyncing(false);
      });

    inFlightSync.current = { transitionKey, promise };
    return promise;
  }, []);

  // Auto-sync once when Privy reaches an authenticated, ready transition.
  // The attempt is claimed before the request starts, preventing rerender- or
  // failure-driven retry loops. `resync` remains an explicit retry path.
  useEffect(() => {
    const observed = lifecycle.current.observe({ ready, authenticated, userId });

    if (!observed.active || observed.sessionChanged) {
      syncedTransitionKey.current = null;
      profileRef.current = null;
      setProfile(null);
      setError(null);
      setSyncing(false);
    }

    if (
      observed.canAutoSync &&
      lifecycle.current.claimAutomaticSync(observed.transitionKey)
    ) {
      syncTransition(observed.transitionKey);
    }
  }, [ready, authenticated, userId, syncTransition]);

  const resync = useCallback(() => {
    if (!ready || !authenticated || !userId) return Promise.resolve(null);
    const transitionKey = lifecycle.current.currentTransitionKey();
    if (!transitionKey) return Promise.resolve(null);
    return syncTransition(transitionKey);
  }, [ready, authenticated, userId, syncTransition]);

  return { profile, syncing, error, resync };
}

export default useAuthSync;
