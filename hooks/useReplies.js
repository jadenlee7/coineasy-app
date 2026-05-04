// hooks/useReplies.js
//
// Replacement for Orbis-based reply (comment) fetching/creation.
// Backend wiring lands in PR #8.
// See docs/MIGRATION_NOTES.md.

import { useCallback, useState } from "react";

export function useReplies(_postId) {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (__DEV__) console.warn("[useReplies] refresh: backend not wired (PR #8)");
    setReplies([]);
    return [];
  }, []);

  const create = useCallback(async (_payload) => {
    if (__DEV__) console.warn("[useReplies] create: backend not wired (PR #8)");
    return null;
  }, []);

  const remove = useCallback(async (_replyId) => {
    if (__DEV__) console.warn("[useReplies] remove: backend not wired (PR #8)");
    return false;
  }, []);

  return { replies, loading, error, refresh, create, remove };
}

export default useReplies;
