import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { usePrivy } from '@privy-io/expo';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  DEVICE_ACCOUNT_DATA_SLOT,
  DeviceAccountDataError,
  createDeviceAccountLease,
  createOwnerScopedDeviceAccountDataStore,
  sameDeviceAccountLease,
} from '../utils/deviceAccountDataStore.mjs';

const EMPTY_DATA = Object.freeze({
  blockedAccounts: Object.freeze([]),
  courseProgress: Object.freeze([]),
  dailyRunProgress: null,
  expoPushToken: null,
  hiddenPosts: Object.freeze([]),
  mutedAccounts: Object.freeze([]),
  recentProfiles: Object.freeze([]),
});

function emptySnapshot(lease, status = lease ? 'loading' : 'ready', errorCode = null) {
  return Object.freeze({
    lease,
    status,
    errorCode,
    data: EMPTY_DATA,
  });
}

function parsedList(value) {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parsedObject(value) {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.freeze(parsed)
      : null;
  } catch {
    return null;
  }
}

function hydratedData(values) {
  return Object.freeze({
    blockedAccounts: Object.freeze(parsedList(values[DEVICE_ACCOUNT_DATA_SLOT.blockedAccounts])),
    courseProgress: Object.freeze(parsedList(values[DEVICE_ACCOUNT_DATA_SLOT.courseProgress])),
    dailyRunProgress: parsedObject(values[DEVICE_ACCOUNT_DATA_SLOT.dailyRunProgress]),
    expoPushToken: typeof values[DEVICE_ACCOUNT_DATA_SLOT.expoPushToken] === 'string'
      ? values[DEVICE_ACCOUNT_DATA_SLOT.expoPushToken]
      : null,
    hiddenPosts: Object.freeze(parsedList(values[DEVICE_ACCOUNT_DATA_SLOT.hiddenPosts])),
    mutedAccounts: Object.freeze(parsedList(values[DEVICE_ACCOUNT_DATA_SLOT.mutedAccounts])),
    recentProfiles: Object.freeze(parsedList(values[DEVICE_ACCOUNT_DATA_SLOT.recentProfiles])),
  });
}

async function hashOwnerUserId(ownerUserId) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    ownerUserId,
  );
}

const ownerDataStore = createOwnerScopedDeviceAccountDataStore({
  storage: AsyncStorage,
  subjectKeyFor: hashOwnerUserId,
});

const DeviceAccountDataContext = createContext(null);

function matchingLease(left, right) {
  return (!left && !right) || sameDeviceAccountLease(left, right);
}

function currentLeaseError(error) {
  return error instanceof DeviceAccountDataError && [
    'device_account_owner_sealed',
    'device_account_session_stale',
  ].includes(error.code);
}

