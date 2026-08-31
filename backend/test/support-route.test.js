import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import pino from 'pino';

import { createApp } from '../src/app.js';
import { createNoopTelemetry } from '../src/lib/telemetry.js';
import {
  createSupportPageHandler,
  EASYGO_SUPPORT_EMAIL,
  supportRouter,
} from '../src/routes/support.js';

function response() {
  return {
    body: null,
    contentType: null,
    headers: {},
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    type(value) {
      this.contentType = value;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
  };
}

test('support router exposes one public GET page', () => {
  const paths = supportRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods).join(',').toUpperCase()} ${layer.route.path}`);
  assert.deepEqual(paths, ['GET /']);
});

test('support page publishes fixed contact and safety guidance without collection code', () => {
  const res = response();
  createSupportPageHandler()({}, res);

  assert.equal(EASYGO_SUPPORT_EMAIL, 'contact@coineasy.xyz');
  assert.equal(res.contentType, 'html');
  assert.equal(res.headers['Cache-Control'], 'public, max-age=300');
  assert.match(res.headers['Content-Security-Policy'], /default-src 'none'/);
  assert.equal(res.headers['Referrer-Policy'], 'no-referrer');
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.match(res.body, /EasyGo Support/);
  assert.match(res.body, /mailto:contact@coineasy\.xyz\?subject=EasyGo%20support/);
  assert.match(res.body, /Report/);
  assert.match(res.body, /Block/);
  assert.match(res.body, /follows your EasyGo account/);
  assert.match(res.body, /Public signed-out views may still show public content/);
  assert.match(res.body, /Blocked EasyGo accounts/);
  assert.match(res.body, /one account at a time/);
  assert.match(res.body, /does not restore previous follows/);
  assert.doesNotMatch(res.body, /on-device safety list|resets the entire on-device list/);
  assert.doesNotMatch(res.body, /account deletion|Delete EasyGo account|Delete your account/i);
  assert.doesNotMatch(res.body, /<script|<form|http:\/\//i);
});

test('createApp serves the public support contract and keeps other support paths closed', async () => {
  const app = createApp({
    db: { async $queryRawUnsafe() { return [1]; } },
    env: { LEGACY_SOCIAL_MODE: 'active' },
    appLogger: pino({ level: 'silent' }),
    telemetry: createNoopTelemetry(),
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const address = server.address();
    assert.equal(typeof address, 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const support = await fetch(`${baseUrl}/support`, { redirect: 'manual' });

    assert.equal(support.status, 200);
    assert.equal(support.url, `${baseUrl}/support`);
    assert.match(support.headers.get('content-type') || '', /^text\/html;/);
    assert.equal(support.headers.get('cache-control'), 'public, max-age=300');
    assert.match(support.headers.get('content-security-policy') || '', /default-src 'none'/);
    assert.equal(support.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(support.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(support.headers.get('x-powered-by'), null);
    const body = await support.text();
    assert.match(body, /contact@coineasy\.xyz/);
    assert.doesNotMatch(body, /account deletion|Delete EasyGo account|Delete your account/i);

    const missing = await fetch(`${baseUrl}/support/not-a-route`, { redirect: 'manual' });
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('content-type') || '', /^application\/json;/);
    const missingBody = await missing.json();
    assert.equal(missingBody.error, 'not_found');
    assert.match(missingBody.requestId, /^[A-Za-z0-9._:-]{8,128}$/);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
