// hooks/useFeed.js
//
// Replacement for Orbis-based category/feed listing (e.g. Categories, News).
// Backend wiring lands in PR #8.
// See docs/MIGRATION_NOTES.md.

import { useCallback, useState } from "react";

export function useFeed(_feedKey) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (__DEV__) console.warn("[useFeed] refresh: backend not wired (PR #8)");
    setItems([]);
    return [];
  }, []);

  const loadMore = useCallback(async () => {
    if (__DEV__) console.warn("[useFeed] loadMore: backend not wired (PR #8)");
    return [];
  }, []);

  return { items, loading, error, refresh, loadMore };
}

export default useFeed;
