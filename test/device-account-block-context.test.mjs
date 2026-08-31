import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  DEVICE_ACCOUNT_DATA_SLOT,
  DeviceAccountDataError,
  createDeviceAccountLease,
  createOwnerScopedDeviceAccountDataStore,
  sameDeviceAccountLease,
} from '../utils/deviceAccountDataStore.mjs';
import { removeLocalBlockedAccountEntries } from '../utils/blockedAccounts.mjs';
import { synchronizeServerBlockCache } from '../utils/serverBlockCacheSync.mjs';

const OWNER_A = 'did:privy:block-context-a';
const OWNER_B = 'did:privy:block-context-b';
const BLOCKS = DEVICE_ACCOUNT_DATA_SLOT.blockedAccounts;
const source = readFileSync(
  new URL('../contexts/DeviceAccountDataContext.js', import.meta.url),
  'utf8',
);

function sourceBetween(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `missing production source boundary: ${start}`);
  assert.notEqual(to, -1, `missing production source boundary: ${end}`);
  return source.slice(from, to);
}

// Execute the production callbacks themselves, not a parallel implementation.
// Only React's callback/ref/state wiring is replaced: this intentionally does
// not claim coverage of React rendering, effects, or native device storage.
const createCallbacks = new Function('environment', `
  'use strict';
  const {
    DEVICE_ACCOUNT_DATA_SLOT, DeviceAccountDataError, sameDeviceAccountLease,
    lease, leaseRef, visibleSnapshotRef, blockCacheRevisionRef,
    pendingBlockMutationsRef, ownerDataStore, setSnapshot,
    setBlockCacheRevision, setServerBlockSyncState,
  } = environment;
  const useCallback = (callback) => callback;
  ${sourceBetween('const EMPTY_DATA = ', 'async function hashOwnerUserId(')}
  ${sourceBetween('function matchingLease(', 'export function DeviceAccountDataProvider(')}
  ${sourceBetween('  const isCurrentLease = useCallback(', '  useEffect(() => {')}
  ${sourceBetween('  const saveValue = useCallback(', '  const clearList = useCallback(')}
  ${sourceBetween('  const isCurrentBlockCacheRevision = useCallback(', '  const value = useMemo(')}
  return {
    saveBlockedAccounts, saveServerBlockSnapshot, isCurrentBlockCacheRevision,
    invalidateServerBlockSync, confirmServerBlockSync,
  };
`);

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function readySnapshot(lease, blockedAccounts) {
  return {
    lease,
    status: 'ready',
    errorCode: null,
    data: { blockedAccounts: [...blockedAccounts] },
  };
}

async function setup(hooks = {}, initialBlocks = ['easygo:existing']) {
  const values = new Map();
  const writes = [];
  const snapshotHistory = [];
  const lease = createDeviceAccountLease(OWNER_A, 1);
  const leaseRef = { current: lease };
  const visibleSnapshotRef = {
    current: readySnapshot(lease, initialBlocks),
  };
  const blockCacheRevisionRef = { current: 10 };
  const pendingBlockMutationsRef = { current: new Set() };
  let revisionState = blockCacheRevisionRef.current;
  let syncState = null;
  const ownerDataStore = createOwnerScopedDeviceAccountDataStore({
    subjectKeyFor(owner) {
      if (owner === OWNER_A) return 'a'.repeat(64);
      if (owner === OWNER_B) return 'b'.repeat(64);
      throw new Error('unknown owner');
    },
    storage: {
      async getItem(key) {
        await hooks.getItem?.(key);
        return values.get(key) ?? null;
      },
      async setItem(key, value) {
        writes.push({ key, value });
        await hooks.setItem?.(key, value);
        values.set(key, value);
      },
      async removeItem(key) { values.delete(key); },
      async multiGet(keys) { return keys.map((key) => [key, values.get(key) ?? null]); },
      async multiRemove(keys) { keys.forEach((key) => values.delete(key)); },
    },
  });
  const keyA = await ownerDataStore.keyForOwner(OWNER_A, BLOCKS);
  values.set(keyA, JSON.stringify(initialBlocks));
  await ownerDataStore.activate(lease, {
    isCurrentLease: (candidate) => sameDeviceAccountLease(leaseRef.current, candidate),
  });

  function render(renderLease) {
    return createCallbacks({
      DEVICE_ACCOUNT_DATA_SLOT,
      DeviceAccountDataError,
      sameDeviceAccountLease,
      lease: renderLease,
      leaseRef,
      visibleSnapshotRef,
      blockCacheRevisionRef,
      pendingBlockMutationsRef,
      ownerDataStore,
      setSnapshot(update) {
        const next = typeof update === 'function' ? update(visibleSnapshotRef.current) : update;
        visibleSnapshotRef.current = next;
        snapshotHistory.push(next);
      },
      setBlockCacheRevision(value) { revisionState = value; },
      setServerBlockSyncState(value) { syncState = value; },
    });
  }

  return {
    lease,
    keyA,
    values,
    writes,
    ownerDataStore,
    callbacks: render(lease),
    pendingBlockMutationsRef,
    snapshotHistory,
    get revision() { return blockCacheRevisionRef.current; },
    get revisionState() { return revisionState; },
    get snapshot() { return visibleSnapshotRef.current; },
    get syncState() { return syncState; },
    async switchOwner() {
      const nextLease = createDeviceAccountLease(OWNER_B, 2);
      leaseRef.current = nextLease;
      const keyB = await ownerDataStore.keyForOwner(OWNER_B, BLOCKS);
      values.set(keyB, JSON.stringify(['easygo:b-existing']));
      await ownerDataStore.activate(nextLease, {
        isCurrentLease: (candidate) => sameDeviceAccountLease(leaseRef.current, candidate),
      });
      visibleSnapshotRef.current = readySnapshot(nextLease, ['easygo:b-existing']);
      const callbacks = render(nextLease);
      // Model the owner-change effect's revision boundary explicitly. Tests
      // below execute callback logic, not the effect scheduler.
      callbacks.invalidateServerBlockSync(nextLease);
      return { callbacks, lease: nextLease, key: keyB };
    },
  };
}

