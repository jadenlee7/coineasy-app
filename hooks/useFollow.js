// hooks/useFollow.js
//
// Replacement for Orbis-based follow/unfollow.
// Wired to EasyGo /follows endpoints.
// See docs/MIGRATION_NOTES.md.

import { useCallback, useEffect, useRef, useState } from "react";
import { useDeviceAccountOperationLease } from "../contexts/DeviceAccountDataContext";
import { api } from "../utils/api";

export function useFollow(
  targetUserId,
  { enabled = true, initialFollowing = false, loadStatus = true } = {}
) {
  const { lease, isCurrentLease } = useDeviceAccountOperationLease();
  const [isFollowing, setIsFollowing] = useState(Boolean(initialFollowing));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);
  const liveTargetUserIdRef = useRef(targetUserId);
  const operationQueueRef = useRef(null);
  liveTargetUserIdRef.current = targetUserId;

  if (
    operationQueueRef.current?.lease !== lease
    || operationQueueRef.current?.targetUserId !== targetUserId
  ) {
    operationQueueRef.current = {
      lease,
      targetUserId,
      pending: 0,
      tail: Promise.resolve(),
    };
  }

  const isCurrentQueue = useCallback((queue) => Boolean(
    queue
    && operationQueueRef.current === queue
    && queue.lease
    && isCurrentLease(queue.lease)
    && liveTargetUserIdRef.current === queue.targetUserId
  ), [isCurrentLease]);

  const enqueueOperation = useCallback((operationLease, operationTargetUserId, operation) => {
    const queue = operationQueueRef.current;
    if (
      !queue
      || queue.lease !== operationLease
      || queue.targetUserId !== operationTargetUserId
      || !isCurrentQueue(queue)
    ) return Promise.resolve(null);

    queue.pending += 1;
    setLoading(true);

    const run = () => {
      if (!isCurrentQueue(queue)) return null;
      const requestId = ++requestIdRef.current;
      const isCurrentRequest = () => (
        isCurrentQueue(queue)
        && requestId === requestIdRef.current
      );
      return operation(isCurrentRequest);
    };
    const result = queue.tail.then(run, run);
    const finish = () => {
      queue.pending = Math.max(0, queue.pending - 1);
      if (isCurrentQueue(queue) && queue.pending === 0) setLoading(false);
    };
    const settled = result.then(
      (value) => {
        finish();
        return value;
      },
      (cause) => {
        finish();
        throw cause;
      },
    );
    queue.tail = settled.then(() => undefined, () => undefined);
    return settled;
  }, [isCurrentQueue]);

  const follow = useCallback(async () => {
    const operationLease = lease;
    const operationTargetUserId = targetUserId;
    if (!operationLease || !isCurrentLease(operationLease) || !operationTargetUserId) return null;
    return enqueueOperation(operationLease, operationTargetUserId, async (isCurrentRequest) => {
      setError(null);
      try {
        const result = await api.follows.follow(operationTargetUserId, {
          expectedAuthUserId: operationLease.ownerUserId,
        });
        if (!isCurrentRequest()) return null;
        if (!result) return false;
        setIsFollowing(Boolean(result.following));
        return Boolean(result.following);
      } catch (cause) {
        if (!isCurrentRequest()) return null;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        return false;
      }
    });
  }, [enqueueOperation, isCurrentLease, lease, targetUserId]);

  const unfollow = useCallback(async () => {
    const operationLease = lease;
    const operationTargetUserId = targetUserId;
    if (!operationLease || !isCurrentLease(operationLease) || !operationTargetUserId) return null;
    return enqueueOperation(operationLease, operationTargetUserId, async (isCurrentRequest) => {
      setError(null);
      try {
        const result = await api.follows.unfollow(operationTargetUserId, {
          expectedAuthUserId: operationLease.ownerUserId,
        });
        if (!isCurrentRequest()) return null;
        if (!result) return false;
        setIsFollowing(Boolean(result.following));
        return true;
      } catch (cause) {
        if (!isCurrentRequest()) return null;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        return false;
      }
    });
  }, [enqueueOperation, isCurrentLease, lease, targetUserId]);

  const refresh = useCallback(async () => {
    const operationLease = lease;
    const operationTargetUserId = targetUserId;
    if (!operationLease || !isCurrentLease(operationLease)) return null;
    return enqueueOperation(operationLease, operationTargetUserId, async (isCurrentRequest) => {
      if (!enabled || !operationTargetUserId) {
        if (!isCurrentRequest()) return null;
        setIsFollowing(Boolean(initialFollowing));
        setError(null);
        return Boolean(initialFollowing);
      }
      if (!loadStatus) {
        if (!isCurrentRequest()) return null;
        setIsFollowing(Boolean(initialFollowing));
        setError(null);
        return Boolean(initialFollowing);
      }
      setError(null);
      try {
        const result = await api.follows.status(operationTargetUserId, {
          expectedAuthUserId: operationLease.ownerUserId,
        });
        if (!isCurrentRequest()) return null;
        const next = Boolean(result?.following);
        setIsFollowing(next);
        return next;
      } catch (cause) {
        if (!isCurrentRequest()) return null;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setIsFollowing(false);
        return false;
      }
    });
  }, [enabled, enqueueOperation, initialFollowing, isCurrentLease, lease, loadStatus, targetUserId]);

  useEffect(() => {
    requestIdRef.current += 1;
    setIsFollowing(Boolean(initialFollowing));
    setError(null);

    if (lease) refresh();
    else setLoading(false);
    return () => {
      requestIdRef.current += 1;
    };
  }, [initialFollowing, lease, refresh]);

  return { isFollowing, loading, error, follow, unfollow, refresh };
}

export default useFollow;
