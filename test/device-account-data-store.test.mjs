import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  DEVICE_ACCOUNT_DATA_SLOT,
  LEGACY_UNSCOPED_DEVICE_ACCOUNT_DATA_KEYS,
  createDeviceAccountLease,
  createOwnerScopedDeviceAccountDataStore,
} from '../utils/deviceAccountDataStore.mjs';

const OWNER_A = 'did:privy:owner-a';
const OWNER_B = 'did:privy:owner-b';
const SUBJECT_A = 'a'.repeat(64);
const SUBJECT_B = 'b'.repeat(64);

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function memoryStorage(initial = {}, hooks = {}) {
  const values = new Map(Object.entries(initial));
  const calls = [];
  return {
    calls,
    values,
    storage: {
      async getItem(key) {
        calls.push(['getItem', key]);
        await hooks.getItem?.(key, values);
        return values.get(key) ?? null;
      },
      async setItem(key, value) {
        calls.push(['setItem:start', key, value]);
        await hooks.setItem?.(key, value, values);
        values.set(key, value);
        calls.push(['setItem:end', key, value]);
      },
      async removeItem(key) {
        calls.push(['removeItem', key]);
        await hooks.removeItem?.(key, values);
        values.delete(key);
      },
      async multiGet(keys) {
        calls.push(['multiGet', [...keys]]);
        await hooks.multiGet?.(keys, values);
        return keys.map((key) => [key, values.get(key) ?? null]);
      },
      async multiRemove(keys) {
        calls.push(['multiRemove', [...keys]]);
        const handled = await hooks.multiRemove?.(keys, values);
        if (handled === false) return;
        keys.forEach((key) => values.delete(key));
      },
    },
  };
}

function subjectKeyFor(ownerUserId) {
  if (ownerUserId === OWNER_A) return SUBJECT_A;
  if (ownerUserId === OWNER_B) return SUBJECT_B;
  throw new Error('unknown owner');
}

function setup(initial, hooks) {
  const memory = memoryStorage(initial, hooks);
  const store = createOwnerScopedDeviceAccountDataStore({
    storage: memory.storage,
    subjectKeyFor,
  });
  return { ...memory, store };
}

test('owner keys are allowlisted, disjoint, and contain no raw Privy DID', async () => {
  const { store, calls } = setup();
  const keysA = await store.keysForOwner(OWNER_A);
  const keysB = await store.keysForOwner(OWNER_B);

  assert.equal(keysA.length, Object.keys(DEVICE_ACCOUNT_DATA_SLOT).length);
  assert.equal(keysB.length, keysA.length);
  assert.equal(keysA.some((key) => key.includes(OWNER_A)), false);
  assert.equal(keysB.some((key) => key.includes(OWNER_B)), false);
  assert.equal(keysA.some((key) => keysB.includes(key)), false);
  assert.ok(keysA.every((key) => key.startsWith(`easygo.account-data.v1.${SUBJECT_A}.`)));

  await assert.rejects(
    store.keyForOwner(OWNER_A, 'arbitrary-key'),
    { code: 'device_account_slot_invalid' },
  );
  await assert.rejects(
    store.keysForOwner(' did:privy:owner-a'),
    { code: 'device_account_owner_invalid' },
  );
  assert.equal(calls.length, 0);
});

test('ambiguous legacy globals are discarded while exact-owner course progress migrates', async () => {
  const legacyCourseKey = `easygo_course_progress:${OWNER_A}`;
  const initial = {
    ...Object.fromEntries(LEGACY_UNSCOPED_DEVICE_ACCOUNT_DATA_KEYS.map(
      (key, index) => [key, JSON.stringify([{ private: `legacy-${index}` }])],
    )),
    [legacyCourseKey]: JSON.stringify([{ id: 'course-1' }]),
  };
  const { store, values } = setup(initial);
  const lease = createDeviceAccountLease(OWNER_A, 1);
  const result = await store.activate(lease, { isCurrentLease: () => true });

  assert.equal(result[DEVICE_ACCOUNT_DATA_SLOT.recentProfiles], null);
  assert.equal(result[DEVICE_ACCOUNT_DATA_SLOT.blockedAccounts], null);
  assert.equal(result[DEVICE_ACCOUNT_DATA_SLOT.mutedAccounts], null);
  assert.equal(result[DEVICE_ACCOUNT_DATA_SLOT.hiddenPosts], null);
  assert.equal(result[DEVICE_ACCOUNT_DATA_SLOT.expoPushToken], null);
  assert.equal(
    result[DEVICE_ACCOUNT_DATA_SLOT.courseProgress],
    JSON.stringify([{ id: 'course-1' }]),
  );
  assert.equal(values.has(legacyCourseKey), false);
  for (const key of LEGACY_UNSCOPED_DEVICE_ACCOUNT_DATA_KEYS) {
    assert.equal(values.has(key), false);
  }
  const courseKey = await store.keyForOwner(
    OWNER_A,
    DEVICE_ACCOUNT_DATA_SLOT.courseProgress,
  );
  assert.equal(values.get(courseKey), JSON.stringify([{ id: 'course-1' }]));
});

