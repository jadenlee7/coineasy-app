import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDeployEnvironment } from '../scripts/preflight.js';
import { runSmoke, validateProbe, validateSmokeBaseUrl } from '../scripts/smoke.js';

function stagingEnv(overrides = {}) {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://easygo:secret@db.internal:5432/easygo',
    PRIVY_APP_ID: 'privy-app',
    PRIVY_APP_SECRET: 'privy-secret',
    SQUID_INTEGRATOR_ID: 'easygo-integrator',
    ADMIN_SECRET: 'a'.repeat(32),
    SERVICE_NAME: 'easygo-web',
    RELEASE_SHA: 'abcdef1234567890',
    EASYGO_CONSENT_VERSION: '2026-07-21',
    SIWE_AUTH_ENABLED: 'false',
    JUSTANAME_ENABLED: 'false',
    SEGMENTS_ENABLED: 'false',
    QUESTS_ENABLED: 'false',
    ADVERTISER_ADMIN_ENABLED: 'false',
    LEGACY_SOCIAL_MODE: 'active',
    SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
    BETTER_STACK_SOURCE_TOKEN: 'source-token',
    BETTER_STACK_INGESTING_HOST: 'in.logs.betterstack.com',
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_WEBHOOK_URL: 'https://api.easygo.example/telegram/webhook/value',
    TELEGRAM_WEBHOOK_SECRET: 'b'.repeat(32),
    ...overrides,
  };
}

test('a complete staging configuration passes without exposing values', () => {
  const result = validateDeployEnvironment(stagingEnv(), {
    target: 'staging',
    nodeVersion: '20.19.0',
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(JSON.stringify(result).includes('postgresql://'), false);
  assert.equal(JSON.stringify(result).includes('privy-secret'), false);
});

test('staging preflight blocks missing core secrets and accidental social retirement', () => {
  const result = validateDeployEnvironment(stagingEnv({
    DATABASE_URL: '',
    PRIVY_APP_SECRET: '',
    LEGACY_SOCIAL_MODE: 'retired',
  }), { target: 'staging' });
  const failures = result.errors.map((item) => item.failure);
  assert.equal(failures.some((message) => message.includes('DATABASE_URL')), true);
  assert.equal(failures.some((message) => message.includes('PRIVY_APP_SECRET')), true);
  assert.equal(failures.some((message) => message.includes('ALLOW_LEGACY_SOCIAL_RETIREMENT')), true);
  assert.equal(failures.some((message) => message.includes('LEGACY_SOCIAL_SUNSET_AT')), true);
});

test('enabled features require their server-only provider configuration', () => {
  const result = validateDeployEnvironment(stagingEnv({
    SEGMENTS_ENABLED: 'true',
    BASE_RPC_URL: '',
    ETHERSCAN_API_KEY: '',
  }), { target: 'staging' });
  assert.equal(result.errors.some((item) => item.failure.includes('BASE_RPC_URL')), true);
  assert.equal(result.errors.some((item) => item.failure.includes('ETHERSCAN_API_KEY')), true);
});

test('partial Better Stack configuration and malformed flags fail closed', () => {
  const result = validateDeployEnvironment(stagingEnv({
    BETTER_STACK_INGESTING_HOST: '',
    QUESTS_ENABLED: 'sometimes',
  }), { target: 'staging' });
  assert.equal(result.errors.some((item) => item.name === 'Better Stack configuration pair'), true);
  assert.equal(result.errors.some((item) => item.name === 'QUESTS_ENABLED syntax'), true);
});

test('smoke targets require HTTPS except for loopback development', () => {
  assert.equal(validateSmokeBaseUrl('http://127.0.0.1:3000').origin, 'http://127.0.0.1:3000');
  assert.throws(() => validateSmokeBaseUrl('http://api.easygo.example'), /HTTPS/);
  assert.equal(validateSmokeBaseUrl('https://api.easygo.example/path?secret=value').search, '');
});

test('probe validation enforces readiness, active social mode, and request correlation', () => {
  assert.doesNotThrow(() => validateProbe({
    path: '/ready',
    status: 200,
    body: { status: 'ready', release: 'abc' },
    requestId: 'smoke-request',
    expectedRelease: 'abc',
  }));
  assert.throws(() => validateProbe({
    path: '/social/status',
    status: 200,
    body: { mode: 'retired' },
    requestId: 'smoke-request',
  }), /expected active/);
  assert.throws(() => validateProbe({
    path: '/health',
    status: 200,
    body: { status: 'alive' },
    requestId: '',
  }), /X-Request-Id/);
});

test('read-only smoke checks liveness, readiness, and social capability', async () => {
  const bodies = {
    '/health': { status: 'alive', release: 'abc' },
    '/ready': { status: 'ready', release: 'abc' },
    '/social/status': { mode: 'active' },
  };
  const fetchImpl = async (url) => ({
    status: 200,
    headers: { get(name) { return name === 'x-request-id' ? 'smoke-request' : null; } },
    async json() { return bodies[url.pathname]; },
  });

  const result = await runSmoke({
    baseUrl: 'https://api.easygo.example',
    expectedRelease: 'abc',
    fetchImpl,
  });
  assert.deepEqual(result.results.map((item) => item.path), [
    '/health',
    '/ready',
    '/social/status',
  ]);
});