test('pending local mutation pauses snapshots at both old and newly-created revisions until stored', async () => {
  const started = deferred();
  const release = deferred();
  const state = await setup({
    async setItem() { started.resolve(); await release.promise; },
  });
  const { callbacks, lease } = state;
  const initialRevision = state.revision;
  assert.equal(callbacks.confirmServerBlockSync(lease, initialRevision), true);
  const pending = callbacks.saveBlockedAccounts((previous) => [...previous, 'easygo:added']);
  await started.promise;
  const pendingRevision = state.revision;

  assert.equal(pendingRevision, initialRevision + 1);
  assert.equal(state.revisionState, pendingRevision);
  assert.equal(state.pendingBlockMutationsRef.current.size, 1);
  assert.equal(state.syncState, null);
  assert.equal(callbacks.isCurrentBlockCacheRevision(lease, initialRevision), false);
  assert.equal(callbacks.isCurrentBlockCacheRevision(lease, pendingRevision), false);
  assert.equal(callbacks.confirmServerBlockSync(lease, pendingRevision), false);
  assert.deepEqual(state.snapshot.data.blockedAccounts, ['easygo:existing']);

  release.resolve();
  assert.equal(await pending, true);
  assert.equal(state.revision, pendingRevision + 1);
  assert.equal(state.pendingBlockMutationsRef.current.size, 0);
  assert.equal(callbacks.isCurrentBlockCacheRevision(lease, pendingRevision), false);
  assert.equal(callbacks.isCurrentBlockCacheRevision(lease, state.revision), true);
  assert.deepEqual(state.snapshot.data.blockedAccounts, ['easygo:existing', 'easygo:added']);
  assert.equal(state.values.get(state.keyA), JSON.stringify(['easygo:existing', 'easygo:added']));
});

test('failed local persistence returns false and releases its pending pause', async () => {
  const started = deferred();
  const release = deferred();
  const state = await setup({
    async setItem() {
      started.resolve();
      await release.promise;
      throw new Error('test storage failure');
    },
  });
  const initialRevision = state.revision;
  const pending = state.callbacks.saveBlockedAccounts(['easygo:never-stored']);
  await started.promise;
  assert.equal(state.pendingBlockMutationsRef.current.size, 1);
  assert.equal(state.callbacks.isCurrentBlockCacheRevision(state.lease, state.revision), false);
  release.resolve();

  assert.equal(await pending, false);
  assert.equal(state.pendingBlockMutationsRef.current.size, 0);
  assert.equal(state.revision, initialRevision + 2);
  assert.equal(state.callbacks.isCurrentBlockCacheRevision(state.lease, state.revision), true);
  assert.equal(state.snapshot.status, 'storage-error');
  assert.equal(state.snapshot.errorCode, 'device_account_write_failed');
  assert.equal(state.values.get(state.keyA), JSON.stringify(['easygo:existing']));
});