test('the production owner adapter derives namespaces with SHA-256', () => {
  const source = readFileSync(
    new URL('../contexts/DeviceAccountDataContext.js', import.meta.url),
    'utf8',
  );

  assert.match(source, /Crypto\.digestStringAsync\(/);
  assert.match(source, /Crypto\.CryptoDigestAlgorithm\.SHA256,\s*ownerUserId/);
  assert.match(source, /subjectKeyFor:\s*hashOwnerUserId/);
});

test('legacy cleanup fails closed when removal cannot be verified', async () => {
  const legacyKey = LEGACY_UNSCOPED_DEVICE_ACCOUNT_DATA_KEYS[0];
  const { store, calls } = setup(
    { [legacyKey]: 'private' },
    { multiRemove: async () => false },
  );
  const lease = createDeviceAccountLease(OWNER_A, 1);

  await assert.rejects(
    store.activate(lease, { isCurrentLease: () => true }),
    { code: 'device_account_legacy_cleanup_incomplete' },
  );
  assert.equal(calls.some(([name]) => name === 'setItem:start'), false);
});

test('purging A removes only A data and preserves concurrent B data', async () => {
  const { store, values } = setup();
  const leaseA = createDeviceAccountLease(OWNER_A, 1);
  const leaseB = createDeviceAccountLease(OWNER_B, 2);
  await store.activate(leaseA, { isCurrentLease: () => true });
  await store.activate(leaseB, { isCurrentLease: () => true });
  await store.write(
    leaseA,
    DEVICE_ACCOUNT_DATA_SLOT.recentProfiles,
    JSON.stringify(['a']),
    { isCurrentLease: () => true },
  );
  await store.write(
    leaseB,
    DEVICE_ACCOUNT_DATA_SLOT.recentProfiles,
    JSON.stringify(['b']),
    { isCurrentLease: () => true },
  );

  await store.purge(OWNER_A);
  const keysA = await store.keysForOwner(OWNER_A);
  const keyB = await store.keyForOwner(OWNER_B, DEVICE_ACCOUNT_DATA_SLOT.recentProfiles);
  assert.ok(keysA.every((key) => !values.has(key)));
  assert.equal(values.get(keyB), JSON.stringify(['b']));
});

test('purge seals synchronously, drains an in-flight write, and prevents resurrection', async () => {
  const writeStarted = deferred();
  const releaseWrite = deferred();
  const { store, values } = setup({}, {
    setItem: async (_key, value) => {
      if (value !== 'pending-a') return;
      writeStarted.resolve();
      await releaseWrite.promise;
    },
  });
  const leaseA = createDeviceAccountLease(OWNER_A, 1);
  const leaseB = createDeviceAccountLease(OWNER_B, 1);
  await store.activate(leaseA, { isCurrentLease: () => true });
  await store.activate(leaseB, { isCurrentLease: () => true });

  const pendingWrite = store.write(
    leaseA,
    DEVICE_ACCOUNT_DATA_SLOT.hiddenPosts,
    'pending-a',
    { isCurrentLease: () => true },
  );
  await writeStarted.promise;
  const purge = store.purge(OWNER_A);
  assert.equal(store.isSealed(OWNER_A), true);
  await assert.rejects(
    store.write(
      leaseA,
      DEVICE_ACCOUNT_DATA_SLOT.hiddenPosts,
      'late-a',
      { isCurrentLease: () => true },
    ),
    { code: 'device_account_owner_sealed' },
  );

  await store.write(
    leaseB,
    DEVICE_ACCOUNT_DATA_SLOT.hiddenPosts,
    'safe-b',
    { isCurrentLease: () => true },
  );
  releaseWrite.resolve();
  await pendingWrite;
  await purge;

  const keyA = await store.keyForOwner(OWNER_A, DEVICE_ACCOUNT_DATA_SLOT.hiddenPosts);
  const keyB = await store.keyForOwner(OWNER_B, DEVICE_ACCOUNT_DATA_SLOT.hiddenPosts);
  assert.equal(values.has(keyA), false);
  assert.equal(values.get(keyB), 'safe-b');
});

test('a queued operation from an old same-owner session epoch is rejected', async () => {
  const { store, values } = setup();
  const oldLease = createDeviceAccountLease(OWNER_A, 1);
  const newLease = createDeviceAccountLease(OWNER_A, 3);
  let currentLease = oldLease;
  const isCurrentLease = (candidate) => candidate === currentLease;
  await store.activate(oldLease, { isCurrentLease });
  currentLease = newLease;

  await assert.rejects(
    store.write(
      oldLease,
      DEVICE_ACCOUNT_DATA_SLOT.mutedAccounts,
      JSON.stringify(['stale']),
      { isCurrentLease },
    ),
    { code: 'device_account_session_stale' },
  );
  const key = await store.keyForOwner(OWNER_A, DEVICE_ACCOUNT_DATA_SLOT.mutedAccounts);
  assert.equal(values.has(key), false);
});

test('an in-flight old-epoch write is rolled back before the new epoch hydrates', async () => {
  const staleWriteStarted = deferred();
  const releaseStaleWrite = deferred();
  const { store, values } = setup({}, {
    setItem: async (_key, value) => {
      if (value !== 'stale-epoch-value') return;
      staleWriteStarted.resolve();
      await releaseStaleWrite.promise;
    },
  });
  const oldLease = createDeviceAccountLease(OWNER_A, 1);
  const newLease = createDeviceAccountLease(OWNER_A, 2);
  let currentLease = oldLease;
  const isCurrentLease = (candidate) => candidate === currentLease;
  await store.activate(oldLease, { isCurrentLease });
  const key = await store.keyForOwner(
    OWNER_A,
    DEVICE_ACCOUNT_DATA_SLOT.recentProfiles,
  );
  values.set(key, 'stable-value');

  const staleWrite = store.write(
    oldLease,
    DEVICE_ACCOUNT_DATA_SLOT.recentProfiles,
    'stale-epoch-value',
    { isCurrentLease },
  );
  await staleWriteStarted.promise;
  currentLease = newLease;
  const nextActivation = store.activate(newLease, { isCurrentLease });
  releaseStaleWrite.resolve();

  await assert.rejects(staleWrite, { code: 'device_account_session_stale' });
  const hydrated = await nextActivation;
  assert.equal(hydrated[DEVICE_ACCOUNT_DATA_SLOT.recentProfiles], 'stable-value');
  assert.equal(values.get(key), 'stable-value');
});

test('mobile consumers use the owner store and never access legacy account keys directly', () => {
  const sources = [
    '../App.js',
    '../components/Feed.js',
    '../components/modals/PostSettingsModal.js',
    '../components/modals/PushNotificationsModal.js',
    '../components/modals/SettingsModal.js',
    '../screens/AccountDeletionPending.js',
    '../screens/Navigation/Trophies/CourseDetailScreen.js',
    '../screens/Search.js',
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));
  const combined = sources.join('\n');

  assert.doesNotMatch(
    combined,
    /easygo_recent_profile_searches|list_blocked_user|list_muted_users|list_hidden_post|easygo_expo_push_token|easygo_course_progress:/,
  );
  assert.match(sources[0], /<DeviceAccountDataProvider>/);
  assert.match(sources[0], /presentedOwner === deviceAccountData\.ownerUserId/);
  assert.match(sources[0], /deviceAccountData\.status === 'ready'/);
  assert.match(sources[0], /function AccountTransitionResetSignal/);
  assert.match(sources[0], /onTransition\?\.\(\{ ownerUserId, sessionEpoch \}\)/);
  assert.match(sources[0], /<AccountTransitionResetSignal onTransition=\{resetAccountTransientUi\} \/>/);
  assert.match(sources[0], /setPostboxVis\(false\)/);
  assert.match(sources[5], /purgeOwnerData\(expectedOwnerUserId\)/);
  assert.doesNotMatch(sources[5], /AsyncStorage\.multiRemove/);
  assert.match(sources[3], /const expectedLease = renderLease/);
  assert.match(sources[3], /if \(!isCurrentLease\(expectedLease\)\) return/);
  for (const source of sources.slice(1)) {
    assert.match(source, /useDeviceAccountData/);
  }
});

