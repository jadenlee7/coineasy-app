const STORAGE_NAMESPACE = 'easygo.account-data.v1';
const SUBJECT_KEY_PATTERN = /^[a-f0-9]{64}$/u;

export const DEVICE_ACCOUNT_DATA_SLOT = Object.freeze({
  blockedAccounts: 'blocked-accounts',
  courseProgress: 'course-progress',
  dailyRunProgress: 'daily-run-progress',
  expoPushToken: 'expo-push-token',
  hiddenPosts: 'hidden-posts',
  mutedAccounts: 'muted-accounts',
  recentProfiles: 'recent-profiles',
});

const ALLOWED_SLOTS = Object.freeze(Object.values(DEVICE_ACCOUNT_DATA_SLOT));
const ALLOWED_SLOT_SET = new Set(ALLOWED_SLOTS);

// These values predate account ownership. They may contain data from more than
// one prior session, so they are intentionally deleted and never imported into
// an owner namespace.
export const LEGACY_UNSCOPED_DEVICE_ACCOUNT_DATA_KEYS = Object.freeze([
  'easygo_recent_profile_searches',
  'list_blocked_user',
  'list_muted_users',
  'list_hidden_post',
  'easygo_expo_push_token',
]);

const LEGACY_COURSE_PROGRESS_PREFIX = 'easygo_course_progress:';

