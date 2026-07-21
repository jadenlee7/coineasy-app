// hooks/useFollow.js
//
// Replacement for Orbis-based follow/unfollow.
// Wired to EasyGo /follows endpoints.
// See docs/MIGRATION_NOTES.md.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../utils/api";

export function useFollow(
  targetUserId,
  { enabled = true, initialFollowing = false, loadStatus = true } = {}
) {
  const [isFollowing, setIsFollowing] = useState(Boolean(initialFollowing));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const follow = useCallback(async () => {
    if (!targetUserId) return false;
    setLoading(true);
    setError(null);
    try {
      const result = await api.follows.follow(targetUserId);
      if (!result) return false;
      setIsFollowing(Boolean(result.following));
      return Boolean(result.following);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
      return false;
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  const unfollow = useCallback(async () => {
    if (!targetUserId) return false;
    setLoading(true);
    setError(null);
    try {
      const result = await api.follows.unfollow(targetUserId);
      if (!result) return false;
      setIsFollowing(Boolean(result.following));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
      return false;
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  const refresh = useCallback(async () => {
    if (!enabled || !targetUserId) {
      setIsFollowing(Boolean(initialFollowing));
      setError(null);
      return Boolean(initialFollowing);
    }
    if (!loadStatus) {
      setIsFollowing(Boolean(initialFollowing));
      setError(null);
      return Boolean(initialFollowing);
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api.follows.status(targetUserId);
      if (requestId !== requestIdRef.current) return false;
      const next = Boolean(result?.following);
      setIsFollowing(next);
      return next;
    } catch (cause) {
      if (requestId === requestIdRef.current) {
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setIsFollowing(false);
      }
      return false;
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [enabled, initialFollowing, loadStatus, targetUserId]);

  useEffect(() => {
    refresh();
    return () => {
      requestIdRef.current += 1;
    };
  }, [refresh]);

  return { isFollowing, loading, error, follow, unfollow, refresh };
}

export default useFollow;
