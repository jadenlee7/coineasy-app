import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRegisterPushTokenHandler,
  createUnregisterPushTokenHandler,
  pushTokensRouter,
} from '../src/routes/push-tokens.js';

const TOKEN = 'ExponentPushToken[account_bound_token_123456]';

function responseDouble() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('push-token router exposes authenticated register and unregister operations', () => {
  const routes = pushTokensRouter.stack
    .filter((layer) => layer.route)
    .flatMap((layer) => Object.keys(layer.route.methods)
      .map((method) => `${method.toUpperCase()} ${layer.route.path}`));
  assert.deepEqual(routes, ['PUT /', 'DELETE /']);
  for (const layer of pushTokensRouter.stack.filter((item) => item.route)) {
    assert.equal(layer.route.stack.length, 2);
  }
});

test('registration atomically assigns the unique token to the authenticated account', async () => {
  const now = new Date('2026-08-11T07:00:00.000Z');
  let upsert;
  const db = {
    user: {
      findUnique: async () => ({ id: 'user_current' }),
    },
    expoPushToken: {
      upsert: async (options) => {
        upsert = options;
        return { platform: options.update.platform, lastSeenAt: now };
      },
    },
  };
  const response = responseDouble();

  await createRegisterPushTokenHandler({
    db,
    now: () => now,
    registrationEnabled: () => true,
  })({
    body: { token: TOKEN, platform: 'ios' },
    user: { privyDid: 'did:privy:current' },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(upsert.where, { token: TOKEN });
  assert.equal(upsert.update.userId, 'user_current');
  assert.equal(upsert.create.userId, 'user_current');
  assert.equal(upsert.update.lastSeenAt, now);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.body.registration.registered, true);
  assert.equal(JSON.stringify(response.body).includes(TOKEN), false);
});

test('unregister is idempotent and cannot remove another account registration', async () => {
  let removal;
  const db = {
    user: {
      findUnique: async () => ({ id: 'user_current' }),
    },
    expoPushToken: {
      deleteMany: async (options) => {
        removal = options;
        return { count: 0 };
      },
    },
  };
  const response = responseDouble();

  await createUnregisterPushTokenHandler({ db })({
    body: { token: TOKEN },
    user: { privyDid: 'did:privy:current' },
  }, response);

  assert.deepEqual(removal.where, { userId: 'user_current', token: TOKEN });
  assert.deepEqual(response.body, { registration: { registered: false } });
});

test('invalid or unsupported tokens cause no database writes', async (t) => {
  for (const body of [
    { token: 'not-an-expo-token', platform: 'ios' },
    { token: TOKEN, platform: 'web' },
    { token: TOKEN, platform: 'ios', extra: true },
  ]) {
    await t.test(JSON.stringify(body), async () => {
      let reads = 0;
      const response = responseDouble();
      await createRegisterPushTokenHandler({
        db: {
          user: { findUnique: async () => { reads += 1; } },
          expoPushToken: { upsert: async () => { throw new Error('must not write'); } },
        },
        registrationEnabled: () => true,
      })({ body, user: { privyDid: 'did:privy:current' } }, response);
      assert.equal(response.statusCode, 400);
      assert.equal(response.body.error, 'bad_input');
      assert.equal(reads, 0);
    });
  }
});

test('a missing local user cannot create a registration', async () => {
  let writes = 0;
  const response = responseDouble();
  await createRegisterPushTokenHandler({
    db: {
      user: { findUnique: async () => null },
      expoPushToken: { upsert: async () => { writes += 1; } },
    },
    registrationEnabled: () => true,
  })({
    body: { token: TOKEN, platform: 'android' },
    user: { privyDid: 'did:privy:missing' },
  }, response);
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { error: 'user_not_found' });
  assert.equal(writes, 0);
});

test('the shipped compile brake rejects registration before validation or database access', async () => {
  let reads = 0;
  const response = responseDouble();
  await createRegisterPushTokenHandler({
    db: {
      user: { findUnique: async () => { reads += 1; } },
      expoPushToken: { upsert: async () => { throw new Error('must not write'); } },
    },
    env: { PUSH_TOKEN_REGISTRATION_ENABLED: 'true' },
  })({
    body: { token: TOKEN, platform: 'ios' },
    user: { privyDid: 'did:privy:current' },
  }, response);

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: 'push_token_registration_disabled' });
  assert.equal(reads, 0);
});
