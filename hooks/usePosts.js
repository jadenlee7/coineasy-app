// hooks/usePosts.js
//
// Replacement for Orbis-based post fetching/creation.
// Owns EasyGo REST pagination and maps backend rows into the presentation
// shape consumed by the existing Post component.
//
// See docs/MIGRATION_NOTES.md and EASYGO_BUILD_PLAN.md §11.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../utils/api";
import { adaptSocialPost, adaptSocialPosts } from "../utils/socialPostAdapter";
import { publishSocialPostEvent, subscribeSocialPostEvents } from "../utils/socialPostEvents";

const BACKEND_CONFIGURED = Boolean(process.env.EXPO_PUBLIC_BACKEND_URL);

function pageRows(result) {
  if (Array.isArray(result)) return result;
  return Array.isArray(result?.rows) ? result.rows : [];
}

function mergeUniquePosts(current, incoming) {
  const seen = new Set(current.map((post) => post.stream_id));
  return [...current, ...incoming.filter((post) => !seen.has(post.stream_id))];
}

function normalizeCreatePayload(payload) {
  if (typeof payload === "string") return { body: payload };
  if (!payload || typeof payload !== "object") return payload;
  if (payload.body) return payload;
  if (typeof payload.content === "string") {
    const { content, ...rest } = payload;
    return { ...rest, body: content };
  }
  return payload;
}

export function usePosts({
  autoLoad = true,
  authorId = null,
  limit = 20,
  query = null,
  tag = null,
} = {}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(autoLoad && BACKEND_CONFIGURED);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(BACKEND_CONFIGURED);

  const cursorRef = useRef(null);
  const postsRef = useRef([]);
  const requestIdRef = useRef(0);
  const refreshingRef = useRef(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  useEffect(() => subscribeSocialPostEvents((event) => {
    if (event.type === "created" && event.post) {
      if (event.parentPostId) {
        setPosts((current) => current.map((post) =>
          post.stream_id === event.parentPostId
            ? { ...post, count_replies: (post.count_replies || 0) + 1 }
            : post
        ));
      } else {
        const body = String(event.post.content?.body || '').toLowerCase();
        const matchesAuthor = !authorId || event.post.easygo?.authorId === authorId;
        const matchesQuery = !query || body.includes(String(query).toLowerCase());
        const matchesTag = !tag || body.includes(String(tag).toLowerCase());
        if (!matchesAuthor || !matchesQuery || !matchesTag) return;
        setPosts((current) => [
          event.post,
          ...current.filter((post) => post.stream_id !== event.post.stream_id),
        ]);
      }
    }

    if (event.type === "removed") {
      setPosts((current) => {
        if (event.parentPostId) {
          return current.map((post) =>
            post.stream_id === event.parentPostId
              ? { ...post, count_replies: Math.max(0, (post.count_replies || 0) - 1) }
              : post
          );
        }
        return current.filter((post) => post.stream_id !== event.postId);
      });
    }

    if (event.type === "updated" && event.post) {
      const body = String(event.post.content?.body || '').toLowerCase();
      const matchesAuthor = !authorId || event.post.easygo?.authorId === authorId;
      const matchesQuery = !query || body.includes(String(query).toLowerCase());
      const matchesTag = !tag || body.includes(String(tag).toLowerCase());
      setPosts((current) => matchesAuthor && matchesQuery && matchesTag
        ? current.map((post) => post.stream_id === event.post.stream_id ? event.post : post)
        : current.filter((post) => post.stream_id !== event.post.stream_id));
    }
  }), [authorId, query, tag]);

  const fetchPage = useCallback(
    (cursor) =>
      authorId
        ? api.posts.timeline(authorId, { cursor, limit })
        : api.posts.feed({ cursor, limit, q: query, tag }),
    [authorId, limit, query, tag]
  );

  const refresh = useCallback(async () => {
    if (!BACKEND_CONFIGURED) {
      cursorRef.current = null;
      setPosts([]);
      setError(null);
      setHasMore(false);
      setLoading(false);
      setRefreshing(false);
      return [];
    }

    if (refreshingRef.current) return postsRef.current;
    refreshingRef.current = true;
    const requestId = ++requestIdRef.current;
    const initialLoad = postsRef.current.length === 0;

    setError(null);
    if (initialLoad) setLoading(true);
    else setRefreshing(true);

    try {
      const result = await fetchPage(null);
      if (requestId !== requestIdRef.current) return [];

      const nextPosts = adaptSocialPosts(pageRows(result));
      const nextCursor = result?.nextCursor || null;
      cursorRef.current = nextCursor;
      setPosts(nextPosts);
      setHasMore(Boolean(nextCursor));
      return nextPosts;
    } catch (cause) {
      if (requestId !== requestIdRef.current) return [];
      const nextError = cause instanceof Error ? cause : new Error(String(cause));
      setError(nextError);
      return [];
    } finally {
      if (requestId === requestIdRef.current) {
        refreshingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current;
    if (!BACKEND_CONFIGURED || !cursor || loadingMoreRef.current) return [];

    loadingMoreRef.current = true;
    const requestId = requestIdRef.current;
    setLoadingMore(true);

    try {
      const result = await fetchPage(cursor);
      if (requestId !== requestIdRef.current) return [];

      const nextPosts = adaptSocialPosts(pageRows(result));
      const nextCursor = result?.nextCursor || null;
      cursorRef.current = nextCursor;
      setPosts((current) => mergeUniquePosts(current, nextPosts));
      setHasMore(Boolean(nextCursor));
      return nextPosts;
    } catch (cause) {
      if (requestId === requestIdRef.current) {
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      }
      return [];
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [fetchPage]);

  const create = useCallback(async (payload) => {
    try {
      const normalized = normalizeCreatePayload(payload);
      const result = await api.posts.create(normalized);
      const created = adaptSocialPost(result?.post || result);
      if (created) {
        publishSocialPostEvent({
          type: "created",
          post: created,
          parentPostId: normalized?.parentPostId || null,
        });
      }
      return created;
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
      return null;
    }
  }, []);

  const remove = useCallback(async (postId) => {
    try {
      const existing = postsRef.current.find((post) => post.stream_id === postId);
      const result = await api.posts.remove(postId);
      if (!result) return false;
      publishSocialPostEvent({
        type: "removed",
        postId,
        parentPostId: existing?.easygo?.parentPostId || null,
      });
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
      return false;
    }
  }, []);

  const update = useCallback(async (postId, payload) => {
    try {
      const normalized = normalizeCreatePayload(payload);
      const result = await api.posts.update(postId, normalized);
      const updated = adaptSocialPost(result?.post || result);
      if (updated) publishSocialPostEvent({ type: "updated", post: updated });
      return updated;
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
      return null;
    }
  }, []);

  useEffect(() => {
    requestIdRef.current += 1;
    cursorRef.current = null;
    postsRef.current = [];
    setPosts([]);
    setError(null);
    setHasMore(BACKEND_CONFIGURED);

    if (autoLoad) refresh();
    else setLoading(false);

    return () => {
      requestIdRef.current += 1;
      refreshingRef.current = false;
    };
  }, [autoLoad, refresh]);

  return {
    posts,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    backendConfigured: BACKEND_CONFIGURED,
    refresh,
    loadMore,
    create,
    update,
    remove,
  };
}

export default usePosts;
