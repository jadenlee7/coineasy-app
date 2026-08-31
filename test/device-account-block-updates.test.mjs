import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEVICE_ACCOUNT_DATA_SLOT,
  LEGACY_UNSCOPED_DEVICE_ACCOUNT_DATA_KEYS,
  createDeviceAccountLease,
  createOwnerScopedDeviceAccountDataStore,
} from '../utils/deviceAccountDataStore.mjs';

const OWNER_A = 'did:privy:update-owner-a';
const OWNER_B = 'did:privy:update-owner-b';
const SUBJECT_A = 'a'.repeat(64);
const SUBJECT_B = 'b'.repeat(64);
const BLOCKS = DEVICE_ACCOUNT_DATA_SLOT.blockedAccounts;

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function setup(initial = {}, hooks = {}) {
  const values = new Map(Object.entries(initial));
  const calls = [];
  const storage = {
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
      await hooks.multiRemove?.(keys, values);
      keys.forEach((key) => values.delete(key));
    },
  };
  const store = createOwnerScopedDeviceAccountDataStore({
    storage,
    subjectKeyFor(owner) {
      if (owner === OWNER_A) return SUBJECT_A;
      if (owner === OWNER_B) return SUBJECT_B;
      throw new Error('unknown owner');
    },
  });
  return { calls, store, values };
}

const alwaysCurrent = { isCurrentLease: () => true };
const append = (item) => (previous) => JSON.stringify([
  ...JSON.parse(previous ?? '[]'),
  item,
]);

test('functional block update receives null for an absent key and returns the stored value', async () => {
  const { store, values } = setup();
  const lease = createDeviceAccountLease(OWNER_A, 1);
  await store.activate(lease, alwaysCurrent);
  const key = await store.keyForOwner(OWNER_A, BLOCKS);
  let invocationCount = 0;

  const result = await store.update(lease, BLOCKS, (previous) => {
    invocationCount += 1;
    assert.equal(previous, null);
    return JSON.stringify(['easygo:one']);
  }, alwaysCurrent);

  assert.equal(invocationCount, 1);
  assert.equal(result, JSON.stringify(['easygo:one']));
  assert.equal(values.get(key), result);
  assert.notEqual(result, key);
});

test('concurrent functional updates see the latest value inside the owner FIFO', async () => {
  const firstWriteStarted = deferred();
  const releaseFirstWrite = deferred();
  const firstValue = JSON.stringify(['easygo:existing', 'easygo:first']);
  const { store, values } = setup({}, {
    async setItem(_key, value) {
      if (value !== firstValue) return;
      firstWriteStarted.resolve();
      await releaseFirstWrite.promise;
    },
  });
  const lease = createDeviceAccountLease(OWNER_A, 1);
  await store.activate(lease, alwaysCurrent);
  const key = await store.keyForOwner(OWNER_A, BLOCKS);
  values.set(key, JSON.stringify(['easygo:existing']));
  const observed = [];

  const first = store.update(lease, BLOCKS, (previous) => {
    observed.push(previous);
    return append('easygo:first')(previous);
  }, alwaysCurrent);
  await firstWriteStarted.promise;
  const second = store.update(lease, BLOCKS, (previous) => {
    observed.push(previous);
    return append('easygo:second')(previous);
  }, alwaysCurrent);
  assert.deepEqual(observed, [JSON.stringify(['easygo:existing'])]);
  releaseFirstWrite.resolve();

  assert.deepEqual(await Promise.all([first, second]), [
    firstValue,
    JSON.stringify(['easygo:existing', 'easygo:first', 'easygo:second']),
  ]);
  assert.deepEqual(observed, [JSON.stringify(['easygo:existing']), firstValue]);
  assert.equal(values.get(key), JSON.stringify([
    'easygo:existing', 'easygo:first', 'easygo:second',
  ]));
});

