import assert from 'node:assert/strict';
import test from 'node:test';

import { express4AsyncHandler } from '../src/lib/express-async.js';
import { createDeletePostHandler, postsRouter } from '../src/routes/posts.js';

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
