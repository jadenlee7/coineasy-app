import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import pino from 'pino';
import {
  createApp,
  createLivenessHandler,
  createReadinessHandler,
  notFoundHandler,
  requestPath,
  resolveRequestId,
} from '../src/app.js';
import { createShutdown } from '../src/lib/lifecycle.js';
import { createLogger } from '../src/lib/logger.js';
import {
  verifyModerationActivationDatabaseContracts,
} from '../src/lib/moderation-readiness.js';
import {
  createNoopTelemetry,
  sanitizeSentryEvent,
  sanitizeSentryTransaction,
} from '../src/lib/telemetry.js';

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

test('readiness bypasses every moderation contract while the source gate is closed', async () => {
  let basicDatabaseChecks = 0;
  let moderationContractChecks = 0;
  const res = response();
  await createReadinessHandler({
    db: {
      async $queryRawUnsafe(query) {
        basicDatabaseChecks += 1;
        assert.equal(query, 'SELECT 1');
        return [1];
      },
    },
    env: {
      SERVICE_NAME: 'easygo-test',
      POST_MODERATION_ENABLED: 'true',
    },
    appLogger: silentLogger,
    async verifyModerationContract() {
      moderationContractChecks += 1;
      throw new Error('must not run while source gate is closed');
    },
  })({ id: 'request-gate-off-readiness' }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'ready');
  assert.equal(basicDatabaseChecks, 1);
  assert.equal(moderationContractChecks, 0);
});

test('readiness blocks future moderation activation with an incomplete contract', async () => {
  let databaseChecks = 0;
  const res = response();
  await createReadinessHandler({
    db: { async $queryRawUnsafe() { databaseChecks += 1; return [1]; } },
    env: {
      SERVICE_NAME: 'easygo-test',
      POST_MODERATION_ENABLED: 'true',
      MODERATION_POLICY_VERSION: 'unapproved',
    },
    appLogger: silentLogger,
    moderationReady: true,
  })({ id: 'request-moderation-readiness' }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.status, 'not_ready');
  assert.equal(databaseChecks, 0);
  assert.equal(JSON.stringify(res.body).includes('unapproved'), false);
});

test('readiness requires the exact moderation database contracts before activation', async () => {
  const env = {
    SERVICE_NAME: 'easygo-test',
    POST_MODERATION_ENABLED: 'true',
    MODERATION_API_KEY_HASHES_JSON: JSON.stringify({
      'reviewer-one': 'a'.repeat(64),
    }),
    MODERATION_RESPONSE_SLA_HOURS: '24',
    MODERATION_POLICY_VERSION: 'policy-v1',
    MODERATION_RETENTION_POLICY_VERSION: 'retention-v1',
    MODERATION_OWNER: 'EasyGo Trust Team',
    MODERATION_ESCALATION_CONTACT: 'trust@example.com',
  };

  let failedContractChecks = 0;
  const failed = response();
  await createReadinessHandler({
    db: {},
    env,
    appLogger: silentLogger,
    moderationReady: true,
    async verifyModerationContract() {
      failedContractChecks += 1;
      throw new Error('missing private migration details');
    },
  })({ id: 'request-moderation-db-failed' }, failed);
  assert.equal(failed.statusCode, 503);
  assert.equal(failedContractChecks, 1);
  assert.equal(JSON.stringify(failed.body).includes('private migration'), false);

  let acceptedContractChecks = 0;
  const accepted = response();
  await createReadinessHandler({
    db: {},
    env,
    appLogger: silentLogger,
    moderationReady: true,
    async verifyModerationContract() {
      acceptedContractChecks += 1;
      return true;
    },
  })({ id: 'request-moderation-db-ready' }, accepted);
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.body.status, 'ready');
  assert.equal(acceptedContractChecks, 1);
});

