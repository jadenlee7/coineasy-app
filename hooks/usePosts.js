// hooks/usePosts.js
//
// Replacement for Orbis-based post fetching/creation.
// Owns EasyGo REST pagination and maps backend rows into the presentation
// shape consumed by the existing Post component.
//
// See docs/MIGRATION_NOTES.md and EASYGO_BUILD_PLAN.md §11.

import { useCallback, useEffect, useRef, useState } from "react";
import { useDeviceAccountOperationLease } from "../contexts/DeviceAccountDataContext";
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

function createPostsTarget(lease, { autoLoad, authorId, limit, query, tag }) {
  if (!lease) return null;
  return Object.freeze({
    ownerUserId: lease.ownerUserId,
    sessionEpoch: lease.sessionEpoch,
    autoLoad: Boolean(autoLoad),
    authorId: authorId || null,
    limit,
    query: query || null,
    tag: tag || null,
  });
}

function samePostsTarget(left, right) {
  return Boolean(
    left
    && right
    && left.ownerUserId === right.ownerUserId
    && left.sessionEpoch === right.sessionEpoch
    && left.autoLoad === right.autoLoad
    && left.authorId === right.authorId
    && left.limit === right.limit
    && left.query === right.query
    && left.tag === right.tag
  );
}

export function usePosts({
  autoLoad = true,
  authorId = null,
  limit = 20,
  query = null,
  tag = null,
} = {}) {
  const { lease, isCurrentLease } = useDeviceAccountOperationLease();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(autoLoad && BACKEND_CONFIGURED);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(BACKEND_CONFIGURED);
  const [presentedTarget, setPresentedTarget] = useState(null);

  const cursorRef = useRef(null);
  const postsRef = useRef([]);
  const requestIdRef = useRef(0);
  const refreshingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const presentedTargetRef = useRef(null);
  const liveTargetRef = useRef(null);
  liveTargetRef.current = createPostsTarget(lease, {
    autoLoad,
    authorId,
    limit,
    query,
    tag,
  });

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  useEffect(() => {
    const subscriptionLease = lease;
    const subscriptionTarget = createPostsTarget(subscriptionLease, {
      autoLoad,
      authorId,
      limit,
      query,
      tag,
    });
    if (!subscriptionLease || !isCurrentLease(subscriptionLease)) return undefined;

    return subscribeSocialPostEvents((event) => {
      if (
        !isCurrentLease(subscriptionLease)
        || !samePostsTarget(liveTargetRef.current, subscriptionTarget)
      ) return;

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
    });
  }, [autoLoad, authorId, isCurrentLease, lease, limit, query, tag]);

  const fetchPage = useCallback(
    (cursor, operationLease) =>
      authorId
        ? api.posts.timeline(authorId, {
          cursor,
          limit,
          expectedAuthUserId: operationLease.ownerUserId,
        })
        : api.posts.feed({
          cursor,
          limit,
          q: query,
          tag,
          expectedAuthUserId: operationLease.ownerUserId,
        }),
    [authorId, limit, query, tag]
  );

  const refresh = useCallback(async () => {
    const operationLease = lease;
    if (!operationLease || !isCurrentLease(operationLease)) return [];
    const operationTarget = createPostsTarget(operationLease, {
      autoLoad,
      authorId,
      limit,
      query,
      tag,
    });
    const targetChanged = !samePostsTarget(presentedTargetRef.current, operationTarget);
    const isCurrentTarget = () => samePostsTarget(liveTargetRef.current, operationTarget);

    if (targetChanged) {
      presentedTargetRef.current = operationTarget;
      setPresentedTarget(operationTarget);
      cursorRef.current = null;
      postsRef.current = [];
      setPosts([]);
      setError(null);
      setHasMore(BACKEND_CONFIGURED);
      refreshingRef.current = false;
      setRefreshing(false);
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }

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
    // A refresh supersedes any pagination request for the previous cursor.
    // Release its latch immediately; the request id still prevents its late
    // completion from mutating this session.
    loadingMoreRef.current = false;
    setLoadingMore(false);
    const requestId = ++requestIdRef.current;
    const initialLoad = targetChanged || postsRef.current.length === 0;

    setError(null);
    if (initialLoad) setLoading(true);
    else setRefreshing(true);

    try {
      const result = await fetchPage(null, operationLease);
      if (!isCurrentLease(operationLease) || requestId !== requestIdRef.current) return [];
      if (!isCurrentTarget()) return [];

      const nextPosts = adaptSocialPosts(pageRows(result));
      const nextCursor = result?.nextCursor || null;
      cursorRef.current = nextCursor;
      setPosts(nextPosts);
      setHasMore(Boolean(nextCursor));
      return nextPosts;
    } catch (cause) {
      if (!isCurrentLease(operationLease) || requestId !== requestIdRef.current) return [];
      if (!isCurrentTarget()) return [];
      const nextError = cause instanceof Error ? cause : new Error(String(cause));
      setError(nextError);
      return [];
    } finally {
      if (
        isCurrentLease(operationLease)
        && requestId === requestIdRef.current
        && isCurrentTarget()
      ) {
        refreshingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [autoLoad, authorId, fetchPage, isCurrentLease, lease, limit, query, tag]);

  const loadMore = useCallback(async () => {
    const operationLease = lease;
    if (!operationLease || !isCurrentLease(operationLease)) return [];
    const operationTarget = createPostsTarget(operationLease, {
      autoLoad,
      authorId,
      limit,
      query,
      tag,
    });
    const isCurrentTarget = () => (
      samePostsTarget(liveTargetRef.current, operationTarget)
      && samePostsTarget(presentedTargetRef.current, operationTarget)
    );

    const cursor = cursorRef.current;
    if (
      !BACKEND_CONFIGURED
      || !cursor
      || refreshingRef.current
      || loadingMoreRef.current
      || !isCurrentTarget()
    ) return [];

    loadingMoreRef.current = true;
    const requestId = requestIdRef.current;
    setLoadingMore(true);

    try {
      const result = await fetchPage(cursor, operationLease);
      if (!isCurrentLease(operationLease) || requestId !== requestIdRef.current) return [];
      if (!isCurrentTarget()) return [];

      const nextPosts = adaptSocialPosts(pageRows(result));
      const nextCursor = result?.nextCursor || null;
      cursorRef.current = nextCursor;
      setPosts((current) => mergeUniquePosts(current, nextPosts));
      setHasMore(Boolean(nextCursor));
      return nextPosts;
    } catch (cause) {
      if (
        isCurrentLease(operationLease)
        && requestId === requestIdRef.current
        && isCurrentTarget()
      ) {
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      }
      return [];
    } finally {
      if (
        isCurrentLease(operationLease)
        && requestId === requestIdRef.current
        && isCurrentTarget()
      ) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [autoLoad, authorId, fetchPage, isCurrentLease, lease, limit, query, tag]);

  const create = useCallback(async (payload) => {
    const operationLease = lease;
    if (!operationLease || !isCurrentLease(operationLease)) return null;

    try {
      const normalized = normalizeCreatePayload(payload);
      const result = await api.posts.create(normalized, {
        expectedAuthUserId: operationLease.ownerUserId,
      });
      if (!isCurrentLease(operationLease)) return null;
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
      if (!isCurrentLease(operationLease)) return null;
      setError(cause instanceof Error ? cause : new Error(String(cause)));
      return null;
    }
  }, [isCurrentLease, lease]);

  const remove = useCallback(async (postId) => {
    const operationLease = lease;
    if (!operationLease || !isCurrentLease(operationLease)) return false;

    try {
      const existing = postsRef.current.find((post) => post.stream_id === postId);
      const result = await api.posts.remove(postId, {
        expectedAuthUserId: operationLease.ownerUserId,
      });
      if (!isCurrentLease(operationLease)) return false;
      if (!result) return false;
      publishSocialPostEvent({
        type: "removed",
        postId,
        parentPostId: existing?.easygo?.parentPostId || null,
      });
      return true;
    } catch (cause) {
      if (!isCurrentLease(operationLease)) return false;
      setError(cause instanceof Error ? cause : new Error(String(cause)));
      return false;
    }
  }, [isCurrentLease, lease]);

  const update = useCallback(async (postId, payload) => {
    const operationLease = lease;
    if (!operationLease || !isCurrentLease(operationLease)) return null;

    try {
      const normalized = normalizeCreatePayload(payload);
      const result = await api.posts.update(postId, normalized, {
        expectedAuthUserId: operationLease.ownerUserId,
      });
      if (!isCurrentLease(operationLease)) return null;
      const updated = adaptSocialPost(result?.post || result);
      if (updated) publishSocialPostEvent({ type: "updated", post: updated });
      return updated;
    } catch (cause) {
      if (!isCurrentLease(operationLease)) return null;
      setError(cause instanceof Error ? cause : new Error(String(cause)));
      return null;
    }
  }, [isCurrentLease, lease]);

  useEffect(() => {
    requestIdRef.current += 1;
    cursorRef.current = null;
    postsRef.current = [];
    setPosts([]);
    setError(null);
    setHasMore(BACKEND_CONFIGURED);
    loadingMoreRef.current = false;
    setLoadingMore(false);

    if (autoLoad && lease) refresh();
    else {
      const idleTarget = createPostsTarget(lease, {
        autoLoad,
        authorId,
        limit,
        query,
        tag,
      });
      presentedTargetRef.current = idleTarget;
      setPresentedTarget(idleTarget);
      setLoading(false);
    }

    return () => {
      requestIdRef.current += 1;
      refreshingRef.current = false;
      loadingMoreRef.current = false;
    };
  }, [autoLoad, authorId, lease, limit, query, refresh, tag]);

  const ownsPresentedTarget = samePostsTarget(
    presentedTarget,
    liveTargetRef.current,
  );

  return {
    posts: ownsPresentedTarget ? posts : [],
    loading: ownsPresentedTarget
      ? loading
      : Boolean(autoLoad && BACKEND_CONFIGURED && lease),
    refreshing: ownsPresentedTarget ? refreshing : false,
    loadingMore: ownsPresentedTarget ? loadingMore : false,
    error: ownsPresentedTarget ? error : null,
    hasMore: ownsPresentedTarget ? hasMore : false,
    backendConfigured: BACKEND_CONFIGURED,
    refresh,
    loadMore,
    create,
    update,
    remove,
  };
}

export default usePosts;