test('functional updates share ordering with existing write and remove operations', async () => {
  const { store, values } = setup();
  const lease = createDeviceAccountLease(OWNER_A, 1);
  await store.activate(lease, alwaysCurrent);
  const key = await store.keyForOwner(OWNER_A, BLOCKS);
  const observed = [];
  const operations = [
    store.write(lease, BLOCKS, JSON.stringify(['easygo:written']), alwaysCurrent),
    store.update(lease, BLOCKS, (previous) => {
      observed.push(previous);
      return append('easygo:updated')(previous);
    }, alwaysCurrent),
    store.remove(lease, BLOCKS, alwaysCurrent),
    store.update(lease, BLOCKS, (previous) => {
      observed.push(previous);
      return append('easygo:after-remove')(previous);
    }, alwaysCurrent),
  ];

  const results = await Promise.all(operations);
  assert.deepEqual(observed, [JSON.stringify(['easygo:written']), null]);
  assert.equal(results[0], key);
  assert.equal(results[1], JSON.stringify(['easygo:written', 'easygo:updated']));
  assert.equal(results[2], key);
  assert.equal(results[3], JSON.stringify(['easygo:after-remove']));
  assert.equal(values.get(key), results[3]);
});

test('a blocked owner A update neither delays nor contaminates owner B updates', async () => {
  const aWriteStarted = deferred();
  const releaseAWrite = deferred();
  const { store, values } = setup({}, {
    async setItem(key) {
      if (!key.includes(SUBJECT_A)) return;
      aWriteStarted.resolve();
      await releaseAWrite.promise;
    },
  });
  const leaseA = createDeviceAccountLease(OWNER_A, 1);
  const leaseB = createDeviceAccountLease(OWNER_B, 2);
  await store.activate(leaseA, alwaysCurrent);
  await store.activate(leaseB, alwaysCurrent);
  const aUpdate = store.update(leaseA, BLOCKS, append('easygo:only-a'), alwaysCurrent);
  await aWriteStarted.promise;

  assert.equal(
    await store.update(leaseB, BLOCKS, append('easygo:only-b'), alwaysCurrent),
    JSON.stringify(['easygo:only-b']),
  );
  releaseAWrite.resolve();
  await aUpdate;
  const keyA = await store.keyForOwner(OWNER_A, BLOCKS);
  const keyB = await store.keyForOwner(OWNER_B, BLOCKS);
  assert.equal(values.get(keyA), JSON.stringify(['easygo:only-a']));
  assert.equal(values.get(keyB), JSON.stringify(['easygo:only-b']));
});

test('A to B to A session changes reject old callbacks even for the same owner', async () => {
  const { store, values } = setup();
  const oldA = createDeviceAccountLease(OWNER_A, 1);
  const leaseB = createDeviceAccountLease(OWNER_B, 2);
  const newA = createDeviceAccountLease(OWNER_A, 3);
  let active = oldA;
  const options = { isCurrentLease: (lease) => lease === active };
  await store.activate(oldA, options);
  await store.update(oldA, BLOCKS, append('easygo:a-existing'), options);
  active = leaseB;
  await store.activate(leaseB, options);
  await store.update(leaseB, BLOCKS, append('easygo:b-existing'), options);
  active = newA;
  await store.activate(newA, options);
  let staleCallbackCalled = false;

  await assert.rejects(store.update(oldA, BLOCKS, () => {
    staleCallbackCalled = true;
    return JSON.stringify(['easygo:stale-a']);
  }, options), { code: 'device_account_session_stale' });
  await assert.rejects(
    store.update(leaseB, BLOCKS, append('easygo:stale-b'), options),
    { code: 'device_account_session_stale' },
  );
  assert.equal(staleCallbackCalled, false);
  assert.equal(
    await store.update(newA, BLOCKS, append('easygo:new-a'), options),
    JSON.stringify(['easygo:a-existing', 'easygo:new-a']),
  );
  const keyB = await store.keyForOwner(OWNER_B, BLOCKS);
  assert.equal(values.get(keyB), JSON.stringify(['easygo:b-existing']));
});

test('an in-flight stale update restores the previous value before new epoch hydration', async () => {
  const writeStarted = deferred();
  const releaseWrite = deferred();
  const staleValue = JSON.stringify(['easygo:existing', 'easygo:stale']);
  const { store, values } = setup({}, {
    async setItem(_key, value) {
      if (value !== staleValue) return;
      writeStarted.resolve();
      await releaseWrite.promise;
    },
  });
  const oldLease = createDeviceAccountLease(OWNER_A, 1);
  const newLease = createDeviceAccountLease(OWNER_A, 3);
  let active = oldLease;
  const options = { isCurrentLease: (lease) => lease === active };
  await store.activate(oldLease, options);
  const key = await store.keyForOwner(OWNER_A, BLOCKS);
  const original = JSON.stringify(['easygo:existing']);
  values.set(key, original);

  const pending = store.update(oldLease, BLOCKS, append('easygo:stale'), options);
  const rejected = assert.rejects(pending, { code: 'device_account_session_stale' });
  await writeStarted.promise;
  active = newLease;
  const hydration = store.activate(newLease, options);
  releaseWrite.resolve();

  await rejected;
  assert.equal((await hydration)[BLOCKS], original);
  assert.equal(values.get(key), original);
});

