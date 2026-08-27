import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ModerationWorkforceOidcConfigError,
  ModerationWorkforceOidcTokenError,
  ModerationWorkforceOidcUnavailableError,
} from '../src/lib/moderation-workforce-oidc.js';
import { MODERATION_CAPABILITIES } from '../src/lib/moderation-principal.js';
import {
  createModerationWorkforceAuth,
  ModerationWorkforceAccessConfigError,
  ModerationWorkforceAccessUnavailableError,
} from '../src/middleware/moderation-workforce-auth.js';

const NOW_SECONDS = 1_800_000_000;
const NOW = () => NOW_SECONDS * 1_000;
const TOKEN = 'aaa.bbb.ccc';
const SUBJECT = 'provider-private-subject';
const ACTOR_ID = `wf_${'a'.repeat(32)}`;

function identity(overrides = {}) {
  return Object.freeze({
    expiresAt: NOW_SECONDS + 600,
    issuedAt: NOW_SECONDS - 60,
    issuer: 'https://identity.example.test/moderation',
    mfaAuthenticatedAt: NOW_SECONDS - 120,
    mfaVerified: true,
    roleIds: Object.freeze(['moderation-reviewer']),
    subject: SUBJECT,
    ...overrides,
  });
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function authenticate({
  authorization = `Bearer ${TOKEN}`,
  dependencyTimeoutMs,
  log,
  now = NOW,
  resolveAccess = async () => ({
    actorId: ACTOR_ID,
    capabilities: [MODERATION_CAPABILITIES.QUEUE_READ],
  }),
  verifyToken = async () => identity(),
} = {}) {
  const middleware = createModerationWorkforceAuth({
    now,
    resolveAccess,
    verifyToken,
    ...(dependencyTimeoutMs === undefined ? {} : { dependencyTimeoutMs }),
  });
  const req = {
    headers: authorization === null ? {} : { authorization },
    ...(log ? { log } : {}),
  };
  const res = response();
  let nextCalls = 0;
  await middleware(req, res, () => { nextCalls += 1; });
  return { nextCalls, req, res };
}

test('maps a verified identity through server-owned access into a strict principal', async () => {
  const calls = [];
  const result = await authenticate({
    verifyToken: async (token, { signal }) => {
      calls.push(['verify', token]);
      assert.equal(signal instanceof AbortSignal, true);
      assert.equal(signal.aborted, false);
      return identity();
    },
    resolveAccess: async (mappingInput, { signal }) => {
      calls.push(['resolve', mappingInput]);
      assert.equal(Object.isFrozen(mappingInput), true);
      assert.equal(signal instanceof AbortSignal, true);
      assert.equal(signal.aborted, false);
      return {
        actorId: ACTOR_ID,
        capabilities: [
          MODERATION_CAPABILITIES.REPORT_CLAIM,
          MODERATION_CAPABILITIES.QUEUE_READ,
        ],
      };
    },
  });

  assert.equal(result.nextCalls, 1);
  assert.equal(result.res.statusCode, 200);
  assert.equal(Object.isFrozen(result.req.moderator), true);
  assert.deepEqual(result.req.moderator.capabilities, [
    MODERATION_CAPABILITIES.QUEUE_READ,
    MODERATION_CAPABILITIES.REPORT_CLAIM,
  ]);
  assert.deepEqual(calls, [
    ['verify', TOKEN],
    ['resolve', {
      issuer: 'https://identity.example.test/moderation',
      roleIds: ['moderation-reviewer'],
      subject: SUBJECT,
    }],
  ]);
  const attached = JSON.stringify(result.req.moderator);
  assert.equal(attached.includes(TOKEN), false);
  assert.equal(attached.includes(SUBJECT), false);
  assert.equal(Object.hasOwn(result.req.moderator, 'roleIds'), false);
});

test('rejects missing, malformed, and oversized bearer credentials before verification', async () => {
  let verifyCalls = 0;
  let accessCalls = 0;
  const verifyToken = async () => { verifyCalls += 1; return identity(); };
  const resolveAccess = async () => {
    accessCalls += 1;
    return { actorId: ACTOR_ID, capabilities: [] };
  };
  for (const authorization of [
    null,
    '',
    'Basic aaa.bbb.ccc',
    'Bearer',
    'Bearer aaa.bbb.ccc extra',
    `Bearer ${'a'.repeat(16 * 1_024 + 1)}`,
  ]) {
    const { req, res, nextCalls } = await authenticate({
      authorization,
      resolveAccess,
      verifyToken,
    });
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'invalid_moderation_identity' });
    assert.equal(nextCalls, 0);
    assert.equal(req.moderator, undefined);
  }
  assert.equal(verifyCalls, 0);
  assert.equal(accessCalls, 0);
});