test('provider actions capture their render lease instead of borrowing a later session', () => {
  const source = readFileSync(
    new URL('../contexts/DeviceAccountDataContext.js', import.meta.url),
    'utf8',
  );

  assert.match(source, /clearBlockedAccounts:\s*\(\) => clearList\(\s*lease,/);
  assert.match(source, /const saveBlockedAccounts = useCallback\(\(next\) => \{[\s\S]*?const expectedLease = lease;/);
  assert.match(source, /invalidateServerBlockSync\(expectedLease\)[\s\S]*?ownerDataStore\.update\(\s*expectedLease,/);
  assert.match(source, /saveCourseProgress:\s*\(next\) => saveList\(\s*lease,/);
  assert.match(source, /saveExpoPushToken:[\s\S]*?expectedLease:\s*lease,/);
  assert.match(source, /authenticated \? \(privy\?\.user\?\.id \?\? null\) : null/);
  assert.doesNotMatch(source, /const expectedLease = leaseRef\.current/);
});

test('course rewards are bound to the same owner as local course progress', () => {
  const source = readFileSync(
    new URL('../screens/Navigation/Trophies/CourseDetailScreen.js', import.meta.url),
    'utf8',
  );

  assert.match(source, /api\.completeQuest\([\s\S]*?expectedAuthUserId: ownerUserId/);
  assert.match(source, /api\.orangeClaimCourseQuiz\([\s\S]*?expectedAuthUserId: ownerUserId/);
  assert.match(source, /useDeviceAccountOperationLease/);
  assert.match(source, /lease: courseLease,[\s\S]*?isCurrentLease: isCurrentCourseLease/);
  assert.doesNotMatch(source, /courseMountedRef|courseLeaseRef/);
  assert.match(source, /if \(!isCurrentCourseLease\(expectedLease\)\) return/);
  assert.match(source, /await persistCourseProgress\(tempData\)/);
});