test('same-owner revision invalidation rolls back in-flight writes and rejects queued callbacks', async () => {
  const writeStarted = deferred();
  const releaseWrite = deferred();
  const staleValue = JSON.stringify(['easygo:existing', 'easygo:server-result']);
  const { store, values } = setup({}, {
    async setItem(_key, value) {
      if (value !== staleValue) return;
      writeStarted.resolve();
      await releaseWrite.promise;
    },
  });
  const lease = createDeviceAccountLease(OWNER_A, 1);
  let revision = 1;
  const snapshotRevision = revision;
  const syncGuard = {
    isCurrentLease: (candidate) => candidate === lease && revision === snapshotRevision,
  };
  await store.activate(lease, alwaysCurrent);
  const key = await store.keyForOwner(OWNER_A, BLOCKS);
  const original = JSON.stringify(['easygo:existing']);
  values.set(key, original);
  const inFlight = store.update(lease, BLOCKS, append('easygo:server-result'), syncGuard);
  const rejectedInFlight = assert.rejects(inFlight, { code: 'device_account_session_stale' });
  await writeStarted.promise;
  let queuedCallbackCalled = false;
  const queued = store.update(lease, BLOCKS, () => {
    queuedCallbackCalled = true;
    return JSON.stringify(['easygo:queued-server-result']);
  }, syncGuard);
  const rejectedQueued = assert.rejects(queued, { code: 'device_account_session_stale' });
  revision += 1;
  const currentRevision = revision;
  const currentGuard = {
    isCurrentLease: (candidate) => candidate === lease && revision === currentRevision,
  };
  const nextUpdate = store.update(lease, BLOCKS, append('easygo:user-action'), currentGuard);
  releaseWrite.resolve();

  await Promise.all([rejectedInFlight, rejectedQueued]);
  assert.equal(queuedCallbackCalled, false);
  assert.equal(await nextUpdate, JSON.stringify(['easygo:existing', 'easygo:user-action']));
  assert.equal(values.get(key), JSON.stringify(['easygo:existing', 'easygo:user-action']));
});

test('invalidated updates to a previously absent key remove their stale value', async () => {
  const writeStarted = deferred();
  const releaseWrite = deferred();
  const { store, values } = setup({}, {
    async setItem() {
      writeStarted.resolve();
      await releaseWrite.promise;
    },
  });
  const lease = createDeviceAccountLease(OWNER_A, 1);
  let current = true;
  const options = { isCurrentLease: () => current };
  await store.activate(lease, options);
  const pending = store.update(lease, BLOCKS, append('easygo:stale'), options);
  const rejection = assert.rejects(pending, { code: 'device_account_session_stale' });
  await writeStarted.promise;
  current = false;
  releaseWrite.resolve();
  await rejection;
  const key = await store.keyForOwner(OWNER_A, BLOCKS);
  assert.equal(values.has(key), false);
});

test('a lease invalidated during the storage read never invokes the updater', async () => {
  const readStarted = deferred();
  const releaseRead = deferred();
  let pauseReads = false;
  const { store, calls, values } = setup({}, {
    async getItem(key) {
      if (!pauseReads || !key.endsWith(BLOCKS)) return;
      readStarted.resolve();
      await releaseRead.promise;
    },
  });
  const lease = createDeviceAccountLease(OWNER_A, 1);
  let current = true;
  const options = { isCurrentLease: () => current };
  await store.activate(lease, options);
  const key = await store.keyForOwner(OWNER_A, BLOCKS);
  values.set(key, '[]');
  pauseReads = true;
  let invoked = false;
  const pending = store.update(lease, BLOCKS, () => {
    invoked = true;
    return JSON.stringify(['easygo:stale']);
  }, options);
  const rejection = assert.rejects(pending, { code: 'device_account_session_stale' });
  await readStarted.promise;
  current = false;
  releaseRead.resolve();

  await rejection;
  assert.equal(invoked, false);
  assert.equal(values.get(key), '[]');
  assert.equal(calls.some(([name]) => name === 'setItem:start'), false);
});

