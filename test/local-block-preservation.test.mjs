import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addServerBlockedAccountId,
  isBlockedAccount,
  localBlockedAccountEntries,
  reconcileServerBlockedAccountIds,
  removeLocalBlockedAccountEntries,
  removeServerBlockedAccountId,
} from '../utils/blockedAccounts.mjs';
import { synchronizeServerBlockCache } from '../utils/serverBlockCacheSync.mjs';

const legacyEntries = ['easygo:legacy_a', 'did:legacy:keep'];

function cacheHarness(entries = [...legacyEntries, 'cached_server']) {
  let stored = JSON.stringify(entries);
  const attempts = [];
  return {
    attempts,
    get entries() { return JSON.parse(stored); },
    async saveEntries(nextEntries) {
      attempts.push([...nextEntries]);
      stored = JSON.stringify(nextEntries);
      return true;
    },
  };
}

test('the first complete empty server list preserves historical local EasyGo and other DID blocks', async () => {
  const cache = cacheHarness(legacyEntries);
  const synchronized = await synchronizeServerBlockCache({
    currentEntries: cache.entries,
    isCurrent: () => true,
    listPage: async () => ({ rows: [], nextCursor: null }),
    saveEntries: cache.saveEntries,
  });

  assert.equal(synchronized, true);
  assert.deepEqual(cache.entries, legacyEntries);
  assert.equal(isBlockedAccount(cache.entries, { userId: 'legacy_a' }), true);
  assert.equal(isBlockedAccount(cache.entries, { did: 'did:legacy:keep' }), true);
});

test('an unrelated nonempty server snapshot retains unconfirmed local blocks but drops stale raw cache ids', () => {
  const next = reconcileServerBlockedAccountIds(
    [...legacyEntries, 'cached_server'],
    ['new_server'],
  );
  assert.deepEqual(next, [...legacyEntries, 'new_server']);
  assert.equal(isBlockedAccount(next, { userId: 'legacy_a' }), true);
  assert.equal(isBlockedAccount(next, { userId: 'cached_server' }), false);
});

test('only confirmed EasyGo aliases hand off to the server cache and a later remote unblock removes them', async () => {
  const cache = cacheHarness(['easygo:legacy_a', 'easygo:legacy_b', 'did:legacy:keep']);
  const sync = (rows) => synchronizeServerBlockCache({
    currentEntries: cache.entries,
    isCurrent: () => true,
    listPage: async () => ({ rows, nextCursor: null }),
    saveEntries: cache.saveEntries,
  });

  assert.equal(await sync([{ id: 'legacy_a' }]), true);
  assert.deepEqual(cache.entries, ['easygo:legacy_b', 'did:legacy:keep', 'legacy_a']);
  assert.equal(isBlockedAccount(cache.entries, { did: 'easygo:legacy_a' }), true);

  assert.equal(await sync([]), true);
  assert.deepEqual(cache.entries, ['easygo:legacy_b', 'did:legacy:keep']);
  assert.equal(isBlockedAccount(cache.entries, { userId: 'legacy_a' }), false);
  assert.equal(isBlockedAccount(cache.entries, { userId: 'legacy_b' }), true);
});

test('existing serialized array storage survives reopen without an envelope migration', async () => {
  const savedBeforeUpgrade = JSON.stringify(['easygo:legacy_a', 'did:legacy:keep']);
  const cache = cacheHarness(JSON.parse(savedBeforeUpgrade));
  await synchronizeServerBlockCache({
    currentEntries: cache.entries,
    isCurrent: () => true,
    listPage: async () => ({ rows: [], nextCursor: null }),
    saveEntries: cache.saveEntries,
  });

  const reopened = JSON.parse(JSON.stringify(cache.entries));
  assert.ok(Array.isArray(reopened));
  assert.deepEqual(reopened, legacyEntries);
  assert.equal(isBlockedAccount(reopened, { userId: 'legacy_a' }), true);
});

test('local entries and server confirmations are deduplicated without losing unrelated historical DIDs', () => {
  assert.deepEqual(
    reconcileServerBlockedAccountIds(
      ['easygo:legacy_a', 'easygo:legacy_a', 'did:legacy:keep', 'did:legacy:keep', 'legacy_b'],
      ['legacy_a', 'legacy_a', 'server_new', 'server_new'],
    ),
    ['did:legacy:keep', 'legacy_a', 'server_new'],
  );
});

