// hooks/useSocialProfile.js
//
// Replacement for Orbis-based public profile lookups (other users).
// Note: this is distinct from useEasyChainProfile which is the *current*
// authenticated user's profile (already wired to /auth/me in PR #6).
// useSocialProfile is for fetching arbitrary user profiles by id.
//
// Backend wiring lands in PR #8.
// See docs/MIGRATION_NOTES.md.

import { useCallback, useState } from "react";

export function useSocialProfile(_userId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (__DEV__) console.warn("[useSocialProfile] refresh: backend not wired (PR #8)");
    setProfile(null);
    return null;
  }, []);

  const update = useCallback(async (_payload) => {
    if (__DEV__) console.warn("[useSocialProfile] update: backend not wired (PR #8)");
    return null;
  }, []);

  return { profile, loading, error, refresh, update };
}

export default useSocialProfile;