test('storage read and write failures reject without claiming a successful update', async () => {
  for (const failure of ['read', 'write']) {
    let enabled = false;
    const { store, values } = setup({}, {
      async getItem(key) {
        if (enabled && failure === 'read' && key.endsWith(BLOCKS)) throw new Error('read failed');
      },
      async setItem() {
        if (enabled && failure === 'write') throw new Error('write failed');
      },
    });
    const lease = createDeviceAccountLease(OWNER_A, 1);
    await store.activate(lease, alwaysCurrent);
    const key = await store.keyForOwner(OWNER_A, BLOCKS);
    const original = JSON.stringify(['easygo:existing']);
    values.set(key, original);
    enabled = true;
    let updaterCalled = false;
    await assert.rejects(store.update(lease, BLOCKS, (previous) => {
      updaterCalled = true;
      return append('easygo:never-stored')(previous);
    }, alwaysCurrent));
    assert.equal(updaterCalled, failure === 'write');
    assert.equal(values.get(key), original);
    enabled = false;
    assert.equal(
      await store.update(lease, BLOCKS, append('easygo:retry'), alwaysCurrent),
      JSON.stringify(['easygo:existing', 'easygo:retry']),
    );
  }
});

test('throwing updaters and non-string or asynchronous results never modify storage', async () => {
  const { store, values, calls } = setup();
  const lease = createDeviceAccountLease(OWNER_A, 1);
  await store.activate(lease, alwaysCurrent);
  const key = await store.keyForOwner(OWNER_A, BLOCKS);
  const original = JSON.stringify(['easygo:existing']);
  values.set(key, original);

  await assert.rejects(store.update(lease, BLOCKS, () => {
    throw new Error('updater failed');
  }, alwaysCurrent));
  for (const result of [undefined, null, [], {}, 42, Promise.resolve('[]')]) {
    await assert.rejects(
      store.update(lease, BLOCKS, () => result, alwaysCurrent),
      { code: 'device_account_value_invalid' },
    );
  }
  assert.equal(values.get(key), original);
  assert.equal(calls.some(([name]) => name === 'setItem:start'), false);
  assert.equal(await store.update(lease, BLOCKS, () => '', alwaysCurrent), '');
  assert.equal(values.get(key), '');
});

test('invalid update arguments and missing current-session guard fail before the callback', async () => {
  const { store, calls } = setup();
  const lease = createDeviceAccountLease(OWNER_A, 1);
  let invoked = false;
  const updater = () => { invoked = true; return '[]'; };

  await assert.rejects(store.update(lease, BLOCKS, null, alwaysCurrent));
  await assert.rejects(
    store.update(lease, 'not-allowlisted', updater, alwaysCurrent),
    { code: 'device_account_slot_invalid' },
  );
  await assert.rejects(
    store.update(lease, BLOCKS, updater),
    { code: 'device_account_session_stale' },
  );
  assert.equal(invoked, false);
  assert.equal(calls.length, 0);
});

test('failed stale rollback poisons later owner updates instead of concealing corruption', async () => {
  const writeStarted = deferred();
  const releaseWrite = deferred();
  const original = JSON.stringify(['easygo:existing']);
  const staleValue = JSON.stringify(['easygo:existing', 'easygo:stale']);
  let failRestore = false;
  const { store, values } = setup({}, {
    async setItem(_key, value) {
      if (failRestore && value === original) throw new Error('rollback unavailable');
      if (value !== staleValue) return;
      writeStarted.resolve();
      await releaseWrite.promise;
    },
  });
  const lease = createDeviceAccountLease(OWNER_A, 1);
  let current = true;
  const options = { isCurrentLease: () => current };
  await store.activate(lease, options);
  const key = await store.keyForOwner(OWNER_A, BLOCKS);
  values.set(key, original);
  const pending = store.update(lease, BLOCKS, append('easygo:stale'), options);
  const rejected = assert.rejects(pending, { code: 'device_account_stale_rollback_failed' });
  await writeStarted.promise;
  current = false;
  failRestore = true;
  releaseWrite.resolve();
  await rejected;
  current = true;
  let invoked = false;

  await assert.rejects(store.update(lease, BLOCKS, () => {
    invoked = true;
    return '[]';
  }, options), { code: 'device_account_stale_rollback_failed' });
  await assert.rejects(
    store.write(lease, BLOCKS, '[]', options),
    { code: 'device_account_stale_rollback_failed' },
  );
  assert.equal(invoked, false);
});