test('two concurrent local mutations keep synchronization paused until both settle', async () => {
  const firstStarted = deferred();
  const firstRelease = deferred();
  const secondStarted = deferred();
  const secondRelease = deferred();
  const state = await setup({
    async setItem(_key, value) {
      if (JSON.parse(value).includes('easygo:second')) {
        secondStarted.resolve();
        await secondRelease.promise;
      } else {
        firstStarted.resolve();
        await firstRelease.promise;
      }
    },
  });
  const initialRevision = state.revision;
  const first = state.callbacks.saveBlockedAccounts((previous) => [...previous, 'easygo:first']);
  await firstStarted.promise;
  const second = state.callbacks.saveBlockedAccounts((previous) => [...previous, 'easygo:second']);
  assert.equal(state.pendingBlockMutationsRef.current.size, 2);
  assert.equal(state.callbacks.isCurrentBlockCacheRevision(state.lease, state.revision), false);
  firstRelease.resolve();
  assert.equal(await first, true);
  await secondStarted.promise;

  assert.equal(state.pendingBlockMutationsRef.current.size, 1);
  assert.equal(state.revision, initialRevision + 3);
  assert.equal(state.callbacks.isCurrentBlockCacheRevision(state.lease, state.revision), false);
  assert.equal(state.callbacks.confirmServerBlockSync(state.lease, state.revision), false);
  secondRelease.resolve();
  assert.equal(await second, true);

  assert.equal(state.pendingBlockMutationsRef.current.size, 0);
  assert.equal(state.revision, initialRevision + 4);
  assert.equal(state.callbacks.isCurrentBlockCacheRevision(state.lease, state.revision), true);
  assert.deepEqual(state.snapshot.data.blockedAccounts, [
    'easygo:existing', 'easygo:first', 'easygo:second',
  ]);
});

test('an old owner mutation finally block cannot invalidate the next owner revision or state', async () => {
  const started = deferred();
  const release = deferred();
  const state = await setup({
    async setItem(_key, value) {
      if (!value.includes('easygo:stale-a')) return;
      started.resolve();
      await release.promise;
    },
  });
  const pendingA = state.callbacks.saveBlockedAccounts((previous) => [...previous, 'easygo:stale-a']);
  await started.promise;
  const ownerB = await state.switchOwner();
  const bRevision = state.revision;
  assert.equal(state.pendingBlockMutationsRef.current.size, 1);
  assert.equal(ownerB.callbacks.isCurrentBlockCacheRevision(ownerB.lease, bRevision), true);
  assert.equal(ownerB.callbacks.confirmServerBlockSync(ownerB.lease, bRevision), true);
  const confirmedB = state.syncState;
  release.resolve();

  assert.equal(await pendingA, false);
  assert.equal(state.pendingBlockMutationsRef.current.size, 0);
  assert.equal(state.revision, bRevision);
  assert.equal(state.revisionState, bRevision);
  assert.equal(state.syncState, confirmedB);
  assert.equal(state.snapshot.lease, ownerB.lease);
  assert.deepEqual(state.snapshot.data.blockedAccounts, ['easygo:b-existing']);
  assert.equal(state.values.get(state.keyA), JSON.stringify(['easygo:existing']));
  assert.equal(state.values.get(ownerB.key), JSON.stringify(['easygo:b-existing']));
});

test('snapshot revision guard reaches a queued storage write after an awaited suspension', async () => {
  const queueStarted = deferred();
  const releaseQueue = deferred();
  const state = await setup({
    async setItem(_key, value) {
      if (value !== 'queue-holder') return;
      queueStarted.resolve();
      await releaseQueue.promise;
    },
  });
  const holder = state.ownerDataStore.write(
    state.lease,
    DEVICE_ACCOUNT_DATA_SLOT.hiddenPosts,
    'queue-holder',
    { isCurrentLease: () => true },
  );
  await queueStarted.promise;
  const pendingSnapshot = state.callbacks.saveServerBlockSnapshot(['easygo:server-stale'], {
    expectedLease: state.lease,
    expectedRevision: state.revision,
  });
  const pendingLocal = state.callbacks.saveBlockedAccounts((previous) => [...previous, 'easygo:local']);
  releaseQueue.resolve();

  await holder;
  assert.equal(await pendingSnapshot, false);
  assert.equal(await pendingLocal, true);
  assert.equal(state.writes.some(({ value }) => value.includes('easygo:server-stale')), false);
  assert.equal(state.snapshot.status, 'ready');
  assert.deepEqual(state.snapshot.data.blockedAccounts, ['easygo:existing', 'easygo:local']);
  assert.equal(state.values.get(state.keyA), JSON.stringify(['easygo:existing', 'easygo:local']));
});

