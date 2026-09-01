import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing section start: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('mobile block APIs and viewer-relative social reads require owner-bound auth', () => {
  const api = read('../utils/api.js');
  const profiles = section(api, '  profiles: {', '  posts: {');
  const follows = section(api, '  follows: {', '  blocks: {');
  const blocks = section(api, '  blocks: {', '  notifications: {');

  assert.ok((profiles.match(/boundAuth: true/g) || []).length >= 5);
  assert.ok((follows.match(/boundAuth: true/g) || []).length >= 5);
  assert.ok((blocks.match(/boundAuth: true/g) || []).length >= 3);
  assert.match(blocks, /request\('GET', '\/blocks'/);
  assert.match(blocks, /request\('POST', `\/blocks\/\$\{encodeURIComponent\(targetUserId\)\}`/);
  assert.match(blocks, /request\('DELETE', `\/blocks\/\$\{encodeURIComponent\(targetUserId\)\}`/);
});

test('post menu persists the server block before using the device cache', () => {
  const source = read('../components/modals/PostSettingsModal.js');
  const target = section(source, 'function createPostSettingsTarget', 'function beginPostSettingsPresentation');
  const block = section(source, 'const blockUser = async', '    const hidePost = async');
  const serverMutation = block.indexOf('await api.blocks.block(operation.expectedAuthorUserId');
  const localCache = block.indexOf('await saveBlockedAccounts(temp_list);');

  assert.match(target, /authorUserId: post\?\.easygo\?\.authorId/);
  assert.ok(serverMutation >= 0);
  assert.ok(localCache > serverMutation);
  assert.match(block, /expectedAuthUserId: operation\.expectedLease\.ownerUserId/);
  assert.match(block, /result\?\.blocked !== true/);
  assert.match(block, /addServerBlockedAccountId\([\s\S]*?operation\.expectedAuthorUserId/);
  assert.match(block, /const temp_list = \(entries\) => addServerBlockedAccountId/);
  assert.doesNotMatch(block, /saveBlockedAccounts\([\s\S]*?expectedCreatorDid/);
  assert.match(block, /operation\.source\?\.callbackDelete\?\.\(\)/);
  assert.match(source, /Public signed-out views may still show public posts\./);
  assert.doesNotMatch(source, /will no longer be able to follow or see your posts/);
});

test('settings manages the server list and describes unblock without restoring follows', () => {
  const source = read('../components/modals/SettingsModal.js');
  const load = section(source, 'const loadBlockedAccounts = async', '  const toggleBlockedAccounts');
  const unblock = section(source, 'const requestUnblock =', '  const signOut =');

  assert.match(load, /api\.blocks\.list\(\{/);
  assert.match(load, /expectedAuthUserId: expectedOperation\.ownerUserId/);
  assert.match(unblock, /api\.blocks\.unblock\(blockedAccount\.id/);
  assert.match(unblock, /removeServerBlockedAccountId\([\s\S]*?blockedAccount\.id/);
  assert.match(unblock, /saveBlockedAccounts\(\(entries\) => removeServerBlockedAccountId/);
  assert.doesNotMatch(unblock, /clearBlockedAccounts\(\)/);
  assert.match(unblock, /Following is not restored automatically\./);
  assert.match(source, /Public signed-out views may still show public content\./);
  assert.match(source, /Load more/);
  assert.doesNotMatch(source, /ON-DEVICE SAFETY LISTS/);
});

test('local-only clear is owner-bound, uses latest entries and makes no server mutation', () => {
  const source = read('../components/modals/SettingsModal.js');
  const clear = section(source, 'const clearDeviceOnlyBlocks =', '  const loadBlockedAccounts');
  assert.match(source, /localBlockedAccountEntries\(listBlockedUser\)/);
  assert.match(clear, /saveBlockedAccounts\(removeLocalBlockedAccountEntries\)/);
  assert.ok((clear.match(/isCurrentAccountOperation\(expectedOperation\)/g) || []).length >= 3);
  assert.match(clear, /if \(!saved &&/);
  assert.doesNotMatch(clear, /api\.|listBlockedUser|clearBlockedAccounts/);
  assert.match(source, /No account-wide blocks\./);
  assert.match(source, /not automatically added to your account-wide list/);
});

test('block deltas pause sync and snapshots pass their revision guard through storage awaits', () => {
  const source = read('../contexts/DeviceAccountDataContext.js');
  const save = section(source, 'const saveBlockedAccounts =', '  const saveServerBlockSnapshot');
  const snapshot = section(source, 'const saveServerBlockSnapshot =', '  const confirmServerBlockSync');
  const write = section(source, 'const saveValue =', '  const saveList');
  assert.match(save, /ownerDataStore\.update\(/);
  assert.match(save, /updateList\(Object\.freeze\(parsedList\(previous\)\)\)/);
  assert.match(save, /pendingBlockMutationsRef\.current\.add\(operation\)/);
  assert.match(save, /finally\s*\{[\s\S]*pendingBlockMutationsRef\.current\.delete\(operation\);[\s\S]*invalidateServerBlockSync\(expectedLease\)/);
  assert.match(source, /pendingBlockMutationsRef\.current\]\.some/);
  assert.match(snapshot, /\(\) => isCurrentBlockCacheRevision\(expectedLease, expectedRevision\)/);
  assert.match(write, /isCurrentLease: operationGuard/);
  assert.match(write, /if \(!operationGuard\(expectedLease\)\) return false/);
});

test('already-rendered feed and search caches enforce EasyGo ids plus legacy DIDs', () => {
  const feed = read('../components/Feed.js');
  const search = read('../screens/Search.js');
  const app = read('../App.js');
  assert.match(feed, /isBlockedAccount\(listBlockedUser/);
  assert.match(feed, /post\?\.easygo\?\.authorId/);
  assert.match(search, /isBlockedAccount\(listBlockedUser/);
  assert.match(search, /serverBlocksSynchronized \? storedRecentSearches : \[\]/);
  assert.match(app, /synchronizeServerBlockCache\(\{/);
  assert.match(app, /isCurrentBlockCacheRevision\(expectedLease, expectedRevision\)/);
  assert.match(app, /saveServerBlockSnapshot\(entries, \{/);
  assert.match(app, /confirmServerBlockSync\(expectedLease, expectedRevision\)/);
  const context = read('../contexts/DeviceAccountDataContext.js');
  assert.match(context, /invalidateServerBlockSync\(expectedLease\)/);
  assert.match(context, /serverBlockSyncState\.revision === blockCacheRevision/);
});

test('all signed-in profile discovery and graph consumers pass their captured owner', () => {
  const sources = [
    read('../hooks/useSocialProfile.js'),
    read('../screens/Search.js'),
    read('../components/ProfileDetails.js'),
    read('../components/Postbox.js'),
    read('../screens/Navigation/Follow/FollowNavigation.js'),
  ];
  const combined = sources.join('\n');
  for (const prefix of [
    'api.profiles.get(',
    'api.profiles.search(',
    'api.follows.followers(',
    'api.follows.following(',
  ]) {
    const calls = combined.split(prefix).length - 1;
    assert.ok(calls > 0, `expected ${prefix} calls`);
  }
  assert.ok((combined.match(/expectedAuthUserId: operationLease\.ownerUserId/g) || []).length >= 11);
});