test('sealed owners reject updates without changing existing owner data', async () => {
  const { store, values } = setup();
  const lease = createDeviceAccountLease(OWNER_A, 1);
  await store.activate(lease, alwaysCurrent);
  const key = await store.keyForOwner(OWNER_A, BLOCKS);
  values.set(key, JSON.stringify(['easygo:existing']));
  store.seal(OWNER_A);
  let invoked = false;

  await assert.rejects(store.update(lease, BLOCKS, () => {
    invoked = true;
    return '[]';
  }, alwaysCurrent), { code: 'device_account_owner_sealed' });
  assert.equal(invoked, false);
  assert.equal(values.get(key), JSON.stringify(['easygo:existing']));
});

test('purge drains an in-flight update and rejects queued or late updates without resurrection', async () => {
  const writeStarted = deferred();
  const releaseWrite = deferred();
  const { store, values } = setup({}, {
    async setItem(key) {
      if (!key.includes(SUBJECT_A)) return;
      writeStarted.resolve();
      await releaseWrite.promise;
    },
  });
  const leaseA = createDeviceAccountLease(OWNER_A, 1);
  const leaseB = createDeviceAccountLease(OWNER_B, 2);
  await store.activate(leaseA, alwaysCurrent);
  await store.activate(leaseB, alwaysCurrent);
  const inFlight = store.update(leaseA, BLOCKS, append('easygo:pending'), alwaysCurrent);
  await writeStarted.promise;
  let queuedCallbackCalled = false;
  const queued = store.update(leaseA, BLOCKS, () => {
    queuedCallbackCalled = true;
    return JSON.stringify(['easygo:queued']);
  }, alwaysCurrent);
  const queuedRejection = assert.rejects(queued, { code: 'device_account_owner_sealed' });
  const purge = store.purge(OWNER_A);
  assert.equal(store.isSealed(OWNER_A), true);
  await assert.rejects(
    store.update(leaseA, BLOCKS, append('easygo:too-late'), alwaysCurrent),
    { code: 'device_account_owner_sealed' },
  );
  await store.update(leaseB, BLOCKS, append('easygo:safe-b'), alwaysCurrent);
  releaseWrite.resolve();
  await inFlight;
  await queuedRejection;
  await purge;

  assert.equal(queuedCallbackCalled, false);
  const keysA = await store.keysForOwner(OWNER_A);
  const keyB = await store.keyForOwner(OWNER_B, BLOCKS);
  assert.ok(keysA.every((key) => !values.has(key)));
  assert.equal(values.get(keyB), JSON.stringify(['easygo:safe-b']));
  await assert.rejects(
    store.update(leaseA, BLOCKS, append('easygo:after-purge'), alwaysCurrent),
    { code: 'device_account_owner_sealed' },
  );
});

test('functional updates preserve exact-owner blocks but never import unscoped legacy data', async () => {
  const initial = Object.fromEntries(LEGACY_UNSCOPED_DEVICE_ACCOUNT_DATA_KEYS.map(
    (key) => [key, JSON.stringify(['easygo:ambiguous-legacy'])],
  ));
  const { store, values } = setup(initial);
  const keyA = await store.keyForOwner(OWNER_A, BLOCKS);
  const keyB = await store.keyForOwner(OWNER_B, BLOCKS);
  values.set(keyA, JSON.stringify(['easygo:a-existing']));
  values.set(keyB, JSON.stringify(['easygo:b-existing']));
  const leaseA = createDeviceAccountLease(OWNER_A, 1);
  const leaseB = createDeviceAccountLease(OWNER_B, 2);
  await store.activate(leaseA, alwaysCurrent);
  await store.activate(leaseB, alwaysCurrent);

  assert.equal(
    await store.update(leaseA, BLOCKS, append('easygo:a-added'), alwaysCurrent),
    JSON.stringify(['easygo:a-existing', 'easygo:a-added']),
  );
  assert.equal(
    await store.update(leaseB, BLOCKS, append('easygo:b-added'), alwaysCurrent),
    JSON.stringify(['easygo:b-existing', 'easygo:b-added']),
  );
  for (const key of LEGACY_UNSCOPED_DEVICE_ACCOUNT_DATA_KEYS) {
    assert.equal(values.has(key), false);
  }
  assert.equal(values.get(keyA).includes('ambiguous-legacy'), false);
  assert.equal(values.get(keyB).includes('ambiguous-legacy'), false);
});