test('an in-flight snapshot invalidated by a local mutation rolls back before the delta executes', async () => {
  const snapshotStarted = deferred();
  const releaseSnapshot = deferred();
  const state = await setup({
    async setItem(_key, value) {
      if (!value.includes('easygo:server-stale')) return;
      snapshotStarted.resolve();
      await releaseSnapshot.promise;
    },
  });
  const pendingSnapshot = state.callbacks.saveServerBlockSnapshot(['easygo:server-stale'], {
    expectedLease: state.lease,
    expectedRevision: state.revision,
  });
  await snapshotStarted.promise;
  const pendingLocal = state.callbacks.saveBlockedAccounts((previous) => [...previous, 'easygo:local']);
  releaseSnapshot.resolve();

  assert.equal(await pendingSnapshot, false);
  assert.equal(await pendingLocal, true);
  assert.equal(state.values.get(state.keyA), JSON.stringify(['easygo:existing', 'easygo:local']));
  assert.deepEqual(state.snapshot.data.blockedAccounts, ['easygo:existing', 'easygo:local']);
  assert.equal(state.snapshotHistory.some((snapshot) => (
    snapshot.data.blockedAccounts.includes('easygo:server-stale')
  )), false);
  assert.equal(state.pendingBlockMutationsRef.current.size, 0);
  assert.equal(state.callbacks.isCurrentBlockCacheRevision(state.lease, state.revision), true);
});

test('local-only clear retains raw server blocks and a later full sync cannot resurrect cleared entries', async () => {
  const clearStarted = deferred();
  const releaseClear = deferred();
  const initialBlocks = ['easygo:local', 'server_id'];
  const state = await setup({
    async setItem(_key, value) {
      if (value !== JSON.stringify(['server_id'])) return;
      clearStarted.resolve();
      await releaseClear.promise;
    },
  }, initialBlocks);
  const clear = state.callbacks.saveBlockedAccounts(removeLocalBlockedAccountEntries);
  await clearStarted.promise;
  const pendingRevision = state.revision;
  assert.equal(await state.callbacks.saveServerBlockSnapshot(initialBlocks, {
    expectedLease: state.lease,
    expectedRevision: pendingRevision,
  }), false);
  assert.equal(state.writes.length, 1);
  releaseClear.resolve();
  assert.equal(await clear, true);
  assert.deepEqual(state.snapshot.data.blockedAccounts, ['server_id']);
  assert.equal(state.values.get(state.keyA), JSON.stringify(['server_id']));
  assert.equal(state.callbacks.isCurrentBlockCacheRevision(state.lease, pendingRevision), false);
  assert.equal(state.callbacks.isCurrentBlockCacheRevision(state.lease, state.revision), true);

  const completedRevision = state.revision;
  const latestPublishedBlocks = state.snapshot.data.blockedAccounts;
  const pages = [
    { rows: [{ id: 'server_id' }], nextCursor: 'server_id' },
    { rows: [{ id: 'server_new' }], nextCursor: null },
  ];
  let pageCalls = 0;
  assert.equal(await synchronizeServerBlockCache({
    currentEntries: latestPublishedBlocks,
    isCurrent: () => state.callbacks.isCurrentBlockCacheRevision(state.lease, completedRevision),
    listPage: async () => { pageCalls += 1; return pages.shift(); },
    saveEntries: (next) => state.callbacks.saveServerBlockSnapshot(next, {
      expectedLease: state.lease,
      expectedRevision: completedRevision,
    }),
  }), true);
  assert.equal(pageCalls, 2);
  assert.deepEqual(state.snapshot.data.blockedAccounts, ['server_id', 'server_new']);
  assert.equal(state.values.get(state.keyA), JSON.stringify(['server_id', 'server_new']));
  assert.equal(state.callbacks.confirmServerBlockSync(state.lease, completedRevision), true);
  assert.equal(state.syncState.revision, completedRevision);
});

test('same-owner snapshot rollback failure publishes storage-error even after its revision is invalidated', async () => {
  const snapshotStarted = deferred();
  const releaseSnapshot = deferred();
  let failRestore = false;
  const original = JSON.stringify(['easygo:existing']);
  const state = await setup({
    async setItem(_key, value) {
      if (failRestore && value === original) throw new Error('test rollback failure');
      if (!value.includes('easygo:server-stale')) return;
      snapshotStarted.resolve();
      await releaseSnapshot.promise;
    },
  });
  const expectedRevision = state.revision;
  const pendingSnapshot = state.callbacks.saveServerBlockSnapshot(['easygo:server-stale'], {
    expectedLease: state.lease,
    expectedRevision,
  });
  await snapshotStarted.promise;
  assert.equal(state.callbacks.invalidateServerBlockSync(state.lease), true);
  assert.equal(state.callbacks.isCurrentBlockCacheRevision(state.lease, expectedRevision), false);
  failRestore = true;
  releaseSnapshot.resolve();

  assert.equal(await pendingSnapshot, false);
  assert.equal(state.snapshot.lease, state.lease);
  assert.equal(state.snapshot.status, 'storage-error');
  assert.equal(state.snapshot.errorCode, 'device_account_stale_rollback_failed');
  assert.equal(state.pendingBlockMutationsRef.current.size, 0);
  assert.equal(await state.callbacks.saveBlockedAccounts(['easygo:must-not-claim-success']), false);
  assert.equal(state.snapshot.status, 'storage-error');
});