test('a successful explicit server block converts only its matching historical alias', () => {
  const entries = addServerBlockedAccountId(
    ['easygo:legacy_a', 'easygo:legacy_b', 'did:legacy:keep', 'legacy_a'],
    'legacy_a',
  );
  assert.deepEqual(entries, ['easygo:legacy_b', 'did:legacy:keep', 'legacy_a']);
  assert.deepEqual(
    reconcileServerBlockedAccountIds(entries, []),
    ['easygo:legacy_b', 'did:legacy:keep'],
  );
});

test('an explicit server unblock removes matching raw and legacy aliases without touching other local blocks', () => {
  assert.deepEqual(
    removeServerBlockedAccountId(
      ['easygo:legacy_a', 'legacy_a', 'easygo:legacy_b', 'did:legacy:keep', 'server_other'],
      'legacy_a',
    ),
    ['easygo:legacy_b', 'did:legacy:keep', 'server_other'],
  );
});

test('local block controls sanitize and deduplicate historical colon entries only', () => {
  assert.deepEqual(
    localBlockedAccountEntries([
      'easygo:legacy_a', 'did:legacy:keep', 'easygo:legacy_a', 'server_a',
      ' padded:entry', 'padded:entry ', '', null, 1, {}, `did:${'x'.repeat(513)}`,
    ]),
    legacyEntries,
  );
  assert.deepEqual(localBlockedAccountEntries(undefined), []);
  assert.deepEqual(localBlockedAccountEntries({ entries: legacyEntries }), []);
});

test('clearing local-only blocks preserves raw server cache ids and does not unblock them', () => {
  const entries = removeLocalBlockedAccountEntries([
    ...legacyEntries, 'server_a', 'server_b', 'server_a', null, '', ' server_c',
  ]);
  assert.deepEqual(entries, ['server_a', 'server_b']);
  assert.equal(isBlockedAccount(entries, { userId: 'server_a' }), true);
  assert.equal(isBlockedAccount(entries, { userId: 'legacy_a' }), false);
  assert.deepEqual(removeLocalBlockedAccountEntries(undefined), []);
});

test('a complete paginated snapshot confirms aliases only after the terminal page', async () => {
  const cache = cacheHarness([...legacyEntries, 'cached_server']);
  const requests = [];
  const pages = [
    { rows: [{ id: 'legacy_a' }], nextCursor: 'legacy_a' },
    { rows: [{ id: 'new_server' }], nextCursor: null },
  ];
  const synchronized = await synchronizeServerBlockCache({
    currentEntries: cache.entries,
    isCurrent: () => true,
    listPage: async (request) => {
      requests.push(request);
      assert.deepEqual(cache.attempts, []);
      assert.deepEqual(cache.entries, [...legacyEntries, 'cached_server']);
      return pages.shift();
    },
    saveEntries: cache.saveEntries,
  });
  assert.equal(synchronized, true);
  assert.deepEqual(requests, [{ cursor: null, limit: 100 }, { cursor: 'legacy_a', limit: 100 }]);
  assert.deepEqual(cache.attempts, [['did:legacy:keep', 'legacy_a', 'new_server']]);
});

for (const failedPage of [1, 2]) {
  test(`a transport failure on page ${failedPage} never saves or hands off a local block`, async () => {
    const cache = cacheHarness();
    const before = cache.entries;
    let page = 0;
    await assert.rejects(synchronizeServerBlockCache({
      currentEntries: before,
      isCurrent: () => true,
      listPage: async () => {
        page += 1;
        if (page === failedPage) throw new Error('fixture_transport_failure');
        return { rows: [{ id: 'legacy_a' }], nextCursor: 'legacy_a' };
      },
      saveEntries: cache.saveEntries,
    }), /fixture_transport_failure/);
    assert.deepEqual(cache.attempts, []);
    assert.deepEqual(cache.entries, before);
  });
}