test('readiness default wiring requires both physical moderation contracts', async () => {
  const env = {
    SERVICE_NAME: 'easygo-test',
    POST_MODERATION_ENABLED: 'true',
    MODERATION_API_KEY_HASHES_JSON: JSON.stringify({
      'reviewer-one': 'a'.repeat(64),
    }),
    MODERATION_RESPONSE_SLA_HOURS: '24',
    MODERATION_POLICY_VERSION: 'policy-v1',
    MODERATION_RETENTION_POLICY_VERSION: 'retention-v1',
    MODERATION_OWNER: 'EasyGo Trust Team',
    MODERATION_ESCALATION_CONTACT: 'trust@example.com',
  };

  for (const [rateLimitReady, expectedStatus] of [
    [false, 503],
    [true, 200],
  ]) {
    let queueChecks = 0;
    let rateLimitChecks = 0;
    const db = {
      async $queryRawUnsafe() {
        queueChecks += 1;
        return [{ contractReady: true }];
      },
      async $transaction(callback, options) {
        assert.deepEqual(options, { maxWait: 200, timeout: 1_400 });
        let transactionQueries = 0;
        return callback({
          async $queryRawUnsafe() {
            transactionQueries += 1;
            if (transactionQueries === 1) {
              return [{
                idleTimeoutMs: 1_400,
                lockTimeoutMs: 250,
                statementTimeoutMs: 1_000,
              }];
            }
            rateLimitChecks += 1;
            return [{ contractReady: rateLimitReady }];
          },
        });
      },
    };
    const res = response();
    await createReadinessHandler({
      db,
      env,
      appLogger: silentLogger,
      moderationReady: true,
    })({ id: `request-default-wiring-${rateLimitReady}` }, res);

    assert.equal(res.statusCode, expectedStatus);
    assert.equal(queueChecks, 1);
    assert.equal(rateLimitChecks, 1);
  }
});

test('composite moderation readiness sanitizes downstream contract failures', async () => {
  const secret = `wf_${'s'.repeat(32)}`;
  const warnings = [];
  const res = response();
  await createReadinessHandler({
    db: {},
    env: {
      SERVICE_NAME: 'easygo-test',
      POST_MODERATION_ENABLED: 'true',
      MODERATION_API_KEY_HASHES_JSON: JSON.stringify({
        'reviewer-one': 'a'.repeat(64),
      }),
      MODERATION_RESPONSE_SLA_HOURS: '24',
      MODERATION_POLICY_VERSION: 'policy-v1',
      MODERATION_RETENTION_POLICY_VERSION: 'retention-v1',
      MODERATION_OWNER: 'EasyGo Trust Team',
      MODERATION_ESCALATION_CONTACT: 'trust@example.com',
    },
    appLogger: {
      warn(fields, message) { warnings.push({ fields, message }); },
    },
    moderationReady: true,
    verifyModerationContract(db) {
      return verifyModerationActivationDatabaseContracts(db, {
        async verifyQueueContract() { throw new Error(secret); },
        async verifyRateLimitContract() { return true; },
      });
    },
  })({ id: 'request-composite-contract-failed' }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(JSON.stringify(res.body).includes(secret), false);
  assert.deepEqual(warnings, [{
    fields: {
      requestId: 'request-composite-contract-failed',
      errorType: 'ModerationActivationDatabaseContractsError',
    },
    message: 'service readiness check failed',
  }]);
  assert.equal(JSON.stringify(warnings).includes(secret), false);
});

test('request IDs accept conservative values and replace unsafe input', () => {
  assert.equal(resolveRequestId('request_1234'), 'request_1234');
  assert.notEqual(resolveRequestId('bad id with spaces'), 'bad id with spaces');
  assert.match(resolveRequestId(undefined), /^[0-9a-f-]{36}$/);

  const credentialLikeId = `eg_mod_${'a'.repeat(32)}`;
  for (const candidate of [
    credentialLikeId,
    credentialLikeId.toUpperCase(),
    `prefix-${credentialLikeId}`,
    `trace:${credentialLikeId}:suffix`,
    [credentialLikeId, 'request_safe_1234'],
  ]) {
    const resolved = resolveRequestId(candidate);
    assert.notEqual(resolved, Array.isArray(candidate) ? candidate[0] : candidate);
    assert.match(
      resolved,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  }
});

test('request paths redact misplaced moderation credentials before logging', () => {
  const credential = `eg_mod_${'Z'.repeat(48)}`;
  const sanitized = requestPath(
    `/moderation/reports/${credential}/claim?request=${credential}`,
  );
  assert.equal(sanitized, '/moderation/reports/[REDACTED]/claim');
  assert.equal(sanitized.includes(credential), false);
  assert.equal(requestPath('/posts/feed?token=private'), '/posts/feed');
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
        identityToken: 'apple.identity.token',
        nonce: 'raw-apple-nonce',
        state: 'raw-apple-state',
        reauthProof: 'raw-reauth-proof',
      },
    },
    email: 'private@example.com',
    walletAddress: '0x1234567890',
    subjectHash: 'account-subject-hash',
    privyDidCiphertext: 'encrypted-provider-id',
    providerSubjectHash: 'provider-subject-hash',
    digest: 'stable-provider-digest',
    linkedAccounts: [{
      type: 'apple_oauth',
      subject: 'apple-provider-subject',
      email: 'apple-relay-private@example.com',
    }],
    stableProviderIdentities: [{
      providerIdentityHash: 'nested-stable-provider-digest',
    }],
    leaseToken: 'worker-lease-token',
    refreshToken: 'apple-refresh-token',
    sessionId: 'privy-session-id',
    proofHash: 'reauth-proof-hash',
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
    'provider-subject-hash',
    'stable-provider-digest',
    'apple-provider-subject',
    'apple-relay-private@example.com',
    'nested-stable-provider-digest',
    'worker-lease-token',
    'apple-refresh-token',
    'apple.identity.token',
    'raw-apple-nonce',
    'raw-apple-state',
    'raw-reauth-proof',
    'privy-session-id',
    'reauth-proof-hash',
  ]) {
    assert.equal(output.includes(secret), false);
  }
  assert.equal(output.includes('[REDACTED]'), true);
});

