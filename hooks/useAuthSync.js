// hooks/useAuthSync.js
// Bridge between Privy auth state and EasyGo backend.
// Calls POST /auth/sync once on login (idempotent on backend), caches profile.
// Also wires the Privy access token into utils/api.js so all subsequent calls are authenticated.
// See backend/src/routes/auth.js and EASYGO_BUILD_PLAN.md §11.

import { useEffect, useState, useRef, useCallback } from 'react';
import { api, setApiTokenProvider, ApiError } from '../utils/api';

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
  const syncedForUserId = useRef(null);
  const ready = privy?.isReady ?? privy?.ready ?? false;
  const authenticated = privy?.authenticated ?? Boolean(privy?.user);

  // Wire token provider exactly once when getAccessToken becomes available
  useEffect(() => {
    if (privy?.getAccessToken) {
      setApiTokenProvider(() => privy.getAccessToken());
    }
  }, [privy?.getAccessToken]);

  const sync = useCallback(async () => {
    if (!authenticated || !privy?.user?.id) return null;
    if (syncedForUserId.current === privy.user.id) return profile;

    setSyncing(true);
    setError(null);
    try {
      const result = await api.syncProfile();
      const syncedProfile = result?.user ?? result ?? null;
      if (syncedProfile) {
        syncedForUserId.current = privy.user.id;
        setProfile(syncedProfile);
      }
      return syncedProfile;
    } catch (e) {
      // Don't throw — fail soft so UI stays usable in dev before backend is reachable
      if (!(e instanceof ApiError)) console.warn('[auth-sync] unexpected', e);
      setError(e);
      return null;
    } finally {
      setSyncing(false);
    }
  }, [authenticated, privy?.user?.id, profile]);

  // Auto-sync when Privy reaches authenticated state
  useEffect(() => {
    if (ready && authenticated) {
      sync();
    }
    if (ready && !authenticated) {
      // Logged out — clear local cache + token provider
      syncedForUserId.current = null;
      setProfile(null);
      setApiTokenProvider(null);
    }
  }, [ready, authenticated, sync]);

  return { profile, syncing, error, resync: sync };
}

export default useAuthSync;