test('preserves generic 401, 403, and configuration 503 boundaries', async () => {
  const invalidToken = await authenticate({
    verifyToken: async () => { throw new ModerationWorkforceOidcTokenError(); },
  });
  assert.equal(invalidToken.res.statusCode, 401);
  assert.deepEqual(invalidToken.res.body, { error: 'invalid_moderation_identity' });

  const oidcConfig = await authenticate({
    verifyToken: async () => { throw new ModerationWorkforceOidcConfigError(); },
  });
  assert.equal(oidcConfig.res.statusCode, 503);
  assert.deepEqual(oidcConfig.res.body, { error: 'moderation_auth_unconfigured' });

  const offboarded = await authenticate({ resolveAccess: async () => null });
  assert.equal(offboarded.res.statusCode, 403);
  assert.deepEqual(offboarded.res.body, { error: 'moderation_forbidden' });

  for (const resolveAccess of [
    async () => { throw new ModerationWorkforceAccessConfigError(); },
    async () => ({ actorId: ACTOR_ID }),
    async () => ({
      actorId: 'raw-provider-subject',
      capabilities: [MODERATION_CAPABILITIES.QUEUE_READ],
    }),
    async () => ({
      actorId: ACTOR_ID,
      capabilities: ['wildcard.admin'],
    }),
  ]) {
    const result = await authenticate({ resolveAccess });
    assert.equal(result.res.statusCode, 503);
    assert.deepEqual(result.res.body, { error: 'moderation_auth_unconfigured' });
    assert.equal(result.nextCalls, 0);
  }
});

test('provider and access outages log bounded metadata without identity material', async () => {
  class WorkforceDirectoryFailure extends Error {
    constructor(message) {
      super(message);
      this.name = SUBJECT;
    }
  }
  const secret = `${TOKEN} ${SUBJECT} raw-role`;
  const cases = [
    {
      verifyToken: async () => { throw new ModerationWorkforceOidcUnavailableError(); },
      expectedType: 'ModerationWorkforceOidcUnavailableError',
    },
    {
      resolveAccess: async () => { throw new ModerationWorkforceAccessUnavailableError(); },
      expectedType: 'ModerationWorkforceAccessUnavailableError',
    },
    {
      resolveAccess: async () => { throw new WorkforceDirectoryFailure(secret); },
      expectedType: 'ModerationWorkforceDependencyError',
    },
  ];

  for (const current of cases) {
    const logCalls = [];
    const result = await authenticate({
      ...current,
      log: { error: (...args) => logCalls.push(args) },
    });
    assert.equal(result.res.statusCode, 503);
    assert.deepEqual(result.res.body, { error: 'moderation_auth_unavailable' });
    assert.equal(result.nextCalls, 0);
    assert.deepEqual(logCalls, [[
      { errorType: current.expectedType },
      'moderation workforce authentication failed',
    ]]);
    assert.equal(JSON.stringify({ body: result.res.body, logCalls }).includes(secret), false);
    assert.equal(JSON.stringify({ body: result.res.body, logCalls }).includes(TOKEN), false);
    assert.equal(JSON.stringify({ body: result.res.body, logCalls }).includes(SUBJECT), false);
  }
});

test('aborts and fails closed when the access resolver does not settle', async () => {
  let observedSignal;
  const result = await authenticate({
    dependencyTimeoutMs: 10,
    resolveAccess: async (_input, { signal }) => {
      observedSignal = signal;
      return new Promise(() => {});
    },
  });

  assert.equal(observedSignal instanceof AbortSignal, true);
  assert.equal(observedSignal.aborted, true);
  assert.equal(result.res.statusCode, 503);
  assert.deepEqual(result.res.body, { error: 'moderation_auth_unavailable' });
  assert.equal(result.nextCalls, 0);
});

test('aborts and fails closed when token verification does not settle', async () => {
  let observedSignal;
  let accessCalls = 0;
  const result = await authenticate({
    dependencyTimeoutMs: 10,
    verifyToken: async (_token, { signal }) => {
      observedSignal = signal;
      return new Promise(() => {});
    },
    resolveAccess: async () => {
      accessCalls += 1;
      return { actorId: ACTOR_ID, capabilities: [] };
    },
  });

  assert.equal(observedSignal instanceof AbortSignal, true);
  assert.equal(observedSignal.aborted, true);
  assert.equal(result.res.statusCode, 503);
  assert.deepEqual(result.res.body, { error: 'moderation_auth_unavailable' });
  assert.equal(result.nextCalls, 0);
  assert.equal(accessCalls, 0);
});

test('rejects malformed verifier output before access resolution', async () => {
  let accessCalls = 0;
  const result = await authenticate({
    verifyToken: async () => ({
      ...identity(),
      rawToken: TOKEN,
    }),
    resolveAccess: async () => {
      accessCalls += 1;
      return { actorId: ACTOR_ID, capabilities: [] };
    },
  });
  assert.equal(result.res.statusCode, 503);
  assert.deepEqual(result.res.body, { error: 'moderation_auth_unconfigured' });
  assert.equal(accessCalls, 0);
  assert.equal(result.req.moderator, undefined);
});

test('a logger failure cannot make workforce authentication fail open', async () => {
  const result = await authenticate({
    log: { error() { throw new Error('logger unavailable'); } },
    verifyToken: async () => { throw new Error('provider unavailable'); },
  });
  assert.equal(result.res.statusCode, 503);
  assert.deepEqual(result.res.body, { error: 'moderation_auth_unavailable' });
  assert.equal(result.nextCalls, 0);
  assert.equal(result.req.moderator, undefined);
});

test('factory dependencies are mandatory', () => {
  for (const options of [
    {},
    { resolveAccess: async () => null, verifyToken: async () => identity(), now: null },
    { resolveAccess: null, verifyToken: async () => identity() },
    { resolveAccess: async () => null, verifyToken: null },
    {
      dependencyTimeoutMs: 0,
      resolveAccess: async () => null,
      verifyToken: async () => identity(),
    },
  ]) {
    assert.throws(() => createModerationWorkforceAuth(options), TypeError);
  }
});
