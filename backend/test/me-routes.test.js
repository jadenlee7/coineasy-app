import assert from 'node:assert/strict';
import test from 'node:test';
import { DELETE_ACCOUNT_CONFIRMATION } from '../src/lib/account-deletion.js';
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
    set() {
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
    'GET /account-deletion',
    'POST /account-deletion',
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

test('confirmed legacy data deletion is retired without deleting anything', async () => {
  const layer = meRouter.stack.find((item) => item.route?.path === '/data'
    && item.route.methods.delete);
  const handler = layer.route.stack.at(-1).handle;
  const response = responseDouble();

  await handler({
    body: { confirmation: DELETE_DATA_CONFIRMATION },
    user: { privyDid: 'did:privy:test' },
  }, response);
  assert.equal(response.statusCode, 410);
  assert.deepEqual(response.body, {
    error: 'account_deletion_endpoint_moved',
    path: '/me/account-deletion',
  });
});

test('account deletion rejects a confirmed request when the verified token owner changed', async () => {
  const layer = meRouter.stack.find((item) => item.route?.path === '/account-deletion'
    && item.route.methods.post);
  const handler = layer.route.stack.at(-1).handle;
  const response = responseDouble();
  let forwardedError = null;

  await handler({
    body: {
      confirmation: DELETE_ACCOUNT_CONFIRMATION,
      clientRequestId: '11111111-1111-4111-8111-111111111111',
      expectedPrivyDid: 'did:privy:owner-a',
      walletRiskAcknowledged: true,
    },
    user: { privyDid: 'did:privy:owner-b' },
  }, response, (error) => { forwardedError = error; });

  assert.equal(forwardedError, null);
  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body, { error: 'account_deletion_session_changed' });
});
