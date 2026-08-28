import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MODERATION_CAPABILITIES,
} from '../src/lib/moderation-principal.js';
import {
  bindModerationRateLimitConsumerDeadline,
  MODERATION_RATE_LIMIT_DEPENDENCY_TIMEOUT_DEFAULT_MS,
} from '../src/lib/moderation-rate-limit-deadline.js';
import {
  createDormantModerationRuntime,
} from '../src/lib/moderation-runtime.js';
import { createModerationRouter } from '../src/routes/moderation.js';

const ACTOR_ID = `wf_${'c'.repeat(32)}`;
const NOW_MS = Date.parse('2026-08-28T12:00:00.000Z');
const NOW_SECONDS = Math.floor(NOW_MS / 1_000);
const ROLE_ID = 'easygo-trust-reviewer';
const SUBJECT = 'private-workforce-subject';
const TOKEN = 'private.workforce.token';

function boundConsumer(consume) {
  return bindModerationRateLimitConsumerDeadline(
    consume,
    MODERATION_RATE_LIMIT_DEPENDENCY_TIMEOUT_DEFAULT_MS,
  );
}

function identity() {
  return {
    expiresAt: NOW_SECONDS + 600,
    issuedAt: NOW_SECONDS - 60,
    issuer: 'https://identity.example.com',
    mfaAuthenticatedAt: NOW_SECONDS - 90,
    mfaVerified: true,
    roleIds: [ROLE_ID],
    subject: SUBJECT,
  };
}

function dependencies(overrides = {}) {
  return {
    consumeRateLimit: boundConsumer(async () => ({ allowed: true })),
    now: () => NOW_MS,
    resolveAccess: async () => ({
      actorId: ACTOR_ID,
      capabilities: Object.values(MODERATION_CAPABILITIES),
    }),
    verifyToken: async () => identity(),
    ...overrides,
  };
}

function findRoute(router, method, path) {
  const layer = router.stack.find((candidate) => (
    candidate.route?.path === path && candidate.route.methods[method.toLowerCase()]
  ));
  assert.ok(layer, `${method} ${path} route must exist`);
  return layer.route.stack.map(({ handle }) => handle);
}

async function invokeRoute(router, {
  method = 'GET',
  path = '/reports',
  query = {},
  params = {},
  body = {},
  headers = {},
} = {}) {
  const handlers = findRoute(router, method, path);
  let index = 0;
  let nextError;
  let settled = false;
  let resolveDone;
  let rejectDone;
  const done = new Promise((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });
  function finish() {
    if (settled) return;
    settled = true;
    resolveDone();
  }
  const req = {
    body,
    headers,
    id: 'request-runtime-composition',
    params,
    query,
  };
  const res = {
    body: null,
    headers: {},
    statusCode: 200,
    set(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      finish();
      return this;
    },
  };
  function next(error) {
    if (error) {
      nextError = error;
      finish();
      return;
    }
    const handler = handlers[index];
    index += 1;
    if (!handler) {
      finish();
      return;
    }
    try {
      Promise.resolve(handler(req, res, next)).catch(rejectDone);
    } catch (handlerError) {
      next(handlerError);
    }
  }
  next();
  await done;
  return { nextError, req, res };
}

function router(runtime, { enabled = true, service } = {}) {
  return createModerationRouter({
    db: {},
    env: {},
    phaseConfig: { POST_MODERATION_ENABLED: enabled },
    service,
    ...runtime,
  });
}

test('composition is exact, frozen, and performs no dependency work at construction', () => {
  const calls = [];
  const runtime = createDormantModerationRuntime(dependencies({
    consumeRateLimit: boundConsumer(async () => {
      calls.push('rate');
      return { allowed: true };
    }),
    now: () => {
      calls.push('now');
      return NOW_MS;
    },
    resolveAccess: async () => {
      calls.push('access');
      return null;
    },
    verifyToken: async () => {
      calls.push('verify');
      return identity();
    },
  }));

  assert.deepEqual(Object.keys(runtime).sort(), ['authenticate', 'authorize', 'limit']);
  assert.equal(Object.isFrozen(runtime), true);
  assert.deepEqual(calls, []);
});