test('Sentry events discard PII and query strings before transport', () => {
  const moderationCredential = `eg_mod_${'q'.repeat(48)}`;
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
      message: `provider rejected ${moderationCredential}`,
      data: {
        url: `https://provider.example/moderation/${moderationCredential}?wallet=0x123`,
        headers: { authorization: 'secret' },
        request_body: { wallet: '0x123' },
      },
    }],
    message: `moderation failure for ${moderationCredential}`,
    exception: {
      values: [{
        type: 'Error',
        value: `unexpected key ${moderationCredential}`,
        stacktrace: { frames: [{ filename: `/tmp/${moderationCredential}.js` }] },
      }],
    },
  });

  assert.equal(event.user, undefined);
  assert.equal(event.request.url, 'https://api.easygo.example/me');
  assert.equal(event.request.headers, undefined);
  assert.equal(event.request.data, undefined);
  assert.equal(
    event.breadcrumbs[0].data.url,
    'https://provider.example/moderation/[REDACTED]',
  );
  assert.equal(JSON.stringify(event).includes(moderationCredential), false);
  assert.equal(event.message, 'moderation failure for [REDACTED]');
  assert.equal(event.breadcrumbs[0].message, 'provider rejected [REDACTED]');
  assert.equal(event.exception.values[0].value, 'unexpected key [REDACTED]');
  assert.equal(event.breadcrumbs[0].data.headers, undefined);
  assert.equal(event.breadcrumbs[0].data.request_body, undefined);
});

test('Sentry transaction and span text redact moderation credentials before transport', () => {
  const credential = `eg_mod_${'t'.repeat(48)}`;
  const transaction = sanitizeSentryTransaction({
    transaction: `POST /moderation/${credential}/decision`,
    contexts: {
      trace: { description: `fetch ${credential}` },
    },
    spans: [{
      description: `SQL comment ${credential}`,
      data: { route: `/moderation/${credential}` },
    }],
  });

  assert.equal(JSON.stringify(transaction).includes(credential), false);
  assert.equal(transaction.transaction, 'POST /moderation/[REDACTED]/decision');
  assert.equal(transaction.spans[0].description, 'SQL comment [REDACTED]');
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
