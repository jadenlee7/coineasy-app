// hooks/useFollow.js
//
// Replacement for Orbis-based follow/unfollow.
// Backend wiring lands in PR #8.
// See docs/MIGRATION_NOTES.md.

import { useCallback, useState } from "react";

export function useFollow(_targetUserId) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const follow = useCallback(async () => {
    if (__DEV__) console.warn("[useFollow] follow: backend not wired (PR #8)");
    return false;
  }, []);

  const unfollow = useCallback(async () => {
    if (__DEV__) console.warn("[useFollow] unfollow: backend not wired (PR #8)");
    return false;
  }, []);

  const refresh = useCallback(async () => {
    if (__DEV__) console.warn("[useFollow] refresh: backend not wired (PR #8)");
    setIsFollowing(false);
    return false;
  }, []);

  return { isFollowing, loading, follow, unfollow, refresh };
}

export default useFollow;