test('composition rejects missing, unknown, accessor, and deadline-unsafe dependencies', () => {
  for (const required of ['consumeRateLimit', 'resolveAccess', 'verifyToken']) {
    const value = dependencies();
    delete value[required];
    assert.throws(() => createDormantModerationRuntime(value), TypeError);
  }
  assert.throws(
    () => createDormantModerationRuntime({ ...dependencies(), provider: 'unapproved' }),
    TypeError,
  );
  const symbolOptions = dependencies();
  symbolOptions[Symbol('identity')] = true;
  assert.throws(() => createDormantModerationRuntime(symbolOptions), TypeError);

  let getterCalls = 0;
  const accessorOptions = dependencies();
  Object.defineProperty(accessorOptions, 'verifyToken', {
    configurable: true,
    enumerable: true,
    get() {
      getterCalls += 1;
      return async () => identity();
    },
  });
  assert.throws(() => createDormantModerationRuntime(accessorOptions), TypeError);
  assert.equal(getterCalls, 0);

  assert.throws(() => createDormantModerationRuntime(dependencies({
    consumeRateLimit: async () => ({ allowed: true }),
  })), TypeError);
  for (const consumeRateLimit of [undefined, null, 123]) {
    assert.throws(() => createDormantModerationRuntime(dependencies({
      consumeRateLimit,
    })), TypeError);
  }
  assert.throws(() => createDormantModerationRuntime(dependencies({
    rateLimitDependencyTimeoutMs:
      MODERATION_RATE_LIMIT_DEPENDENCY_TIMEOUT_DEFAULT_MS - 1,
  })), TypeError);
  assert.throws(() => createDormantModerationRuntime(dependencies({ now: null })), TypeError);
  assert.throws(() => createDormantModerationRuntime(dependencies({ now: undefined })), TypeError);
});

