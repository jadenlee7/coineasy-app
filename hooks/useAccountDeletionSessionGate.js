import { useCallback, useEffect, useMemo, useState } from 'react';

import { accountDeletionMarkerStore } from '../utils/accountDeletionStorage';

function normalizedUserId(value) {
  if (typeof value !== 'string') return null;
  return value.trim() || null;
}

function loadingSnapshot(ownerUserId) {
  return Object.freeze({
    ownerUserId,
    status: ownerUserId ? 'loading' : 'clear',
    marker: null,
    subjectKey: null,
    errorCode: null,
  });
}

export default function useAccountDeletionSessionGate(userId) {
  const ownerUserId = normalizedUserId(userId);
  const [reloadToken, setReloadToken] = useState(0);
  const [snapshot, setSnapshot] = useState(() => loadingSnapshot(ownerUserId));

  useEffect(() => {
    let active = true;
    let generation = 0;
    let loadedSubjectKey = null;

    const publishLoad = async ({ showLoading = true } = {}) => {
      const requestGeneration = ++generation;
      if (showLoading) setSnapshot(loadingSnapshot(ownerUserId));

      try {
        const result = await accountDeletionMarkerStore.load(ownerUserId);
        if (!active || requestGeneration !== generation) return;
        loadedSubjectKey = result.subjectKey;
        setSnapshot(Object.freeze({
          ownerUserId,
          status: result.status,
          marker: result.marker,
          subjectKey: result.subjectKey,
          errorCode: null,
        }));
      } catch (error) {
        if (!active || requestGeneration !== generation) return;
        setSnapshot(Object.freeze({
          ownerUserId,
          status: 'storage-error',
          marker: null,
          subjectKey: loadedSubjectKey,
          errorCode: error?.code || 'account_deletion_marker_unavailable',
        }));
      }
    };

    const unsubscribe = accountDeletionMarkerStore.subscribe((event) => {
      if (!active || !ownerUserId) return;
      if (event?.type === 'blocking' && loadedSubjectKey === event.subjectKey) {
        generation += 1;
        setSnapshot((current) => Object.freeze({
          ...current,
          ownerUserId,
          status: 'blocking',
          marker: current.marker,
          errorCode: null,
        }));
        return;
      }
      if (!event?.subjectKey || !loadedSubjectKey || event.subjectKey === loadedSubjectKey) {
        void publishLoad({ showLoading: false });
      }
    });

    void publishLoad();
    return () => {
      active = false;
      generation += 1;
      unsubscribe();
    };
  }, [ownerUserId, reloadToken]);

  const retry = useCallback(() => setReloadToken((value) => value + 1), []);

  return useMemo(() => {
    if (snapshot.ownerUserId !== ownerUserId) return {
      ...loadingSnapshot(ownerUserId),
      retry,
    };
    return { ...snapshot, retry };
  }, [ownerUserId, retry, snapshot]);
}
