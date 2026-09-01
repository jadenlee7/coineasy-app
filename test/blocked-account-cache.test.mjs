import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addServerBlockedAccountId,
  isBlockedAccount,
  reconcileServerBlockedAccountIds,
  removeServerBlockedAccountId,
} from '../utils/blockedAccounts.mjs';
import { synchronizeServerBlockCache } from '../utils/serverBlockCacheSync.mjs';

test('server ids and legacy DIDs both suppress the matching social identity', () => {
  const entries = ['user_1', 'easygo:user_2', 'did:legacy:3'];
  assert.equal(isBlockedAccount(entries, { userId: 'user_1', did: 'easygo:user_1' }), true);
  assert.equal(isBlockedAccount(entries, { userId: 'user_2', did: 'easygo:user_2' }), true);
  assert.equal(isBlockedAccount(entries, { userId: 'user_3', did: 'did:legacy:3' }), true);
  assert.equal(isBlockedAccount(entries, { userId: 'user_4', did: 'easygo:user_4' }), false);
});

test('new blocks use raw EasyGo ids and one unblock preserves every other entry', () => {
  const added = addServerBlockedAccountId(
    ['easygo:user_1', 'user_2', 'did:legacy:3'],
    'user_1',
  );
  assert.deepEqual(added, ['user_2', 'did:legacy:3', 'user_1']);
  assert.deepEqual(
    removeServerBlockedAccountId(added, 'user_1'),
    ['user_2', 'did:legacy:3'],
  );
});

test('complete server reconciliation replaces server ids but retains local creator DIDs', () => {
  assert.deepEqual(
    reconcileServerBlockedAccountIds(
      ['stale_user', 'easygo:stale_user_2', 'did:legacy:keep'],
      ['server_a', 'server_b'],
    ),
    ['easygo:stale_user_2', 'did:legacy:keep', 'server_a', 'server_b'],
  );
});

test('server synchronization writes only after every page and never after owner invalidation', async () => {
  const saved = [];
  let current = true;
  const pages = [
    { rows: [{ id: 'server_a' }], nextCursor: 'server_a' },
    { rows: [{ id: 'server_b' }], nextCursor: null },
  ];
  const synchronized = await synchronizeServerBlockCache({
    currentEntries: ['did:legacy:keep', 'stale_server'],
    isCurrent: () => current,
    listPage: async () => pages.shift(),
    saveEntries: async (entries) => { saved.push(entries); return true; },
  });
  assert.equal(synchronized, true);
  assert.deepEqual(saved, [['did:legacy:keep', 'server_a', 'server_b']]);

  const canceledWrites = [];
  await synchronizeServerBlockCache({
    currentEntries: ['safe_existing'],
    isCurrent: () => current,
    listPage: async () => {
      current = false;
      return { rows: [{ id: 'other_owner' }], nextCursor: null };
    },
    saveEntries: async (entries) => { canceledWrites.push(entries); return true; },
  });
  assert.deepEqual(canceledWrites, []);
});

test('partial or repeated pagination never replaces the existing cache', async () => {
  const saved = [];
  await assert.rejects(
    synchronizeServerBlockCache({
      currentEntries: ['safe_existing'],
      isCurrent: () => true,
      listPage: async () => ({ rows: [{ id: 'partial' }], nextCursor: 'repeat' }),
      saveEntries: async (entries) => { saved.push(entries); return true; },
    }),
    /server_block_cursor_repeated/,
  );
  assert.deepEqual(saved, []);
});

for (const mutation of ['block', 'unblock']) {
  test(`a same-owner ${mutation} revision invalidates an older completed snapshot`, async () => {
    const saved = [];
    let currentChecks = 0;
    const synchronized = await synchronizeServerBlockCache({
      currentEntries: ['existing'],
      isCurrent: () => {
        currentChecks += 1;
        // The third check is immediately before the wholesale snapshot write.
        return currentChecks < 3;
      },
      listPage: async () => ({ rows: [{ id: 'server_row' }], nextCursor: null }),
      saveEntries: async (entries) => { saved.push(entries); return true; },
    });
    assert.equal(synchronized, false);
    assert.deepEqual(saved, []);
  });
}