const malformedPages = [
  ['missing response', undefined],
  ['null response', null],
  ['array response', []],
  ['string response', 'invalid'],
  ['missing rows', { nextCursor: null }],
  ['null rows', { rows: null, nextCursor: null }],
  ['object rows', { rows: {}, nextCursor: null }],
  ['string rows', { rows: 'legacy_a', nextCursor: null }],
  ['null row', { rows: [null], nextCursor: null }],
  ['array row', { rows: [['legacy_a']], nextCursor: null }],
  ['string row', { rows: ['legacy_a'], nextCursor: null }],
  ['missing row id', { rows: [{}], nextCursor: null }],
  ['null row id', { rows: [{ id: null }], nextCursor: null }],
  ['numeric row id', { rows: [{ id: 7 }], nextCursor: null }],
  ['empty row id', { rows: [{ id: '' }], nextCursor: null }],
  ['padded row id', { rows: [{ id: ' legacy_a' }], nextCursor: null }],
  ['internal whitespace in row id', { rows: [{ id: 'legacy a' }], nextCursor: null }],
  ['control character in row id', { rows: [{ id: 'legacy\u0000a' }], nextCursor: null }],
  ['alias instead of raw row id', { rows: [{ id: 'easygo:legacy_a' }], nextCursor: null }],
  ['legacy DID instead of raw row id', { rows: [{ id: 'did:legacy:keep' }], nextCursor: null }],
  ['overlong row id', { rows: [{ id: 'x'.repeat(513) }], nextCursor: null }],
  ['missing cursor', { rows: [{ id: 'legacy_a' }] }],
  ['undefined cursor', { rows: [{ id: 'legacy_a' }], nextCursor: undefined }],
  ['false cursor', { rows: [{ id: 'legacy_a' }], nextCursor: false }],
  ['numeric cursor', { rows: [{ id: 'legacy_a' }], nextCursor: 7 }],
  ['empty cursor', { rows: [{ id: 'legacy_a' }], nextCursor: '' }],
  ['padded cursor', { rows: [{ id: 'legacy_a' }], nextCursor: ' legacy_a' }],
  ['internal whitespace in cursor', { rows: [{ id: 'legacy_a' }], nextCursor: 'legacy a' }],
  ['control character in cursor', { rows: [{ id: 'legacy_a' }], nextCursor: 'legacy\u007fa' }],
  ['alias cursor', { rows: [{ id: 'legacy_a' }], nextCursor: 'easygo:legacy_a' }],
  ['overlong cursor', { rows: [{ id: 'legacy_a' }], nextCursor: 'x'.repeat(513) }],
  ['partially valid rows', { rows: [{ id: 'legacy_a' }, { id: null }], nextCursor: null }],
  ['rows exceeding the requested limit', {
    rows: Array.from({ length: 101 }, (_, index) => ({ id: `server_${index}` })),
    nextCursor: null,
  }],
];

for (const [name, malformedPage] of malformedPages) {
  test(`a malformed snapshot (${name}) leaves the entire existing cache unchanged`, async () => {
    const cache = cacheHarness();
    const before = cache.entries;
    await assert.rejects(synchronizeServerBlockCache({
      currentEntries: before,
      isCurrent: () => true,
      listPage: async () => malformedPage,
      saveEntries: cache.saveEntries,
    }));
    assert.deepEqual(cache.attempts, []);
    assert.deepEqual(cache.entries, before);
  });
}

test('a malformed later page cannot confirm an alias observed on an earlier valid page', async () => {
  const cache = cacheHarness();
  const before = cache.entries;
  const pages = [
    { rows: [{ id: 'legacy_a' }], nextCursor: 'legacy_a' },
    { rows: [{ id: 'server_b' }] },
  ];
  await assert.rejects(synchronizeServerBlockCache({
    currentEntries: before,
    isCurrent: () => true,
    listPage: async () => pages.shift(),
    saveEntries: cache.saveEntries,
  }));
  assert.deepEqual(cache.attempts, []);
  assert.deepEqual(cache.entries, before);
});

test('a repeated pagination cursor cannot save a partial snapshot', async () => {
  const cache = cacheHarness();
  const before = cache.entries;
  await assert.rejects(synchronizeServerBlockCache({
    currentEntries: before,
    isCurrent: () => true,
    listPage: async () => ({ rows: [{ id: 'legacy_a' }], nextCursor: 'legacy_a' }),
    saveEntries: cache.saveEntries,
  }), /server_block_cursor_repeated/);
  assert.deepEqual(cache.attempts, []);
  assert.deepEqual(cache.entries, before);
});

