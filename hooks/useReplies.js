// hooks/useReplies.js
//
// Replacement for Orbis-based reply (comment) fetching/creation.
// Replies are Post rows with parentPostId in the EasyGo backend.
// See docs/MIGRATION_NOTES.md.

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

function createRepliesTarget(lease, { autoLoad, limit, postId }) {
  if (!lease) return null;
  return Object.freeze({
    ownerUserId: lease.ownerUserId,
    sessionEpoch: lease.sessionEpoch,
    autoLoad: Boolean(autoLoad),
    limit,
    postId: postId || null,
  });
}

function sameRepliesTarget(left, right) {
  return Boolean(
    left
    && right
    && left.ownerUserId === right.ownerUserId
    && left.sessionEpoch === right.sessionEpoch
    && left.autoLoad === right.autoLoad
    && left.limit === right.limit
    && left.postId === right.postId
  );
}

export function useReplies(postId, { autoLoad = true, limit = 20 } = {}) {
  const { lease, isCurrentLease } = useDeviceAccountOperationLease();
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(autoLoad && BACKEND_CONFIGURED && Boolean(postId));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [presentedTarget, setPresentedTarget] = useState(null);
  const cursorRef = useRef(null);
  const requestIdRef = useRef(0);
  const refreshingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const presentedTargetRef = useRef(null);
  const liveTargetRef = useRef(null);
  liveTargetRef.current = createRepliesTarget(lease, { autoLoad, limit, postId });

  useEffect(() => {
    const subscriptionLease = lease;
    const subscriptionTarget = createRepliesTarget(subscriptionLease, {
      autoLoad,
      limit,
      postId,
    });
    if (!subscriptionLease || !isCurrentLease(subscriptionLease)) return undefined;

    return subscribeSocialPostEvents((event) => {
      if (
        !isCurrentLease(subscriptionLease)
        || !sameRepliesTarget(liveTargetRef.current, subscriptionTarget)
      ) return;

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
    });
  }, [autoLoad, isCurrentLease, lease, limit, postId]);

  const refresh = useCallback(async () => {
    const operationLease = lease;
    if (!operationLease || !isCurrentLease(operationLease)) return [];
    const operationTarget = createRepliesTarget(operationLease, { autoLoad, limit, postId });
    const targetChanged = !sameRepliesTarget(presentedTargetRef.current, operationTarget);
    const isCurrentTarget = () => sameRepliesTarget(liveTargetRef.current, operationTarget);

    if (targetChanged) {
      presentedTargetRef.current = operationTarget;
      setPresentedTarget(operationTarget);
      cursorRef.current = null;
      setReplies([]);
      setError(null);
      setHasMore(false);
      refreshingRef.current = false;
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }

    if (!BACKEND_CONFIGURED || !postId) {
      cursorRef.current = null;
      setReplies([]);
      setError(null);
      setHasMore(false);
      setLoading(false);
      return [];
    }

    refreshingRef.current = true;
    // Refresh owns the cursor now. Drop the pagination latch for the previous
    // cursor; requestId guards its eventual completion.
    loadingMoreRef.current = false;
    setLoadingMore(false);
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api.posts.replies(postId, {
        limit,
        expectedAuthUserId: operationLease.ownerUserId,
      });
      if (!isCurrentLease(operationLease) || requestId !== requestIdRef.current) return [];
      if (!isCurrentTarget()) return [];
      const nextReplies = adaptSocialPosts(pageRows(result));
      const nextCursor = result?.nextCursor || null;
      cursorRef.current = nextCursor;
      setReplies(nextReplies);
      setHasMore(Boolean(nextCursor));
      return nextReplies;
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
        refreshingRef.current = false;
        setLoading(false);
      }
    }
  }, [autoLoad, isCurrentLease, lease, limit, postId]);

  const loadMore = useCallback(async () => {
    const operationLease = lease;
    if (!operationLease || !isCurrentLease(operationLease)) return [];
    const operationTarget = createRepliesTarget(operationLease, { autoLoad, limit, postId });
    const isCurrentTarget = () => (
      sameRepliesTarget(liveTargetRef.current, operationTarget)
      && sameRepliesTarget(presentedTargetRef.current, operationTarget)
    );

    const cursor = cursorRef.current;
    if (
      !BACKEND_CONFIGURED
      || !postId
      || !cursor
      || refreshingRef.current
      || loadingMoreRef.current
      || !isCurrentTarget()
    ) return [];
    loadingMoreRef.current = true;
    const requestId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const result = await api.posts.replies(postId, {
        cursor,
        limit,
        expectedAuthUserId: operationLease.ownerUserId,
      });
      if (!isCurrentLease(operationLease) || requestId !== requestIdRef.current) return [];
      if (!isCurrentTarget()) return [];
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
  }, [autoLoad, isCurrentLease, lease, limit, postId]);

  const create = useCallback(async (payload) => {
    const operationLease = lease;
    if (!operationLease || !isCurrentLease(operationLease) || !postId) return null;

    setError(null);
    try {
      const normalized = { ...normalizePayload(payload), parentPostId: postId };
      const result = await api.posts.create(normalized, {
        expectedAuthUserId: operationLease.ownerUserId,
      });
      if (!isCurrentLease(operationLease)) return null;
      const created = adaptSocialPost(result?.post || result);
      if (created) {
        publishSocialPostEvent({ type: "created", post: created, parentPostId: postId });
      }
      return created;
    } catch (cause) {
      if (!isCurrentLease(operationLease)) return null;
      setError(cause instanceof Error ? cause : new Error(String(cause)));
      return null;
    }
  }, [isCurrentLease, lease, postId]);

  const remove = useCallback(async (replyId) => {
    const operationLease = lease;
    if (!operationLease || !isCurrentLease(operationLease)) return false;

    setError(null);
    try {
      const result = await api.posts.remove(replyId, {
        expectedAuthUserId: operationLease.ownerUserId,
      });
      if (!isCurrentLease(operationLease)) return false;
      if (!result) return false;
      publishSocialPostEvent({ type: "removed", postId: replyId, parentPostId: postId });
      return true;
    } catch (cause) {
      if (!isCurrentLease(operationLease)) return false;
      setError(cause instanceof Error ? cause : new Error(String(cause)));
      return false;
    }
  }, [isCurrentLease, lease, postId]);

  useEffect(() => {
    requestIdRef.current += 1;
    cursorRef.current = null;
    setReplies([]);
    setError(null);
    setHasMore(false);
    refreshingRef.current = false;
    loadingMoreRef.current = false;
    setLoadingMore(false);

    if (autoLoad && lease) refresh();
    else {
      const idleTarget = createRepliesTarget(lease, { autoLoad, limit, postId });
      presentedTargetRef.current = idleTarget;
      setPresentedTarget(idleTarget);
      setLoading(false);
      setLoadingMore(false);
    }
    return () => {
      requestIdRef.current += 1;
      refreshingRef.current = false;
      loadingMoreRef.current = false;
    };
  }, [autoLoad, lease, limit, postId, refresh]);

  const ownsPresentedTarget = sameRepliesTarget(
    presentedTarget,
    liveTargetRef.current,
  );

  return {
    replies: ownsPresentedTarget ? replies : [],
    loading: ownsPresentedTarget
      ? loading
      : Boolean(autoLoad && BACKEND_CONFIGURED && postId && lease),
    loadingMore: ownsPresentedTarget ? loadingMore : false,
    error: ownsPresentedTarget ? error : null,
    hasMore: ownsPresentedTarget ? hasMore : false,
    backendConfigured: BACKEND_CONFIGURED,
    refresh,
    loadMore,
    create,
    remove,
  };
}

export default useReplies;
