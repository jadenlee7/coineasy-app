// hooks/usePosts.js
//
// Replacement for Orbis-based post fetching/creation.
// Backend wiring lands in PR #8 (Prisma Post model + REST API).
// In PR #7 this hook returns empty data + noop mutators so screens render
// without crashing during the Orbis-removal migration.
//
// See docs/MIGRATION_NOTES.md and EASYGO_BUILD_PLAN.md §11.

import { useCallback, useState } from "react";

export function usePosts(_options = {}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (__DEV__) console.warn("[usePosts] refresh: backend not wired (PR #8)");
    setPosts([]);
    return [];
  }, []);

  const loadMore = useCallback(async () => {
    if (__DEV__) console.warn("[usePosts] loadMore: backend not wired (PR #8)");
    return [];
  }, []);

  const create = useCallback(async (_payload) => {
    if (__DEV__) console.warn("[usePosts] create: backend not wired (PR #8)");
    return null;
  }, []);

  const remove = useCallback(async (_postId) => {
    if (__DEV__) console.warn("[usePosts] remove: backend not wired (PR #8)");
    return false;
  }, []);

  return { posts, loading, error, refresh, loadMore, create, remove };
}

export default usePosts;
