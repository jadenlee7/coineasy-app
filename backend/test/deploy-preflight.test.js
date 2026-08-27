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
    EASYGO_CONSENT_VERSION: '2026-08-10-staging-v1',
    ACCOUNT_DELETION_SUBJECT_HMAC_KEY: 'h'.repeat(32),
    ACCOUNT_DELETION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    SIWE_AUTH_ENABLED: 'false',
    JUSTANAME_ENABLED: 'false',
    SEGMENTS_ENABLED: 'false',
    QUESTS_ENABLED: 'false',
    ADVERTISER_ADMIN_ENABLED: 'false',
    SWAP_EXECUTION_ENABLED: 'false',
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

test('staging consent version must match the bundled documents and grants stay review-locked', () => {
  const mismatch = validateDeployEnvironment(stagingEnv({
    EASYGO_CONSENT_VERSION: '2026-07-21-staging-v1',
  }), { target: 'staging' });
  assert.equal(
    mismatch.errors.some((item) => item.name === 'consent document version alignment'),
    true,
  );

  const unapproved = validateDeployEnvironment(stagingEnv({
    CONSENT_GRANTS_ENABLED: 'true',
  }), { target: 'staging' });
  assert.equal(
    unapproved.errors.some((item) => item.name === 'legal document approval'),
    true,
  );
});

test('push-token registration cannot activate before a matching privacy release', () => {
  const result = validateDeployEnvironment(stagingEnv({
    PUSH_TOKEN_REGISTRATION_ENABLED: 'true',
  }), { target: 'staging' });
  assert.equal(
    result.errors.some((item) => item.name === 'push-token registration approval'),
    true,
  );
});

test('legacy swap execution cannot activate before execution and reward verification', () => {
  const result = validateDeployEnvironment(stagingEnv({
    SWAP_EXECUTION_ENABLED: 'true',
  }), { target: 'staging' });
  assert.equal(
    result.errors.some((item) => item.name === 'swap execution approval'),
    true,
  );

  const malformed = validateDeployEnvironment(stagingEnv({
    SWAP_EXECUTION_ENABLED: 'yes',
  }), { target: 'staging' });
  assert.equal(
    malformed.errors.some((item) => item.name === 'SWAP_EXECUTION_ENABLED syntax'),
    true,
  );
});

test('account deletion cannot activate before worker, marker, and recent auth ship', () => {
  const missing = validateDeployEnvironment(stagingEnv({
    ACCOUNT_DELETION_ENABLED: 'true',
    ACCOUNT_DELETION_PROVIDER_CLEANUP_ENABLED: 'false',
    ACCOUNT_DELETION_RECENT_AUTH_ENABLED: 'false',
    ACCOUNT_DELETION_SUBJECT_HMAC_KEY: '',
    ACCOUNT_DELETION_ENCRYPTION_KEY: '',
  }), { target: 'staging' });
  assert.equal(
    missing.errors.some((item) => item.failure.includes('ACCOUNT_DELETION_SUBJECT_HMAC_KEY')),
    true,
  );
  assert.equal(
    missing.errors.some((item) => item.name === 'account deletion provider cleanup'),
    true,
  );
  assert.equal(
    missing.errors.some((item) => item.name === 'account deletion recent authentication'),
    true,
  );

  const otherwiseComplete = validateDeployEnvironment(stagingEnv({
    ACCOUNT_DELETION_ENABLED: 'true',
    ACCOUNT_DELETION_PROVIDER_CLEANUP_ENABLED: 'true',
    ACCOUNT_DELETION_RECENT_AUTH_ENABLED: 'true',
    ACCOUNT_DELETION_SUBJECT_HMAC_KEY: 'h'.repeat(32),
    ACCOUNT_DELETION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    ACCOUNT_DELETION_APPLE_REVOCATION_MODE: 'privy_confirmed',
  }), { target: 'staging' });
  assert.equal(
    otherwiseComplete.errors.some(
      (item) => item.name === 'account deletion implementation readiness',
    ),
    true,
  );
  assert.equal(
    otherwiseComplete.errors.some(
      (item) => item.name === 'account deletion provider implementation readiness',
    ),
    true,
  );
  assert.equal(
    otherwiseComplete.errors.some(
      (item) => item.name === 'account deletion stable identity readiness',
    ),
    true,
  );
  assert.equal(
    otherwiseComplete.errors.some(
      (item) => item.name === 'account deletion recent authentication readiness',
    ),
    true,
  );
});

test('partial Better Stack configuration and malformed flags fail closed', () => {
  const result = validateDeployEnvironment(stagingEnv({
    BETTER_STACK_INGESTING_HOST: '',
    QUESTS_ENABLED: 'sometimes',
  }), { target: 'staging' });
  assert.equal(result.errors.some((item) => item.name === 'Better Stack configuration pair'), true);
  assert.equal(result.errors.some((item) => item.name === 'QUESTS_ENABLED syntax'), true);
});

test('moderation preflight uses the exact runtime escalation URL contract', () => {
  const result = validateDeployEnvironment(stagingEnv({
    POST_MODERATION_ENABLED: 'true',
    MODERATION_API_KEY_HASHES_JSON: JSON.stringify({
      'reviewer-one': 'a'.repeat(64),
    }),
    MODERATION_RESPONSE_SLA_HOURS: '24',
    MODERATION_POLICY_VERSION: 'policy-v1',
    MODERATION_RETENTION_POLICY_VERSION: 'retention-v1',
    MODERATION_OWNER: 'EasyGo Trust Team',
    MODERATION_ESCALATION_CONTACT: 'https://user:secret@example.com/escalate',
  }), { target: 'staging' });

  assert.equal(
    result.errors.some(({ name }) => name === 'moderation runtime contract parity'),
    true,
  );
  assert.equal(JSON.stringify(result).includes('user:secret'), false);
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
  assert.throws(() => validateProbe({
    path: '/health',
    status: 200,
    body: { status: 'alive' },
    requestId: 'smoke-request',
    expectedRelease: 'abc',
  }), /release does not match/);
  assert.throws(() => validateProbe({
    path: '/ready',
    status: 200,
    body: { status: 'ready', release: 'different' },
    requestId: 'smoke-request',
    expectedRelease: 'abc',
  }), /release does not match/);
  assert.doesNotThrow(() => validateProbe({
    path: '/social/status',
    status: 200,
    body: { mode: 'active' },
    requestId: 'smoke-request',
    expectedRelease: 'abc',
  }));
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
