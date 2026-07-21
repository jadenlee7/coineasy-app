import assert from 'node:assert/strict';
import test from 'node:test';
import { DELETE_DATA_CONFIRMATION, meRouter } from '../src/routes/me.js';

function routeTable() {
  return meRouter.stack
    .filter((layer) => layer.route)
    .flatMap((layer) => Object.keys(layer.route.methods)
      .map((method) => `${method.toUpperCase()} ${layer.route.path}`));
}

function responseDouble() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('S3 privacy route surface is mounted on the me router', () => {
  assert.deepEqual(routeTable(), [
    'GET /consent',
    'PUT /consent',
    'GET /data',
    'GET /social-export',
    'DELETE /data',
  ]);
});

test('data deletion rejects requests without the explicit confirmation phrase', async () => {
  const layer = meRouter.stack.find((item) => item.route?.path === '/data'
    && item.route.methods.delete);
  const handler = layer.route.stack.at(-1).handle;
  const response = responseDouble();

  await handler({ body: {}, user: { privyDid: 'did:privy:test' } }, response);
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    error: 'confirmation_required',
    confirmation: DELETE_DATA_CONFIRMATION,
  });
});
