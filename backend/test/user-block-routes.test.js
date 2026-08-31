import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createBlockUserHandler,
  createUnblockUserHandler,
} from '../src/routes/blocks.js';
import {
  createFollowHandler,
  createFollowStatusHandler,
  createFollowersHandler,
} from '../src/routes/follows.js';
import {
  createLikePostHandler,
  createPostHandler,
} from '../src/routes/posts.js';

function response() {
  return {
    body: null,
    headers: {},
    statusCode: 200,
    set(name, value) { this.headers[name] = value; return this; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('self-block is rejected before target lookup or transaction', async () => {
  const calls = [];
  const db = {
    user: {
      async findUnique(options) {
        calls.push(options);
        return { id: 'me' };
      },
    },
    async $transaction() { throw new Error('must not run'); },
  };
  const res = response();
  await createBlockUserHandler({ db })({
    params: { targetUserId: 'me' },
    user: { privyDid: 'did:me' },
  }, res);

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { error: 'cannot_block_self' });
  assert.equal(calls.length, 1);
});

test('unblock does not require a target row and remains idempotent after deletion', async () => {
  let deleted = 0;
  const tx = {
    async $queryRawUnsafe() {},
    user: { async findUnique() { return { id: 'gone-user' }; } },
    userBlock: {
      async deleteMany() { return { count: deleted++ === 0 ? 1 : 0 }; },
    },
  };
  const db = {
    user: { async findUnique() { return { id: 'me' }; } },
    async $transaction(operation) { return operation(tx); },
  };
  for (const expectedChanged of [true, false]) {
    const res = response();
    await createUnblockUserHandler({ db })({
      params: { targetUserId: 'gone-user' },
      user: { privyDid: 'did:me' },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { blocked: false, changed: expectedChanged });
  }
});

function blockedInteractionDb() {
  let postCreates = 0;
  let likeWrites = 0;
  let followWrites = 0;
  const tx = {
    async $queryRawUnsafe() {},
    user: { async findUnique() { return { id: 'author' }; } },
    userBlock: { async findFirst() { return { blockerId: 'author' }; } },
    post: {
      async findUnique({ select }) {
        return select?.deletedAt
          ? { id: 'post', authorId: 'author', deletedAt: null }
          : { id: 'post', authorId: 'author' };
      },
      async create() { postCreates += 1; return { id: 'new' }; },
    },
    like: { async upsert() { likeWrites += 1; } },
    follow: { async upsert() { followWrites += 1; } },
  };
  const db = {
    user: { async findUnique() { return { id: 'me' }; } },
    async $transaction(operation) { return operation(tx); },
  };
  return {
    db,
    counts: () => ({ postCreates, likeWrites, followWrites }),
  };
}

test('blocked pairs cannot create replies, likes, or follows', async () => {
  const { db, counts } = blockedInteractionDb();
  const cases = [
    [
      createPostHandler({ db, shape: async (row) => row }),
      {
        body: { body: 'reply', parentPostId: 'post' },
        params: {},
        user: { privyDid: 'did:me' },
      },
    ],
    [
      createLikePostHandler({ db }),
      { params: { id: 'post' }, user: { privyDid: 'did:me' } },
    ],
    [
      createFollowHandler({ db }),
      { params: { targetUserId: 'author' }, user: { privyDid: 'did:me' } },
    ],
  ];

  for (const [handler, req] of cases) {
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.body, { error: 'blocked_interaction' });
  }
  assert.deepEqual(counts(), { postCreates: 0, likeWrites: 0, followWrites: 0 });
});

test('authenticated follower lists omit both inbound and outbound block peers', async () => {
  let followQuery;
  const db = {
    userBlock: {
      async findFirst() { return null; },
    },
    follow: {
      async findMany(options) { followQuery = options; return []; },
    },
  };
  const res = response();
  await createFollowersHandler({
    db,
    resolveViewer: async () => ({ id: 'me' }),
  })({
    headers: {},
    params: { userId: 'visible-profile' },
    query: {},
  }, res);

  assert.deepEqual(followQuery.where, {
    followeeId: 'visible-profile',
    follower: {
      is: {
        blocksMade: { none: { blockedId: 'me' } },
        blocksTaken: { none: { blockerId: 'me' } },
      },
    },
  });
  assert.deepEqual(res.body, { rows: [], nextCursor: null });
});

test('follow status returns the same generic not-found for either block direction', async () => {
  for (const scenario of ['outbound-block', 'inbound-block', 'missing-target']) {
    let targetQuery;
    const db = {
      user: {
        async findUnique() { return { id: 'me' }; },
        async findFirst(options) { targetQuery = options; return null; },
      },
      follow: { async findUnique() { throw new Error('must not disclose follow state'); } },
    };
    const res = response();
    await createFollowStatusHandler({ db })({
      params: { targetUserId: 'target' },
      user: { privyDid: 'did:me' },
    }, res);
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { error: 'not_found' });
    assert.deepEqual(targetQuery, {
      where: {
        id: 'target',
        blocksMade: { none: { blockedId: 'me' } },
        blocksTaken: { none: { blockerId: 'me' } },
      },
      select: { id: true },
    }, scenario);
  }
});

test('follow status reads only an outgoing edge after a visible target resolves', async () => {
  const db = {
    user: {
      async findUnique() { return { id: 'me' }; },
      async findFirst() { return { id: 'target' }; },
    },
    follow: {
      async findUnique(options) {
        assert.deepEqual(options.where, {
          followerId_followeeId: { followerId: 'me', followeeId: 'target' },
        });
        return null;
      },
    },
  };
  const res = response();
  await createFollowStatusHandler({ db })({
    params: { targetUserId: 'target' },
    user: { privyDid: 'did:me' },
  }, res);
  assert.deepEqual(res.body, { following: false });
});