test('reaching the page bound without a terminal page preserves all current entries', async () => {
  const cache = cacheHarness();
  const before = cache.entries;
  let page = 0;
  await assert.rejects(synchronizeServerBlockCache({
    currentEntries: before,
    isCurrent: () => true,
    pageMax: 2,
    listPage: async () => {
      page += 1;
      return { rows: [{ id: `server_${page}` }], nextCursor: `server_${page}` };
    },
    saveEntries: cache.saveEntries,
  }), /server_block_page_bound_exceeded/);
  assert.equal(page, 2);
  assert.deepEqual(cache.attempts, []);
  assert.deepEqual(cache.entries, before);
});

test('a rejected cache save cannot report a confirmed handoff', async () => {
  const cache = cacheHarness();
  const before = cache.entries;
  let saves = 0;
  const synchronized = await synchronizeServerBlockCache({
    currentEntries: before,
    isCurrent: () => true,
    listPage: async () => ({ rows: [{ id: 'legacy_a' }], nextCursor: null }),
    saveEntries: async () => { saves += 1; return false; },
  });
  assert.equal(saves, 1);
  assert.equal(synchronized, false);
  assert.deepEqual(cache.entries, before);
});

test('a thrown cache write cannot confirm synchronization or alter the caller snapshot', async () => {
  const before = [...legacyEntries, 'cached_server'];
  await assert.rejects(synchronizeServerBlockCache({
    currentEntries: before,
    isCurrent: () => true,
    listPage: async () => ({ rows: [{ id: 'legacy_a' }], nextCursor: null }),
    saveEntries: async () => { throw new Error('fixture_storage_failure'); },
  }), /fixture_storage_failure/);
  assert.deepEqual(before, [...legacyEntries, 'cached_server']);
});

test('an already stale account never fetches or saves another owner snapshot', async () => {
  const cache = cacheHarness();
  let fetched = false;
  const synchronized = await synchronizeServerBlockCache({
    currentEntries: cache.entries,
    isCurrent: () => false,
    listPage: async () => { fetched = true; return { rows: [], nextCursor: null }; },
    saveEntries: cache.saveEntries,
  });
  assert.equal(synchronized, false);
  assert.equal(fetched, false);
  assert.deepEqual(cache.attempts, []);
});

test('an account switch during a page request prevents the old owner snapshot from being saved', async () => {
  const cache = cacheHarness();
  const before = cache.entries;
  let current = true;
  const synchronized = await synchronizeServerBlockCache({
    currentEntries: before,
    isCurrent: () => current,
    listPage: async () => {
      current = false;
      return { rows: [{ id: 'legacy_a' }], nextCursor: null };
    },
    saveEntries: cache.saveEntries,
  });
  assert.equal(synchronized, false);
  assert.deepEqual(cache.attempts, []);
  assert.deepEqual(cache.entries, before);
});

test('a same-owner revision becoming stale immediately before save preserves the existing local block', async () => {
  const cache = cacheHarness();
  const before = cache.entries;
  let checks = 0;
  const synchronized = await synchronizeServerBlockCache({
    currentEntries: before,
    isCurrent: () => { checks += 1; return checks < 3; },
    listPage: async () => ({ rows: [{ id: 'legacy_a' }], nextCursor: null }),
    saveEntries: cache.saveEntries,
  });
  assert.equal(synchronized, false);
  assert.deepEqual(cache.attempts, []);
  assert.deepEqual(cache.entries, before);
});

test('an owner becoming stale while storage awaits cannot be marked synchronized', async () => {
  let current = true;
  let saves = 0;
  const synchronized = await synchronizeServerBlockCache({
    currentEntries: legacyEntries,
    isCurrent: () => current,
    listPage: async () => ({ rows: [{ id: 'legacy_a' }], nextCursor: null }),
    saveEntries: async () => { saves += 1; current = false; return true; },
  });
  assert.equal(saves, 1);
  assert.equal(synchronized, false);
});
