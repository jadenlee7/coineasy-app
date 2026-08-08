import { useCallback, useEffect, useRef, useState } from 'react';

import { useDeviceAccountOperationLease } from '../contexts/DeviceAccountDataContext';
import { api } from '../utils/api';
import { adaptSocialAuthor } from '../utils/socialPostAdapter';

const BACKEND_CONFIGURED = Boolean(process.env.EXPO_PUBLIC_BACKEND_URL);

function toUnixTimestamp(value) {
  const milliseconds = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1000) : null;
}

function adaptNotification(row) {
  if (!row?.id || !row?.actor) return null;
  return {
    id: row.id,
    family: row.family,
    notification_timestamp: toUnixTimestamp(row.createdAt),
    user_notifiying_details: adaptSocialAuthor(row.actor),
    post_details: row.postId ? { stream_id: row.postId } : null,
    postPreview: row.postPreview || null,
  };
}

export function useNotifications({ autoLoad = true, limit = 50 } = {}) {
  const { lease, isCurrentLease } = useDeviceAccountOperationLease();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(autoLoad && BACKEND_CONFIGURED);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);
  const notificationsRef = useRef([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const refresh = useCallback(async () => {
    const operationLease = lease;
    if (!operationLease || !isCurrentLease(operationLease)) return [];

    if (!BACKEND_CONFIGURED) {
      setNotifications([]);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return [];
    }

    const requestId = ++requestIdRef.current;
    if (notificationsRef.current.length === 0) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const result = await api.notifications.list({
        limit,
        expectedAuthUserId: operationLease.ownerUserId,
      });
      if (!isCurrentLease(operationLease) || requestId !== requestIdRef.current) return [];
      const next = (result?.rows || []).map(adaptNotification).filter(Boolean);
      setNotifications(next);
      return next;
    } catch (cause) {
      if (isCurrentLease(operationLease) && requestId === requestIdRef.current) {
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      }
      return [];
    } finally {
      if (isCurrentLease(operationLease) && requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [isCurrentLease, lease, limit]);

  useEffect(() => {
    requestIdRef.current += 1;
    notificationsRef.current = [];
    setNotifications([]);
    setError(null);

    if (autoLoad && lease) refresh();
    else {
      setLoading(false);
      setRefreshing(false);
    }
    return () => { requestIdRef.current += 1; };
  }, [autoLoad, lease, refresh]);

  return {
    notifications,
    loading,
    refreshing,
    error,
    backendConfigured: BACKEND_CONFIGURED,
    refresh,
  };
}

export default useNotifications;
