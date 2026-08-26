import assert from 'node:assert/strict';
import test from 'node:test';

import { express4AsyncHandler } from '../src/lib/express-async.js';
import {
  createDeletePostHandler,
  createGlobalFeedWhere,
  createUpdatePostHandler,
  publicPostContent,
  postsRouter,
} from '../src/routes/posts.js';

test('global feed excludes redacted tombstones while preserving search filters', () => {
  assert.deepEqual(createGlobalFeedWhere({ query: 'hello', tag: '#daily' }), {
    parentPostId: null,
    deletedAt: null,
    authorId: { not: null },
    body: { contains: 'hello', mode: 'insensitive' },
    AND: [{ body: { contains: '#daily', mode: 'insensitive' } }],
  });
});

test('public post shaping never exposes fields from a redacted tombstone', () => {
  const privateFields = {
    body: 'historically restored secret body',
    mediaUrl: 'https://private.invalid/restored.png',
    author: { id: 'private-author' },
    deletedAt: new Date('2026-08-26T12:00:00.000Z'),
  };
  assert.deepEqual(publicPostContent(privateFields), {
    body: '',
    mediaUrl: null,
    author: null,
  });
});

test('every asynchronous post route is mounted through the Express 4 rejection wrapper', () => {
  const asyncRoutes = postsRouter.stack.filter((item) => item.route).map((item) => ({
    path: item.route.path,
    method: Object.keys(item.route.methods)[0],
    handlerName: item.route.stack.at(-1).handle.name,
  }));

  assert.equal(asyncRoutes.length, 10);
  assert.deepEqual(new Set(asyncRoutes.map(({ handlerName }) => handlerName)), new Set(['handleAsyncRoute']));
});

test('post deletion is mounted through the Express 4 rejection wrapper', () => {
  const layer = postsRouter.stack.find((item) => (
    item.route?.path === '/:id' && item.route.methods.delete
  ));
  assert.equal(layer.route.stack.at(-1).handle.name, 'handleAsyncRoute');
});

test('post edit holds the shared post lock through ownership check and mutation', async () => {
  const calls = [];
  const updated = {
    id: 'post_1',
    authorId: 'user_1',
    body: 'edited body',
    mediaUrl: null,
  };
  let findCalls = 0;
  const tx = {
    async $queryRawUnsafe(sql, lockKey) {
      calls.push(['lock', sql, lockKey]);
    },
    post: {
      async findUnique(options) {
        calls.push(['find', options]);
        findCalls += 1;
        return findCalls === 1
          ? { id: 'post_1', authorId: 'user_1', contentRevision: 0 }
          : updated;
      },
      async updateMany(options) {
        calls.push(['updateMany', options]);
        return { count: 1 };
      },
    },
  };
  const db = {
    user: { async findUnique() { return { id: 'user_1' }; } },
    async $transaction(callback) {
      calls.push(['transaction']);
      return callback(tx);
    },
  };
  const res = {
    statusCode: 200,
    body: null,
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };

  await createUpdatePostHandler({
    db,
    shape: async (row) => row,
  })({
    params: { id: 'post_1' },
    user: { privyDid: 'did:privy:user-1' },
    body: { body: 'edited body' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { post: updated });
  assert.deepEqual(
    calls.map(([name]) => name),
    ['transaction', 'lock', 'find', 'updateMany', 'find'],
  );
  assert.match(calls[1][1], /pg_advisory_xact_lock/);
  assert.equal(calls[1][2], 'post-report-target:post_1');
  assert.deepEqual(calls[3][1].where, {
    id: 'post_1', authorId: 'user_1', deletedAt: null, contentRevision: 0,
  });
  assert.deepEqual(calls[3][1].data, {
    body: 'edited body',
    contentRevision: { increment: 1 },
  });
});

test('post redaction rejection reaches error middleware instead of unhandledRejection', async () => {
  const failure = new Error('database unavailable');
  const db = {
    user: { async findUnique() { return { id: 'user_1' }; } },
    post: { async findUnique() { return { id: 'post_1', authorId: 'user_1' }; } },
  };
  const wrapped = express4AsyncHandler(createDeletePostHandler({
    db,
    redactPost: async () => { throw failure; },
  }));
  let forwarded = null;

  await wrapped({
    params: { id: 'post_1' },
    user: { privyDid: 'did:privy:user-1' },
  }, {}, (error) => { forwarded = error; });

  assert.equal(forwarded, failure);
});
