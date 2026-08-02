import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import pino from 'pino';
import {
  createApp,
  createLivenessHandler,
  createReadinessHandler,
  notFoundHandler,
  resolveRequestId,
} from '../src/app.js';
import { createShutdown } from '../src/lib/lifecycle.js';
import { createLogger } from '../src/lib/logger.js';
import { createNoopTelemetry, sanitizeSentryEvent } from '../src/lib/telemetry.js';

const silentLogger = pino({ level: 'silent' });

test('deployment contracts launch Node directly so lifecycle signals reach the app', () => {
  const web = JSON.parse(readFileSync(
    new URL('../railway.web.json', import.meta.url),
    'utf8',
  ));
  const worker = JSON.parse(readFileSync(
    new URL('../railway.worker.json', import.meta.url),
    'utf8',
  ));
  const procfile = readFileSync(new URL('../Procfile', import.meta.url), 'utf8');

  assert.equal(web.deploy.startCommand, 'node src/index.js');
  assert.equal(worker.deploy.startCommand, 'node src/worker.js');
  assert.match(procfile, /^web: node src\/index\.js$/m);
  assert.match(procfile, /^worker: node src\/worker\.js$/m);
  assert.equal(procfile.includes('npm '), false);
});

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('application assembly stays separate from network startup', () => {
  const app = createApp({
    db: { async $queryRawUnsafe() { return [1]; } },
    env: { LEGACY_SOCIAL_MODE: 'active' },
    appLogger: silentLogger,
    telemetry: createNoopTelemetry(),
  });
  const directRoutes = app._router.stack
    .map((layer) => layer.route?.path)
    .filter(Boolean);
  const middlewareNames = app._router.stack.map((layer) => layer.name);
  assert.equal(app.enabled('x-powered-by'), false);
  assert.equal(
    middlewareNames.indexOf('loggingMiddleware') < middlewareNames.indexOf('jsonParser'),
    true,
  );
  assert.equal(directRoutes.includes('/health'), true);
  assert.equal(directRoutes.includes('/ready'), true);
});

test('liveness, readiness, request IDs, and unknown routes expose stable contracts', async () => {
  const db = { async $queryRawUnsafe(query) { assert.equal(query, 'SELECT 1'); return [1]; } };
  const env = { SERVICE_NAME: 'easygo-test', RELEASE_SHA: 'test-release' };
  const live = response();
  createLivenessHandler({ env })({}, live);
  assert.equal(live.statusCode, 200);
  assert.equal(live.headers['cache-control'], 'no-store');
  assert.deepEqual(
    Object.fromEntries(Object.entries(live.body).filter(([key]) => key !== 'uptimeSeconds')),
    {
      ok: true,
      status: 'alive',
      service: 'easygo-test',
      phase: 1,
      release: 'test-release',
    },
  );

  const ready = response();
  await createReadinessHandler({ db, env, appLogger: silentLogger })({ id: 'request-1' }, ready);
  assert.equal(ready.statusCode, 200);
  assert.equal(ready.body.status, 'ready');

  const missing = response();
  notFoundHandler({ id: 'request-2' }, missing);
  assert.equal(missing.statusCode, 404);
  assert.deepEqual(missing.body, { error: 'not_found', requestId: 'request-2' });
});

test('readiness fails closed without exposing database errors', async () => {
  const db = { async $queryRawUnsafe() { throw new Error('postgres://secret-host/private'); } };
  const res = response();
  await createReadinessHandler({
    db,
    env: { SERVICE_NAME: 'easygo-test', READINESS_TIMEOUT_MS: '100' },
    appLogger: silentLogger,
  })({ id: 'request-3' }, res);
  const rawBody = JSON.stringify(res.body);
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers['retry-after'], '5');
  assert.equal(rawBody.includes('secret-host'), false);
  assert.equal(res.body.status, 'not_ready');
});

test('request IDs accept conservative values and replace unsafe input', () => {
  assert.equal(resolveRequestId('request_1234'), 'request_1234');
  assert.notEqual(resolveRequestId('bad id with spaces'), 'bad id with spaces');
  assert.match(resolveRequestId(undefined), /^[0-9a-f-]{36}$/);
});

test('logger redacts authentication, signatures, identity, and wallet fields', () => {
  const chunks = [];
  const log = createLogger({
    env: { NODE_ENV: 'production', LOG_LEVEL: 'info' },
    destination: { write(chunk) { chunks.push(String(chunk)); } },
  });

  log.info({
    req: {
      headers: {
        authorization: 'Bearer super-secret',
        cookie: 'session=cookie-secret',
        'x-admin-secret': 'server-admin-value',
      },
      body: {
        signature: 'wallet-signature',
        answer: 'quiz-answer',
        expectedPrivyDid: 'did:privy:expected-owner',
      },
    },
    email: 'private@example.com',
    walletAddress: '0x1234567890',
    subjectHash: 'account-subject-hash',
    privyDidCiphertext: 'encrypted-provider-id',
  }, 'redaction test');

  const output = chunks.join('');
  for (const secret of [
    'super-secret',
    'cookie-secret',
    'server-admin-value',
    'wallet-signature',
    'quiz-answer',
    'did:privy:expected-owner',
    'private@example.com',
    '0x1234567890',
    'account-subject-hash',
    'encrypted-provider-id',
  ]) {
    assert.equal(output.includes(secret), false);
  }
  assert.equal(output.includes('[REDACTED]'), true);
});

test('Sentry events discard PII and query strings before transport', () => {
  const event = sanitizeSentryEvent({
    user: { email: 'private@example.com' },
    request: {
      url: 'https://api.easygo.example/me?email=private%40example.com',
      headers: { authorization: 'Bearer secret' },
      cookies: { session: 'secret' },
      data: { signature: 'secret' },
      query_string: 'email=private%40example.com',
    },
    breadcrumbs: [{
      data: {
        url: 'https://provider.example/read?wallet=0x123',
        headers: { authorization: 'secret' },
        request_body: { wallet: '0x123' },
      },
    }],
  });

  assert.equal(event.user, undefined);
  assert.equal(event.request.url, 'https://api.easygo.example/me');
  assert.equal(event.request.headers, undefined);
  assert.equal(event.request.data, undefined);
  assert.equal(event.breadcrumbs[0].data.url, 'https://provider.example/read');
  assert.equal(event.breadcrumbs[0].data.headers, undefined);
  assert.equal(event.breadcrumbs[0].data.request_body, undefined);
});

test('shutdown stops intake once and cleans bot, database, and telemetry', async () => {
  const calls = [];
  const server = {
    listening: true,
    close(callback) {
      this.listening = false;
      queueMicrotask(() => callback());
    },
    closeIdleConnections() { calls.push('idle-connections'); },
  };
  const processRef = { exitCode: 0 };
  const shutdown = createShutdown({
    server,
    db: { async $disconnect() { calls.push('database'); } },
    telemetry: {
      captureException() {},
      async close() { calls.push('telemetry'); return true; },
    },
    async stopBot() { calls.push('telegram'); },
    appLogger: silentLogger,
    processRef,
    timeoutMs: 1_000,
  });

  const first = shutdown({ reason: 'test' });
  const second = shutdown({ reason: 'duplicate' });
  assert.equal(first, second);
  await first;
  assert.deepEqual(
    calls.filter((item) => item !== 'idle-connections').sort(),
    ['database', 'telegram', 'telemetry'],
  );
  assert.equal(processRef.exitCode, 0);
  assert.equal(server.listening, false);
});