export function DeviceAccountDataProvider({ children }) {
  const privy = usePrivy();
  const authenticated = privy?.authenticated ?? Boolean(privy?.user);
  const rawOwnerUserId = authenticated ? (privy?.user?.id ?? null) : null;
  const previousOwnerRef = useRef(Symbol('uninitialized-owner'));
  const epochRef = useRef(0);
  const leaseRef = useRef(null);
  const leaseErrorRef = useRef(null);

  if (previousOwnerRef.current !== rawOwnerUserId) {
    previousOwnerRef.current = rawOwnerUserId;
    epochRef.current += 1;
    leaseErrorRef.current = null;
    try {
      leaseRef.current = rawOwnerUserId
        ? createDeviceAccountLease(rawOwnerUserId, epochRef.current)
        : null;
    } catch (error) {
      leaseRef.current = null;
      leaseErrorRef.current = error;
    }
  }

  const lease = leaseRef.current;
  const [reloadToken, setReloadToken] = useState(0);
  const [snapshot, setSnapshot] = useState(() => emptySnapshot(lease));
  const blockCacheRevisionRef = useRef(0);
  const pendingBlockMutationsRef = useRef(new Set());
  const [blockCacheRevision, setBlockCacheRevision] = useState(0);
  const [serverBlockSyncState, setServerBlockSyncState] = useState(null);
  const visibleSnapshot = leaseErrorRef.current
    ? emptySnapshot(null, 'storage-error', 'device_account_owner_invalid')
    : (matchingLease(snapshot.lease, lease)
      ? snapshot
      : emptySnapshot(lease, lease ? 'loading' : 'ready'));
  const visibleSnapshotRef = useRef(visibleSnapshot);
  visibleSnapshotRef.current = visibleSnapshot;

  const isCurrentLease = useCallback(
    (candidate) => sameDeviceAccountLease(leaseRef.current, candidate),
    [],
  );

  useEffect(() => {
    let active = true;
    const expectedLease = lease;

    if (leaseErrorRef.current) {
      setSnapshot(emptySnapshot(null, 'storage-error', 'device_account_owner_invalid'));
      return () => { active = false; };
    }
    if (!expectedLease) {
      setSnapshot(emptySnapshot(null));
      return () => { active = false; };
    }

    setSnapshot(emptySnapshot(expectedLease));
    void ownerDataStore.activate(expectedLease, { isCurrentLease })
      .then((values) => {
        if (!active || !isCurrentLease(expectedLease)) return;
        setSnapshot(Object.freeze({
          lease: expectedLease,
          status: 'ready',
          errorCode: null,
          data: hydratedData(values),
        }));
      })
      .catch((error) => {
        if (!active || !isCurrentLease(expectedLease) || currentLeaseError(error)) return;
        setSnapshot(emptySnapshot(
          expectedLease,
          'storage-error',
          error?.code || 'device_account_storage_unavailable',
        ));
      });

    return () => { active = false; };
  }, [isCurrentLease, lease, rawOwnerUserId, reloadToken]);

  useEffect(() => {
    const nextRevision = blockCacheRevisionRef.current + 1;
    blockCacheRevisionRef.current = nextRevision;
    setBlockCacheRevision(nextRevision);
    setServerBlockSyncState(null);
  }, [lease]);

  const saveValue = useCallback(async ({
    expectedLease, slot, field, value, serialized, isCurrentOperation,
  }) => {
    const operationGuard = (candidate) => isCurrentLease(candidate)
      && (!isCurrentOperation || isCurrentOperation());
    const current = visibleSnapshotRef.current;
    if (
      !expectedLease
      || !operationGuard(expectedLease)
      || current.status !== 'ready'
      || !sameDeviceAccountLease(current.lease, expectedLease)
    ) return false;

    try {
      await ownerDataStore.write(expectedLease, slot, serialized, {
        isCurrentLease: operationGuard,
      });
      if (!operationGuard(expectedLease)) return false;
      setSnapshot((existing) => {
        if (
          existing.status !== 'ready'
          || !operationGuard(expectedLease)
          || !sameDeviceAccountLease(existing.lease, expectedLease)
        ) return existing;
        return Object.freeze({
          ...existing,
          data: Object.freeze({ ...existing.data, [field]: value }),
        });
      });
      return true;
    } catch (error) {
      if (currentLeaseError(error) || !isCurrentLease(expectedLease)) return false;
      setSnapshot(emptySnapshot(
        expectedLease,
        'storage-error',
        error?.code || 'device_account_write_failed',
      ));
      return false;
    }
  }, [isCurrentLease]);

  const saveList = useCallback((expectedLease, slot, field, value, isCurrentOperation) => {
    if (!Array.isArray(value)) return Promise.resolve(false);
    const copy = Object.freeze([...value]);
    return saveValue({
      expectedLease,
      slot,
      field,
      value: copy,
      serialized: JSON.stringify(copy),
      isCurrentOperation,
    });
  }, [saveValue]);

  const clearList = useCallback(async (expectedLease, slot, field) => {
    const current = visibleSnapshotRef.current;
    if (
      !expectedLease
      || current.status !== 'ready'
      || !sameDeviceAccountLease(current.lease, expectedLease)
    ) return false;
    try {
      await ownerDataStore.remove(expectedLease, slot, { isCurrentLease });
      if (!isCurrentLease(expectedLease)) return false;
      setSnapshot((existing) => {
        if (!sameDeviceAccountLease(existing.lease, expectedLease)) return existing;
        return Object.freeze({
          ...existing,
          data: Object.freeze({ ...existing.data, [field]: Object.freeze([]) }),
        });
      });
      return true;
    } catch (error) {
      if (currentLeaseError(error) || !isCurrentLease(expectedLease)) return false;
      setSnapshot(emptySnapshot(
        expectedLease,
        'storage-error',
        error?.code || 'device_account_remove_failed',
      ));
      return false;
    }
  }, [isCurrentLease]);

  const clearValue = useCallback(async (expectedLease, slot, field) => {
    const current = visibleSnapshotRef.current;
    if (
      !expectedLease
      || current.status !== 'ready'
      || !sameDeviceAccountLease(current.lease, expectedLease)
    ) return false;
    try {
      await ownerDataStore.remove(expectedLease, slot, { isCurrentLease });
      if (!isCurrentLease(expectedLease)) return false;
      setSnapshot((existing) => {
        if (!sameDeviceAccountLease(existing.lease, expectedLease)) return existing;
        return Object.freeze({
          ...existing,
          data: Object.freeze({ ...existing.data, [field]: null }),
        });
      });
      return true;
    } catch (error) {
      if (currentLeaseError(error) || !isCurrentLease(expectedLease)) return false;
      setSnapshot(emptySnapshot(
        expectedLease,
        'storage-error',
        error?.code || 'device_account_remove_failed',
      ));
      return false;
    }
  }, [isCurrentLease]);

  const purgeOwnerData = useCallback((ownerUserId) => {
    const operation = ownerDataStore.purge(ownerUserId);
    const currentLease = leaseRef.current;
    if (currentLease?.ownerUserId === ownerUserId) {
      setSnapshot(emptySnapshot(currentLease, 'sealed'));
    }
    return operation;
  }, []);

  const sealOwnerData = useCallback((ownerUserId) => {
    const sealedOwner = ownerDataStore.seal(ownerUserId);
    const currentLease = leaseRef.current;
    if (currentLease?.ownerUserId === sealedOwner) {
      setSnapshot(emptySnapshot(currentLease, 'sealed'));
    }
    return sealedOwner;
  }, []);

  const retry = useCallback(() => setReloadToken((value) => value + 1), []);
  const isCurrentBlockCacheRevision = useCallback((expectedLease, expectedRevision) => (
    isCurrentLease(expectedLease)
    && blockCacheRevisionRef.current === expectedRevision
    && ![...pendingBlockMutationsRef.current].some((operation) => (
      sameDeviceAccountLease(operation.lease, expectedLease)
    ))
  ), [isCurrentLease]);
  const invalidateServerBlockSync = useCallback((expectedLease) => {
    if (!isCurrentLease(expectedLease)) return false;
    const nextRevision = blockCacheRevisionRef.current + 1;
    blockCacheRevisionRef.current = nextRevision;
    setBlockCacheRevision(nextRevision);
    setServerBlockSyncState(null);
    return true;
  }, [isCurrentLease]);
  const saveBlockedAccounts = useCallback((next) => {
    const expectedLease = lease;
    const current = visibleSnapshotRef.current;
    if (
      (!Array.isArray(next) && typeof next !== 'function')
      || !isCurrentLease(expectedLease)
      || current.status !== 'ready'
      || !sameDeviceAccountLease(current.lease, expectedLease)
    ) {
      return Promise.resolve(false);
    }
    const operation = { lease: expectedLease };
    // Pause snapshots until all deltas finish. A new GET started mid-clear must
    // not reuse the pre-clear render and resurrect an on-device block.
    pendingBlockMutationsRef.current.add(operation);
    invalidateServerBlockSync(expectedLease);
    const updateList = typeof next === 'function' ? next : () => [...next];
    return (async () => {
      try {
        const serialized = await ownerDataStore.update(
          expectedLease,
          DEVICE_ACCOUNT_DATA_SLOT.blockedAccounts,
          (previous) => {
            const updated = updateList(Object.freeze(parsedList(previous)));
            if (!Array.isArray(updated)) {
              throw new DeviceAccountDataError('device_account_value_invalid');
            }
            return JSON.stringify(updated);
          },
          { isCurrentLease },
        );
        if (!isCurrentLease(expectedLease)) return false;
        const blockedAccounts = Object.freeze(parsedList(serialized));
        setSnapshot((existing) => {
          if (
            existing.status !== 'ready'
            || !isCurrentLease(expectedLease)
            || !sameDeviceAccountLease(existing.lease, expectedLease)
          ) return existing;
          return Object.freeze({
            ...existing,
            data: Object.freeze({ ...existing.data, blockedAccounts }),
          });
        });
        return true;
      } catch (error) {
        if (currentLeaseError(error) || !isCurrentLease(expectedLease)) return false;
        setSnapshot(emptySnapshot(
          expectedLease,
          'storage-error',
          error?.code || 'device_account_write_failed',
        ));
        return false;
      } finally {
        pendingBlockMutationsRef.current.delete(operation);
        invalidateServerBlockSync(expectedLease);
      }
    })();
  }, [invalidateServerBlockSync, isCurrentLease, lease]);
  const saveServerBlockSnapshot = useCallback(async (
    next,
    { expectedLease, expectedRevision } = {},
  ) => {
    if (
      !Array.isArray(next)
      || !isCurrentBlockCacheRevision(expectedLease, expectedRevision)
    ) return false;
    const saved = await saveList(
      expectedLease,
      DEVICE_ACCOUNT_DATA_SLOT.blockedAccounts,
      'blockedAccounts',
      next,
      () => isCurrentBlockCacheRevision(expectedLease, expectedRevision),
    );
    return Boolean(
      saved && isCurrentBlockCacheRevision(expectedLease, expectedRevision),
    );
  }, [isCurrentBlockCacheRevision, saveList]);
  const confirmServerBlockSync = useCallback((expectedLease, expectedRevision) => {
    if (!isCurrentBlockCacheRevision(expectedLease, expectedRevision)) return false;
    setServerBlockSyncState(Object.freeze({
      lease: expectedLease,
      revision: expectedRevision,
    }));
    return true;
  }, [isCurrentBlockCacheRevision]);
  const value = useMemo(() => ({
    accountLease: lease,
    isCurrentAccountLease: isCurrentLease,
    ownerUserId: lease?.ownerUserId || null,
    sessionEpoch: lease?.sessionEpoch || null,
    status: visibleSnapshot.status,
    errorCode: visibleSnapshot.errorCode,
    blockedAccounts: visibleSnapshot.data.blockedAccounts,
    blockCacheRevision,
    serverBlocksSynchronized: Boolean(
      serverBlockSyncState
      && matchingLease(serverBlockSyncState.lease, lease)
      && serverBlockSyncState.revision === blockCacheRevision
    ),
    confirmServerBlockSync,
    isCurrentBlockCacheRevision,
    saveServerBlockSnapshot,
    courseProgress: visibleSnapshot.data.courseProgress,
    dailyRunProgress: visibleSnapshot.data.dailyRunProgress,
    expoPushToken: visibleSnapshot.data.expoPushToken,
    hiddenPosts: visibleSnapshot.data.hiddenPosts,
    mutedAccounts: visibleSnapshot.data.mutedAccounts,
    recentProfiles: visibleSnapshot.data.recentProfiles,
    clearBlockedAccounts: () => clearList(
      lease,
      DEVICE_ACCOUNT_DATA_SLOT.blockedAccounts,
      'blockedAccounts',
    ),
    clearExpoPushToken: () => clearValue(
      lease,
      DEVICE_ACCOUNT_DATA_SLOT.expoPushToken,
      'expoPushToken',
    ),
    clearHiddenPosts: () => clearList(
      lease,
      DEVICE_ACCOUNT_DATA_SLOT.hiddenPosts,
      'hiddenPosts',
    ),
    clearMutedAccounts: () => clearList(
      lease,
      DEVICE_ACCOUNT_DATA_SLOT.mutedAccounts,
      'mutedAccounts',
    ),
    purgeOwnerData,
    retry,
    saveBlockedAccounts,
    saveCourseProgress: (next) => saveList(
      lease,
      DEVICE_ACCOUNT_DATA_SLOT.courseProgress,
      'courseProgress',
      next,
    ),
    saveDailyRunProgress: (next) => {
      if (!next || typeof next !== 'object' || Array.isArray(next)) {
        return Promise.resolve(false);
      }
      const copy = Object.freeze({ ...next });
      return saveValue({
        expectedLease: lease,
        slot: DEVICE_ACCOUNT_DATA_SLOT.dailyRunProgress,
        field: 'dailyRunProgress',
        value: copy,
        serialized: JSON.stringify(copy),
      });
    },
    saveExpoPushToken: (token) => {
      if (typeof token !== 'string' || !token.trim()) return Promise.resolve(false);
      return saveValue({
        expectedLease: lease,
        slot: DEVICE_ACCOUNT_DATA_SLOT.expoPushToken,
        field: 'expoPushToken',
        value: token,
        serialized: token,
      });
    },
    saveHiddenPosts: (next) => saveList(
      lease,
      DEVICE_ACCOUNT_DATA_SLOT.hiddenPosts,
      'hiddenPosts',
      next,
    ),
    saveMutedAccounts: (next) => saveList(
      lease,
      DEVICE_ACCOUNT_DATA_SLOT.mutedAccounts,
      'mutedAccounts',
      next,
    ),
    saveRecentProfiles: (next) => saveList(
      lease,
      DEVICE_ACCOUNT_DATA_SLOT.recentProfiles,
      'recentProfiles',
      next,
    ),
    sealOwnerData,
  }), [
    clearList,
    clearValue,
    blockCacheRevision,
    confirmServerBlockSync,
    isCurrentLease,
    isCurrentBlockCacheRevision,
    lease,
    purgeOwnerData,
    retry,
    saveBlockedAccounts,
    saveList,
    saveServerBlockSnapshot,
    saveValue,
    sealOwnerData,
    serverBlockSyncState,
    visibleSnapshot.data,
    visibleSnapshot.errorCode,
    visibleSnapshot.status,
  ]);

  return (
    <DeviceAccountDataContext.Provider value={value}>
      {children}
    </DeviceAccountDataContext.Provider>
  );
}

export function useDeviceAccountData() {
  const value = useContext(DeviceAccountDataContext);
  if (!value) {
    throw new Error('DeviceAccountDataProvider is required');
  }
  return value;
}

export function useDeviceAccountOperationLease() {
  const { accountLease, isCurrentAccountLease } = useDeviceAccountData();
  const mountedRef = useRef(false);
  const liveLeaseRef = useRef(accountLease);
  liveLeaseRef.current = accountLease;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const isCurrentLease = useCallback((candidate) => Boolean(
    mountedRef.current
    && sameDeviceAccountLease(liveLeaseRef.current, candidate)
    && isCurrentAccountLease(candidate)
  ), [isCurrentAccountLease]);

  return useMemo(() => Object.freeze({
    lease: accountLease,
    isCurrentLease,
  }), [accountLease, isCurrentLease]);
}
