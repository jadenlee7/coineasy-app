import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  BLOCKED_USER_PUBLIC_SELECT,
  USER_BLOCKS_PER_ACCOUNT_MAX,
  createUserBlock,
  deleteUserBlock,
  isUserPairBlocked,
  listUserBlocks,
  userVisibleToViewerWhere,
  userPairLockKey,
} from '../src/lib/user-blocks.js';
import { socialReadCachePolicy } from '../src/middleware/social-read-cache.js';

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

test('user-block migration is additive, unique, self-safe, and account-cascading', () => {
  const schema = source('../prisma/schema.prisma');
  const migration = source('../prisma/migrations/20260831120000_user_blocks/migration.sql');

  assert.match(schema, /model UserBlock \{/);
  assert.match(schema, /@@id\(\[blockerId, blockedId\]\)/);
  assert.match(schema, /@@index\(\[blockerId, createdAt, blockedId\]\)/);
  assert.match(schema, /@@index\(\[blockedId, blockerId\]\)/);
  assert.match(schema, /@relation\("UserBlockBlocker"[\s\S]*?onDelete: Cascade\)/);
  assert.match(schema, /@relation\("UserBlockBlocked"[\s\S]*?onDelete: Cascade\)/);
  assert.match(migration, /CREATE TABLE "UserBlock"/);
  assert.match(migration, /CONSTRAINT "UserBlock_not_self" CHECK \("blockerId" <> "blockedId"\)/);
  assert.equal((migration.match(/ON DELETE CASCADE/g) || []).length, 2);
  assert.match(migration, /ON "UserBlock"\("blockerId", "createdAt", "blockedId"\)/);
  assert.match(migration, /ON "UserBlock"\("blockedId", "blockerId"\)/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/i);
});

test('block creation is idempotent, pair-serialized, and removes follows both ways', async () => {
  const calls = [];
  let existing = null;
  const tx = {
    async $queryRawUnsafe(sql, key) { calls.push(['lock', sql, key]); },
    user: { async findUnique() { return { id: 'user_a' }; } },
    userBlock: {
      async findUnique(options) { calls.push(['find', options]); return existing; },
      async count(options) { calls.push(['count', options]); return 0; },
      async create(options) {
        calls.push(['create', options]);
        existing = options.data;
        return options.data;
      },
    },
    follow: {
      async deleteMany(options) { calls.push(['unfollow', options]); return { count: 2 }; },
    },
  };
  const db = {
    async $transaction(operation) { calls.push(['transaction']); return operation(tx); },
  };

  assert.deepEqual(
    await createUserBlock(db, { blockerId: 'user_b', blockedId: 'user_a' }),
    { blocked: true, changed: true },
  );
  assert.deepEqual(
    await createUserBlock(db, { blockerId: 'user_b', blockedId: 'user_a' }),
    { blocked: true, changed: false },
  );
  assert.equal(calls.filter(([name]) => name === 'create').length, 1);
  assert.equal(calls.filter(([name]) => name === 'count').length, 1);
  assert.equal(calls.filter(([name]) => name === 'unfollow').length, 2);
  assert.deepEqual(calls.filter(([name]) => name === 'lock').slice(0, 2).map((call) => call[2]), [
    'user-block-actor:user_b',
    'user-pair:user_a:user_b',
  ]);
  const unfollow = calls.find(([name]) => name === 'unfollow')[1];
  assert.deepEqual(unfollow.where.OR, [
    { followerId: 'user_b', followeeId: 'user_a' },
    { followerId: 'user_a', followeeId: 'user_b' },
  ]);
});

test('unblock is idempotent and cannot recreate follows', async () => {
  const calls = [];
  let count = 1;
  const tx = {
    async $queryRawUnsafe() {},
    userBlock: {
      async deleteMany(options) {
        calls.push(options);
        const result = { count };
        count = 0;
        return result;
      },
    },
  };
  const db = { async $transaction(operation) { return operation(tx); } };
  assert.deepEqual(
    await deleteUserBlock(db, { blockerId: 'me', blockedId: 'them' }),
    { blocked: false, changed: true },
  );
  assert.deepEqual(
    await deleteUserBlock(db, { blockerId: 'me', blockedId: 'them' }),
    { blocked: false, changed: false },
  );
  assert.deepEqual(calls[0].where, { blockerId: 'me', blockedId: 'them' });
});

test('a target deleted before the locked write returns not-found without a block', async () => {
  let creates = 0;
  let followDeletes = 0;
  const tx = {
    async $queryRawUnsafe() {},
    user: { async findUnique() { return null; } },
    userBlock: { async create() { creates += 1; } },
    follow: { async deleteMany() { followDeletes += 1; } },
  };
  const db = { async $transaction(operation) { return operation(tx); } };
  assert.deepEqual(
    await createUserBlock(db, { blockerId: 'me', blockedId: 'gone' }),
    { error: 'target_not_found', status: 404 },
  );
  assert.equal(creates, 0);
  assert.equal(followDeletes, 0);
});

test('bidirectional visibility uses indexed relation anti-filters without materializing ids', async () => {
  const db = {
    userBlock: {
      async findFirst(options) {
        assert.deepEqual(options.where.OR, [
          { blockerId: 'me', blockedId: 'a' },
          { blockerId: 'a', blockedId: 'me' },
        ]);
        return { blockerId: 'a' };
      },
    },
  };
  assert.deepEqual(userVisibleToViewerWhere('me'), {
    blocksMade: { none: { blockedId: 'me' } },
    blocksTaken: { none: { blockerId: 'me' } },
  });
  assert.deepEqual(userVisibleToViewerWhere(null), {});
  assert.equal(await isUserPairBlocked(db, 'me', 'a'), true);
  assert.equal(await isUserPairBlocked(db, 'me', 'me'), false);
  assert.equal(userPairLockKey('z', 'a'), 'user-pair:a:z');
});

test('the actor-serialized hard bound rejects graph growth but preserves idempotent replay', async () => {
  const calls = [];
  const tx = {
    async $queryRawUnsafe(_sql, key) { calls.push(key); },
    user: { async findUnique() { return { id: 'target' }; } },
    userBlock: {
      async findUnique() { return null; },
      async count() { return USER_BLOCKS_PER_ACCOUNT_MAX; },
      async create() { throw new Error('must not create over the bound'); },
    },
    follow: { async deleteMany() { throw new Error('must not delete on rejected block'); } },
  };
  const db = { async $transaction(operation) { return operation(tx); } };
  assert.deepEqual(
    await createUserBlock(db, { blockerId: 'me', blockedId: 'target' }),
    { error: 'block_limit_reached', status: 409 },
  );
  assert.deepEqual(calls, ['user-block-actor:me', 'user-pair:me:target']);
});

test('block list returns only the selected public account projection', async () => {
  let query;
  const db = {
    userBlock: {
      async findMany(options) {
        query = options;
        return [{
          blockerId: 'me',
          blockedId: 'them',
          createdAt: new Date('2026-08-31T00:00:00.000Z'),
          blocked: {
            id: 'them', username: 'safe', displayName: 'Safe', pfp: null,
          },
        }];
      },
    },
  };
  const result = await listUserBlocks(db, { blockerId: 'me', cursor: null, limit: 50 });
  assert.deepEqual(query.include.blocked.select, BLOCKED_USER_PUBLIC_SELECT);
  assert.deepEqual(result, {
    rows: [{
      id: 'them',
      username: 'safe',
      displayName: 'Safe',
      pfp: null,
      blockedAt: new Date('2026-08-31T00:00:00.000Z'),
    }],
    nextCursor: null,
  });
  assert.equal(JSON.stringify(result).includes('privy'), false);
  assert.equal(JSON.stringify(result).includes('wallet'), false);
});

test('route source rejects self-blocks and gates every block endpoint with auth', () => {
  const routes = source('../src/routes/blocks.js');
  const app = source('../src/app.js');
  assert.match(routes, /me\.id === req\.params\.targetUserId[\s\S]*?409[\s\S]*?cannot_block_self/);
  assert.equal((routes.match(/requireAuth, express4AsyncHandler/g) || []).length, 3);
  assert.match(routes, /Cache-Control', 'no-store'/);
  assert.ok(
    app.indexOf('error instanceof SocialViewerAuthorizationError')
      < app.indexOf('telemetry.setupErrorHandler(app)'),
    'expected invalid social bearers must return 401 before telemetry/generic 500 handling',
  );
});

test('viewer-relative social reads are never cacheable across Authorization scopes', () => {
  const headers = {};
  let nextCalls = 0;
  socialReadCachePolicy({ method: 'GET' }, {
    set(name, value) { headers[name] = value; },
    vary(value) { headers.Vary = value; },
  }, () => { nextCalls += 1; });
  assert.deepEqual(headers, { 'Cache-Control': 'no-store', Vary: 'Authorization' });
  assert.equal(nextCalls, 1);

  const app = source('../src/app.js');
  for (const path of ['/profiles', '/posts', '/follows', '/notifications', '/blocks']) {
    assert.match(app, new RegExp(`app\\.use\\('${path}', socialReadCachePolicy\\)`));
  }
});

test('authenticated social paths include block visibility and interaction enforcement', () => {
  const posts = source('../src/routes/posts.js');
  const follows = source('../src/routes/follows.js');
  const profiles = source('../src/routes/profiles.js');
  const notifications = source('../src/routes/notifications.js');

  assert.match(posts, /createGlobalFeedWhere\(\{ query, tag, viewerUserId: viewer\?\.id \}\)/);
  assert.match(posts, /parentPostId: req\.params\.id,[\s\S]*?author: \{ is: userVisibleToViewerWhere\(viewer\.id\) \}/);
  assert.equal((posts.match(/error: 'blocked_interaction'/g) || []).length, 2);
  assert.match(follows, /lockUserPair\(tx, me\.id, req\.params\.targetUserId\)/);
  assert.match(follows, /error: 'blocked_interaction'/);
  assert.match(follows, /id: req\.params\.targetUserId,[\s\S]*?userVisibleToViewerWhere\(me\.id\)[\s\S]*?404[\s\S]*?not_found/);
  assert.doesNotMatch(follows, /blocked: true/);
  assert.match(profiles, /userVisibleToViewerWhere\(viewer\?\.id\)/);
  assert.match(notifications, /const visibleUserWhere = userVisibleToViewerWhere\(me\.id\)/);
  assert.ok((notifications.match(/\{ is: visibleUserWhere \}/g) || []).length >= 3);
  assert.doesNotMatch(`${posts}\n${follows}\n${profiles}\n${notifications}`, /blockedUserIds|notIn: excludedUserIds/);
});
