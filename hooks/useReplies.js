// hooks/useReplies.js
//
// Replacement for Orbis-based reply (comment) fetching/creation.
// Replies are Post rows with parentPostId in the EasyGo backend.
// See docs/MIGRATION_NOTES.md.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../utils/api";
import { adaptSocialPost, adaptSocialPosts } from "../utils/socialPostAdapter";
import { publishSocialPostEvent, subscribeSocialPostEvents } from "../utils/socialPostEvents";

const BACKEND_CONFIGURED = Boolean(process.env.EXPO_PUBLIC_BACKEND_URL);

function pageRows(result) {
  if (Array.isArray(result)) return result;
  return Array.isArray(result?.rows) ? result.rows : [];
}

function normalizePayload(payload) {
  if (typeof payload === "string") return { body: payload };
  if (!payload || typeof payload !== "object") return payload;
  if (payload.body) return payload;
  if (typeof payload.content === "string") {
    const { content, ...rest } = payload;
    return { ...rest, body: content };
  }
  return payload;
}

export function useReplies(postId, { autoLoad = true, limit = 20 } = {}) {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(autoLoad && BACKEND_CONFIGURED && Boolean(postId));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef(null);
  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  useEffect(() => subscribeSocialPostEvents((event) => {
    if (event.type === "created" && event.parentPostId === postId && event.post) {
      setReplies((current) => [
        ...current.filter((reply) => reply.stream_id !== event.post.stream_id),
        event.post,
      ]);
    }
    if (event.type === "removed" && event.parentPostId === postId) {
      setReplies((current) => current.filter((reply) => reply.stream_id !== event.postId));
    }
    if (event.type === "updated" && event.post?.easygo?.parentPostId === postId) {
      setReplies((current) => current.map((reply) =>
        reply.stream_id === event.post.stream_id ? event.post : reply
      ));
    }
  }), [postId]);

  const refresh = useCallback(async () => {
    if (!BACKEND_CONFIGURED || !postId) {
      cursorRef.current = null;
      setReplies([]);
      setError(null);
      setHasMore(false);
      setLoading(false);
      return [];
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api.posts.replies(postId, { limit });
      if (requestId !== requestIdRef.current) return [];
      const nextReplies = adaptSocialPosts(pageRows(result));
      const nextCursor = result?.nextCursor || null;
      cursorRef.current = nextCursor;
      setReplies(nextReplies);
      setHasMore(Boolean(nextCursor));
      return nextReplies;
    } catch (cause) {
      if (requestId === requestIdRef.current) {
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      }
      return [];
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [limit, postId]);

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current;
    if (!BACKEND_CONFIGURED || !postId || !cursor || loadingMoreRef.current) return [];
    loadingMoreRef.current = true;
    const requestId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const result = await api.posts.replies(postId, { cursor, limit });
      if (requestId !== requestIdRef.current) return [];
      const nextReplies = adaptSocialPosts(pageRows(result));
      const nextCursor = result?.nextCursor || null;
      cursorRef.current = nextCursor;
      setReplies((current) => [
        ...current,
        ...nextReplies.filter((reply) => !current.some((item) => item.stream_id === reply.stream_id)),
      ]);
      setHasMore(Boolean(nextCursor));
      return nextReplies;
    } catch (cause) {
      if (requestId === requestIdRef.current) {
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      }
      return [];
    } finally {
      loadingMoreRef.current = false;
      if (requestId === requestIdRef.current) setLoadingMore(false);
    }
  }, [limit, postId]);

  const create = useCallback(async (payload) => {
    if (!postId) return null;
    setError(null);
    try {
      const normalized = { ...normalizePayload(payload), parentPostId: postId };
      const result = await api.posts.create(normalized);
      const created = adaptSocialPost(result?.post || result);
      if (created) {
        publishSocialPostEvent({ type: "created", post: created, parentPostId: postId });
      }
      return created;
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
      return null;
    }
  }, [postId]);

  const remove = useCallback(async (replyId) => {
    setError(null);
    try {
      const result = await api.posts.remove(replyId);
      if (!result) return false;
      publishSocialPostEvent({ type: "removed", postId: replyId, parentPostId: postId });
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
      return false;
    }
  }, [postId]);

  useEffect(() => {
    if (autoLoad) refresh();
    else setLoading(false);
    return () => {
      requestIdRef.current += 1;
      loadingMoreRef.current = false;
    };
  }, [autoLoad, refresh]);

  return {
    replies,
    loading,
    loadingMore,
    error,
    hasMore,
    backendConfigured: BACKEND_CONFIGURED,
    refresh,
    loadMore,
    create,
    remove,
  };
}

export default useReplies;
