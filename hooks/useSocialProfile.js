// hooks/useSocialProfile.js
//
// Public profile lookup hook for **other users** (read-only).
// Wired to EasyGo backend via api.profiles.get(userId).
//
// Note: this is intentionally distinct from useEasyChainProfile, which
// owns the *current authenticated user's* profile (private fields + edit
// via /profiles/me). useSocialProfile only exposes public projection.
//
// PR #13 wired this. Backend models/routes shipped in PR #9; api client
// helpers shipped in PR #10.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../utils/api";

/**
 * Fetch a public profile by user id (cuid).
 *
 * @param {string|null|undefined} userId - target user's cuid; nullish disables fetch
 * @returns {{
 *   profile: object|null,
 *   loading: boolean,
 *   error: Error|null,
 *   refresh: () => Promise<object|null>,
 *   update: () => Promise<null>,  // deprecated no-op; see header
 * }}
 */
export function useSocialProfile(userId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Guard against state updates after unmount or stale userId changes.
  const reqIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setError(null);
      return null;
    }
    const myReq = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.profiles.get(userId);
      // api.profiles.get returns null when EXPO_PUBLIC_BACKEND_URL is unset
      // (see utils/api.js helper contract). Treat that as "no data, no error".
      if (myReq !== reqIdRef.current) return null; // stale
      const next = res && typeof res === "object" ? (res.profile ?? res) : null;
      setProfile(next);
      return next;
    } catch (e) {
      if (myReq !== reqIdRef.current) return null; // stale
      setError(e instanceof Error ? e : new Error(String(e)));
      setProfile(null);
      return null;
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  }, [userId]);

  // Auto-fetch on mount / when userId changes.
  useEffect(() => {
    refresh();
    return () => {
      // Invalidate any in-flight request from previous userId.
      reqIdRef.current += 1;
    };
  }, [refresh]);

  // Deprecated: other users' profiles cannot be edited via this hook.
  // Kept as a no-op for callsite compatibility during the Orbis -> EasyGo
  // migration. Use useEasyChainProfile.updateMe for self-profile edits.
  const update = useCallback(async (_payload) => {
    if (__DEV__) {
      console.warn(
        "[useSocialProfile] update() is a no-op; use useEasyChainProfile for self-profile edits."
      );
    }
    return null;
  }, []);

  return { profile, loading, error, refresh, update };
}

export default useSocialProfile;
