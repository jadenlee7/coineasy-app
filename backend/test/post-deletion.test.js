import assert from 'node:assert/strict';
import test from 'node:test';

import { express4AsyncHandler } from '../src/lib/express-async.js';
import {
  createDeletePostHandler,
  createGlobalFeedWhere,
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