export class DeviceAccountDataError extends Error {
  constructor(code, cause) {
    super(code);
    this.name = 'DeviceAccountDataError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

function requiredFunction(value, name) {
  if (typeof value !== 'function') {
    throw new DeviceAccountDataError(`device_account_storage_${name}_unavailable`);
  }
  return value;
}

export function normalizeDeviceAccountOwner(value) {
  if (typeof value !== 'string') {
    throw new DeviceAccountDataError('device_account_owner_required');
  }
  const ownerUserId = value.trim();
  if (
    !ownerUserId
    || ownerUserId !== value
    || ownerUserId.length > 512
    || /[\u0000-\u001f\u007f]/u.test(ownerUserId)
  ) {
    throw new DeviceAccountDataError('device_account_owner_invalid');
  }
  return ownerUserId;
}

function normalizedEpoch(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new DeviceAccountDataError('device_account_session_epoch_invalid');
  }
  return value;
}

export function createDeviceAccountLease(ownerUserId, sessionEpoch) {
  return Object.freeze({
    ownerUserId: normalizeDeviceAccountOwner(ownerUserId),
    sessionEpoch: normalizedEpoch(sessionEpoch),
  });
}

export function sameDeviceAccountLease(left, right) {
  return Boolean(
    left
    && right
    && left.ownerUserId === right.ownerUserId
    && left.sessionEpoch === right.sessionEpoch,
  );
}

function normalizedSlot(slot) {
  if (!ALLOWED_SLOT_SET.has(slot)) {
    throw new DeviceAccountDataError('device_account_slot_invalid');
  }
  return slot;
}

function normalizedSubjectKey(value) {
  const subjectKey = typeof value === 'string' ? value.toLowerCase() : '';
  if (!SUBJECT_KEY_PATTERN.test(subjectKey)) {
    throw new DeviceAccountDataError('device_account_subject_key_invalid');
  }
  return subjectKey;
}

export function deviceAccountDataKeyFromSubject(subjectKey, slot) {
  return `${STORAGE_NAMESPACE}.${normalizedSubjectKey(subjectKey)}.${normalizedSlot(slot)}`;
}

function legacyCourseProgressKey(ownerUserId) {
  return `${LEGACY_COURSE_PROGRESS_PREFIX}${normalizeDeviceAccountOwner(ownerUserId)}`;
}

function serializedListOrNull(value) {
  if (typeof value !== 'string') return null;
  try {
    return Array.isArray(JSON.parse(value)) ? value : null;
  } catch {
    return null;
  }
}

function storageEntries(keys, entries) {
  const values = new Map(Array.isArray(entries) ? entries : []);
  return keys.map((key) => [key, values.get(key) ?? null]);
}

function assertRemoved(entries, code) {
  if (entries.some(([, value]) => value !== null && value !== undefined)) {
    throw new DeviceAccountDataError(code);
  }
}

function ownerQueueState(states, ownerUserId) {
  let state = states.get(ownerUserId);
  if (!state) {
    state = { integrityError: null, sealed: false, tail: Promise.resolve() };
    states.set(ownerUserId, state);
  }
  return state;
}

function enqueue(state, operation) {
  const result = state.tail.catch(() => {}).then(operation);
  state.tail = result.catch(() => {});
  return result;
}

function currentLeaseGuard(isCurrentLease) {
  return typeof isCurrentLease === 'function' ? isCurrentLease : () => false;
}

function assertCurrentLease(lease, isCurrentLease) {
  if (!currentLeaseGuard(isCurrentLease)(lease)) {
    throw new DeviceAccountDataError('device_account_session_stale');
  }
}

function assertWritable(state) {
  if (state.integrityError) {
    throw new DeviceAccountDataError(state.integrityError);
  }
  if (state.sealed) {
    throw new DeviceAccountDataError('device_account_owner_sealed');
  }
}

/**
 * Account-bound AsyncStorage coordinator.
 *
 * All mutations for one owner share a queue. purge() seals synchronously,
 * waits for already-running writes, removes only that owner's hashed keys,
 * and verifies removal. A different owner's queue and keys are independent.
 */
export function createOwnerScopedDeviceAccountDataStore({
  storage,
  subjectKeyFor,
} = {}) {
  const getItem = requiredFunction(storage?.getItem, 'get_item').bind(storage);
  const setItem = requiredFunction(storage?.setItem, 'set_item').bind(storage);
  const removeItem = requiredFunction(storage?.removeItem, 'remove_item').bind(storage);
  const multiGet = requiredFunction(storage?.multiGet, 'multi_get').bind(storage);
  const multiRemove = requiredFunction(storage?.multiRemove, 'multi_remove').bind(storage);
  const deriveSubjectKey = requiredFunction(subjectKeyFor, 'subject_key');
  const ownerStates = new Map();
  const legacyQueue = { tail: Promise.resolve() };

  async function subjectKey(ownerUserId) {
    try {
      return normalizedSubjectKey(await deriveSubjectKey(
        normalizeDeviceAccountOwner(ownerUserId),
      ));
    } catch (error) {
      if (error instanceof DeviceAccountDataError) throw error;
      throw new DeviceAccountDataError('device_account_subject_key_unavailable', error);
    }
  }

  async function keysForOwner(ownerUserId) {
    const owner = normalizeDeviceAccountOwner(ownerUserId);
    const derived = await subjectKey(owner);
    return Object.freeze(ALLOWED_SLOTS.map(
      (slot) => deviceAccountDataKeyFromSubject(derived, slot),
    ));
  }

  async function keyForOwner(ownerUserId, slot) {
    const owner = normalizeDeviceAccountOwner(ownerUserId);
    const derived = await subjectKey(owner);
    return deviceAccountDataKeyFromSubject(derived, slot);
  }

  async function restoreStaleMutation(state, key, previousValue) {
    try {
      if (previousValue === null || previousValue === undefined) {
        await removeItem(key);
      } else {
        await setItem(key, previousValue);
      }
      const restored = await getItem(key);
      const expected = previousValue ?? null;
      if ((restored ?? null) !== expected) {
        throw new Error('restore_verification_failed');
      }
    } catch (error) {
      state.integrityError = 'device_account_stale_rollback_failed';
      throw new DeviceAccountDataError(state.integrityError, error);
    }
    throw new DeviceAccountDataError('device_account_session_stale');
  }

  function sanitizeLegacyUnscopedData() {
    return enqueue(legacyQueue, async () => {
      let before;
      try {
        before = storageEntries(
          LEGACY_UNSCOPED_DEVICE_ACCOUNT_DATA_KEYS,
          await multiGet(LEGACY_UNSCOPED_DEVICE_ACCOUNT_DATA_KEYS),
        );
        if (before.some(([, value]) => value !== null && value !== undefined)) {
          await multiRemove(LEGACY_UNSCOPED_DEVICE_ACCOUNT_DATA_KEYS);
        }
        const after = storageEntries(
          LEGACY_UNSCOPED_DEVICE_ACCOUNT_DATA_KEYS,
          await multiGet(LEGACY_UNSCOPED_DEVICE_ACCOUNT_DATA_KEYS),
        );
        assertRemoved(after, 'device_account_legacy_cleanup_incomplete');
        return Object.freeze({ removed: before.filter(([, value]) => value != null).length });
      } catch (error) {
        if (error instanceof DeviceAccountDataError) throw error;
        throw new DeviceAccountDataError('device_account_legacy_cleanup_failed', error);
      }
    });
  }

  async function migrateLegacyCourseProgress(ownerUserId, destinationKey) {
    const legacyKey = legacyCourseProgressKey(ownerUserId);
    try {
      const entries = storageEntries(
        [legacyKey, destinationKey],
        await multiGet([legacyKey, destinationKey]),
      );
      const legacyValue = entries[0][1];
      const destinationValue = entries[1][1];
      const importable = serializedListOrNull(legacyValue);
      if (importable && (destinationValue === null || destinationValue === undefined)) {
        await setItem(destinationKey, importable);
      }
      if (legacyValue !== null && legacyValue !== undefined) {
        await removeItem(legacyKey);
      }
      const remaining = await getItem(legacyKey);
      if (remaining !== null && remaining !== undefined) {
        throw new DeviceAccountDataError('device_account_course_migration_incomplete');
      }
      return legacyKey;
    } catch (error) {
      if (error instanceof DeviceAccountDataError) throw error;
      throw new DeviceAccountDataError('device_account_course_migration_failed', error);
    }
  }

  async function activate(lease, { isCurrentLease } = {}) {
    const owner = normalizeDeviceAccountOwner(lease?.ownerUserId);
    normalizedEpoch(lease?.sessionEpoch);
    const state = ownerQueueState(ownerStates, owner);
    assertCurrentLease(lease, isCurrentLease);
    assertWritable(state);

    return enqueue(state, async () => {
      assertCurrentLease(lease, isCurrentLease);
      assertWritable(state);
      await sanitizeLegacyUnscopedData();
      assertCurrentLease(lease, isCurrentLease);
      assertWritable(state);

      const keys = await keysForOwner(owner);
      const courseKey = await keyForOwner(owner, DEVICE_ACCOUNT_DATA_SLOT.courseProgress);
      await migrateLegacyCourseProgress(owner, courseKey);
      assertCurrentLease(lease, isCurrentLease);
      assertWritable(state);

      try {
        const entries = storageEntries(keys, await multiGet(keys));
        assertCurrentLease(lease, isCurrentLease);
        assertWritable(state);
        return Object.freeze(Object.fromEntries(
          ALLOWED_SLOTS.map((slot, index) => [slot, entries[index][1]]),
        ));
      } catch (error) {
        if (error instanceof DeviceAccountDataError) throw error;
        throw new DeviceAccountDataError('device_account_hydration_failed', error);
      }
    });
  }

  async function write(lease, slot, value, { isCurrentLease } = {}) {
    const owner = normalizeDeviceAccountOwner(lease?.ownerUserId);
    normalizedEpoch(lease?.sessionEpoch);
    const normalizedDataSlot = normalizedSlot(slot);
    if (typeof value !== 'string') {
      throw new DeviceAccountDataError('device_account_value_invalid');
    }
    const state = ownerQueueState(ownerStates, owner);
    assertCurrentLease(lease, isCurrentLease);
    assertWritable(state);

    return enqueue(state, async () => {
      assertCurrentLease(lease, isCurrentLease);
      assertWritable(state);
      const key = await keyForOwner(owner, normalizedDataSlot);
      assertCurrentLease(lease, isCurrentLease);
      assertWritable(state);
      try {
        const previousValue = await getItem(key);
        assertCurrentLease(lease, isCurrentLease);
        assertWritable(state);
        await setItem(key, value);
        if (!currentLeaseGuard(isCurrentLease)(lease)) {
          await restoreStaleMutation(state, key, previousValue);
        }
        return key;
      } catch (error) {
        if (error instanceof DeviceAccountDataError) throw error;
        throw new DeviceAccountDataError('device_account_write_failed', error);
      }
    });
  }

  async function remove(lease, slot, { isCurrentLease } = {}) {
    const owner = normalizeDeviceAccountOwner(lease?.ownerUserId);
    normalizedEpoch(lease?.sessionEpoch);
    const normalizedDataSlot = normalizedSlot(slot);
    const state = ownerQueueState(ownerStates, owner);
    assertCurrentLease(lease, isCurrentLease);
    assertWritable(state);

    return enqueue(state, async () => {
      assertCurrentLease(lease, isCurrentLease);
      assertWritable(state);
      const key = await keyForOwner(owner, normalizedDataSlot);
      assertCurrentLease(lease, isCurrentLease);
      assertWritable(state);
      try {
        const previousValue = await getItem(key);
        assertCurrentLease(lease, isCurrentLease);
        assertWritable(state);
        await removeItem(key);
        if (!currentLeaseGuard(isCurrentLease)(lease)) {
          await restoreStaleMutation(state, key, previousValue);
        }
        const remaining = await getItem(key);
        if (!currentLeaseGuard(isCurrentLease)(lease)) {
          await restoreStaleMutation(state, key, previousValue);
        }
        if (remaining !== null && remaining !== undefined) {
          throw new DeviceAccountDataError('device_account_remove_incomplete');
        }
        return key;
      } catch (error) {
        if (error instanceof DeviceAccountDataError) throw error;
        throw new DeviceAccountDataError('device_account_remove_failed', error);
      }
    });
  }

  function seal(ownerUserId) {
    const owner = normalizeDeviceAccountOwner(ownerUserId);
    ownerQueueState(ownerStates, owner).sealed = true;
    return owner;
  }

  async function purge(ownerUserId) {
    const owner = seal(ownerUserId);
    const state = ownerQueueState(ownerStates, owner);

    return enqueue(state, async () => {
      await sanitizeLegacyUnscopedData();
      const keys = [
        ...(await keysForOwner(owner)),
        legacyCourseProgressKey(owner),
      ];
      try {
        await multiRemove(keys);
        const remaining = storageEntries(keys, await multiGet(keys));
        assertRemoved(remaining, 'device_account_purge_incomplete');
        return Object.freeze([...keys]);
      } catch (error) {
        if (error instanceof DeviceAccountDataError) throw error;
        throw new DeviceAccountDataError('device_account_purge_failed', error);
      }
    });
  }

  function isSealed(ownerUserId) {
    const owner = normalizeDeviceAccountOwner(ownerUserId);
    return ownerQueueState(ownerStates, owner).sealed;
  }

  return Object.freeze({
    activate,
    isSealed,
    keyForOwner,
    keysForOwner,
    purge,
    remove,
    sanitizeLegacyUnscopedData,
    seal,
    write,
  });
}