test('closed gate performs zero workforce, rate, and service dependency calls', async () => {
  const calls = [];
  const runtime = createDormantModerationRuntime(dependencies({
    consumeRateLimit: boundConsumer(async () => {
      calls.push('rate');
      return { allowed: true };
    }),
    resolveAccess: async () => {
      calls.push('access');
      return null;
    },
    verifyToken: async () => {
      calls.push('verify');
      return identity();
    },
  }));
  const service = {
    claim: async () => { calls.push('service'); },
    decide: async () => { calls.push('service'); },
    list: async () => { calls.push('service'); },
  };
  const closed = router(runtime, { enabled: false, service });

  for (const route of [
    { method: 'GET', path: '/reports' },
    {
      body: { expectedVersion: 0 },
      method: 'POST',
      params: { reportId: 'report-claim' },
      path: '/reports/:reportId/claim',
    },
    {
      body: { decision: 'REMOVE_POST', expectedPostRevision: 0, expectedVersion: 1 },
      method: 'POST',
      params: { reportId: 'report-decision' },
      path: '/reports/:reportId/decision',
    },
  ]) {
    const { res } = await invokeRoute(closed, {
      ...route,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { error: 'not_found' });
    assert.equal(res.headers['cache-control'], 'no-store');
  }
  assert.deepEqual(calls, []);
});

test('enabled composition authenticates, authorizes, limits opaque actor, then calls service', async () => {
  const events = [];
  const downstream = [];
  const runtime = createDormantModerationRuntime(dependencies({
    consumeRateLimit: boundConsumer(async (input, options) => {
      events.push('rate');
      assert.equal(options.signal instanceof AbortSignal, true);
      downstream.push(input);
      return { allowed: true };
    }),
    resolveAccess: async (input, options) => {
      events.push('access');
      assert.deepEqual(input, {
        issuer: 'https://identity.example.com',
        roleIds: [ROLE_ID],
        subject: SUBJECT,
      });
      assert.equal(options.signal instanceof AbortSignal, true);
      return {
        actorId: ACTOR_ID,
        capabilities: [MODERATION_CAPABILITIES.QUEUE_READ],
      };
    },
    verifyToken: async (token, options) => {
      events.push('verify');
      assert.equal(token, TOKEN);
      assert.equal(options.signal instanceof AbortSignal, true);
      return identity();
    },
  }));
  const composed = router(runtime, {
    service: {
      async list(actorId, query) {
        events.push('service');
        downstream.push({ actorId, query });
        return { nextCursor: null, reports: [] };
      },
    },
  });
  const { res } = await invokeRoute(composed, {
    headers: { authorization: `Bearer ${TOKEN}` },
    query: { limit: '10' },
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { nextCursor: null, reports: [] });
  assert.deepEqual(events, ['verify', 'access', 'rate', 'service']);
  assert.deepEqual(downstream, [
    { actorId: ACTOR_ID, scopes: [MODERATION_CAPABILITIES.QUEUE_READ] },
    { actorId: ACTOR_ID, query: { limit: '10' } },
  ]);
  const serialized = JSON.stringify(downstream);
  for (const privateValue of [TOKEN, SUBJECT, ROLE_ID]) {
    assert.equal(serialized.includes(privateValue), false);
  }
});

test('authorization and compound actor limits remain fail-closed in composition', async () => {
  let rateCalls = 0;
  let serviceCalls = 0;
  const forbiddenRuntime = createDormantModerationRuntime(dependencies({
    consumeRateLimit: boundConsumer(async () => {
      rateCalls += 1;
      return { allowed: true };
    }),
    resolveAccess: async () => ({
      actorId: ACTOR_ID,
      capabilities: [MODERATION_CAPABILITIES.REPORT_CLAIM],
    }),
  }));
  const forbidden = await invokeRoute(router(forbiddenRuntime, {
    service: { list: async () => { serviceCalls += 1; } },
  }), { headers: { authorization: `Bearer ${TOKEN}` } });
  assert.equal(forbidden.res.statusCode, 403);
  assert.deepEqual(forbidden.res.body, { error: 'moderation_forbidden' });
  assert.equal(rateCalls, 0);
  assert.equal(serviceCalls, 0);

  let consumed;
  const compoundRuntime = createDormantModerationRuntime(dependencies({
    consumeRateLimit: boundConsumer(async (input) => {
      consumed = input;
      return { allowed: true };
    }),
  }));
  const decided = await invokeRoute(router(compoundRuntime, {
    service: {
      async decide() {
        serviceCalls += 1;
        return { report: { id: 'report-remove', status: 'ACTIONED' } };
      },
    },
  }), {
    body: { decision: 'REMOVE_POST', expectedPostRevision: 0, expectedVersion: 1 },
    headers: { authorization: `Bearer ${TOKEN}` },
    method: 'POST',
    params: { reportId: 'report-remove' },
    path: '/reports/:reportId/decision',
  });
  assert.equal(decided.res.statusCode, 200);
  assert.deepEqual(consumed, {
    actorId: ACTOR_ID,
    scopes: [
      MODERATION_CAPABILITIES.CONTENT_REMOVE,
      MODERATION_CAPABILITIES.REPORT_DECIDE,
    ],
  });
});

test('authentication and rate denial stop before the service boundary', async () => {
  let verifyCalls = 0;
  let accessCalls = 0;
  let rateCalls = 0;
  let serviceCalls = 0;
  const runtime = createDormantModerationRuntime(dependencies({
    consumeRateLimit: boundConsumer(async () => {
      rateCalls += 1;
      return { allowed: false, retryAfterSeconds: 17 };
    }),
    resolveAccess: async () => {
      accessCalls += 1;
      return {
        actorId: ACTOR_ID,
        capabilities: [MODERATION_CAPABILITIES.QUEUE_READ],
      };
    },
    verifyToken: async () => {
      verifyCalls += 1;
      return identity();
    },
  }));
  const composed = router(runtime, {
    service: { list: async () => { serviceCalls += 1; } },
  });

  const missing = await invokeRoute(composed);
  assert.equal(missing.res.statusCode, 401);
  assert.deepEqual(missing.res.body, { error: 'invalid_moderation_identity' });
  assert.deepEqual([verifyCalls, accessCalls, rateCalls, serviceCalls], [0, 0, 0, 0]);

  const denied = await invokeRoute(composed, {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  assert.equal(denied.res.statusCode, 429);
  assert.deepEqual(denied.res.body, { error: 'moderation_rate_limited' });
  assert.equal(denied.res.headers['retry-after'], '17');
  assert.deepEqual([verifyCalls, accessCalls, rateCalls, serviceCalls], [1, 1, 1, 0]);
});
