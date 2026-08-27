import assert from 'node:assert/strict';
import test from 'node:test';

import { MODERATION_CAPABILITIES } from '../src/lib/moderation-principal.js';
import {
  createModerationRateLimiter,
  MODERATION_RATE_LIMIT_SCOPES,
} from '../src/middleware/moderation-rate-limit.js';

const ACTOR_ID = `wf_${'r'.repeat(32)}`;

function response() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function run({
  actorId = ACTOR_ID,
  consume,
  dependencyTimeoutMs,
  log,
  scopes = MODERATION_RATE_LIMIT_SCOPES.QUEUE_READ,
} = {}) {
  const middleware = createModerationRateLimiter({
    consume,
    ...(dependencyTimeoutMs === undefined ? {} : { dependencyTimeoutMs }),
  })(scopes);
  const req = {
    moderator: actorId === null ? undefined : { actorId },
    headers: {
      'x-forwarded-for': '203.0.113.10',
      authorization: 'Bearer private-token',
    },
    ip: '127.0.0.1',
    ...(log ? { log } : {}),
  };
  const res = response();
  let nextCalls = 0;
  await middleware(req, res, () => { nextCalls += 1; });
  return { nextCalls, req, res };
}

test('consumes only the authenticated opaque actor and allowlisted scopes', async () => {
  const calls = [];
  const result = await run({
    scopes: [
      MODERATION_RATE_LIMIT_SCOPES.REPORT_DECIDE,
      MODERATION_RATE_LIMIT_SCOPES.CONTENT_REMOVE,
    ],
    consume: async (input, { signal }) => {
      calls.push(input);
      assert.equal(Object.isFrozen(input), true);
      assert.equal(Object.isFrozen(input.scopes), true);
      assert.equal(signal instanceof AbortSignal, true);
      assert.equal(signal.aborted, false);
      return { allowed: true };
    },
  });

  assert.equal(result.nextCalls, 1);
  assert.equal(result.res.statusCode, 200);
  assert.deepEqual(calls, [{
    actorId: ACTOR_ID,
    scopes: [
      MODERATION_CAPABILITIES.CONTENT_REMOVE,
      MODERATION_CAPABILITIES.REPORT_DECIDE,
    ],
  }]);
  assert.equal(Object.hasOwn(calls[0], 'ip'), false);
  assert.equal(Object.hasOwn(calls[0], 'headers'), false);
  assert.equal(Object.hasOwn(calls[0], 'token'), false);
});

test('returns bounded 429 and Retry-After when an actor bucket is exhausted', async () => {
  const result = await run({
    consume: async () => ({ allowed: false, retryAfterSeconds: 37 }),
  });
  assert.equal(result.nextCalls, 0);
  assert.equal(result.res.statusCode, 429);
  assert.deepEqual(result.res.body, { error: 'moderation_rate_limited' });
  assert.equal(result.res.headers['retry-after'], '37');
  assert.equal(JSON.stringify(result.res.body).includes(ACTOR_ID), false);
});

test('fails closed when storage is absent, the actor is invalid, or output is malformed', async () => {
  const unconfigured = await run();
  assert.equal(unconfigured.res.statusCode, 503);
  assert.deepEqual(unconfigured.res.body, {
    error: 'moderation_rate_limit_unconfigured',
  });

  let consumeCalls = 0;
  for (const actorId of [null, 'reviewer@example.test', 'wf_short']) {
    const result = await run({
      actorId,
      consume: async () => { consumeCalls += 1; return { allowed: true }; },
    });
    assert.equal(result.res.statusCode, 403);
    assert.deepEqual(result.res.body, { error: 'moderation_forbidden' });
    assert.equal(result.nextCalls, 0);
  }
  assert.equal(consumeCalls, 0);

  for (const outcome of [
    null,
    {},
    { allowed: true, retryAfterSeconds: 1 },
    { allowed: false },
    { allowed: false, retryAfterSeconds: 0 },
    { allowed: false, retryAfterSeconds: 3_601 },
    { allowed: 'yes' },
  ]) {
    const result = await run({ consume: async () => outcome });
    assert.equal(result.res.statusCode, 503);
    assert.deepEqual(result.res.body, { error: 'moderation_rate_limit_unavailable' });
    assert.equal(result.nextCalls, 0);
  }

  let allowedReads = 0;
  const changingAccessor = {};
  Object.defineProperties(changingAccessor, {
    allowed: {
      enumerable: true,
      get() {
        allowedReads += 1;
        return allowedReads < 3 ? false : true;
      },
    },
    retryAfterSeconds: {
      enumerable: true,
      get() { return 1; },
    },
  });
  const accessorResult = await run({ consume: async () => changingAccessor });
  assert.equal(accessorResult.res.statusCode, 503);
  assert.deepEqual(accessorResult.res.body, {
    error: 'moderation_rate_limit_unavailable',
  });
  assert.equal(accessorResult.nextCalls, 0);
  assert.equal(allowedReads, 0);
});

test('storage outages log only a fixed classification and never actor material', async () => {
  class RateStoreFailure extends Error {
    constructor(message) {
      super(message);
      this.name = ACTOR_ID;
    }
  }
  const secret = `${ACTOR_ID} private-token 203.0.113.10`;
  const logCalls = [];
  const result = await run({
    consume: async () => { throw new RateStoreFailure(secret); },
    log: { error: (...args) => logCalls.push(args) },
  });

  assert.equal(result.res.statusCode, 503);
  assert.deepEqual(result.res.body, { error: 'moderation_rate_limit_unavailable' });
  assert.deepEqual(logCalls, [[
    { errorType: 'ModerationRateLimitDependencyError' },
    'moderation rate limit failed',
  ]]);
  assert.equal(JSON.stringify({ body: result.res.body, logCalls }).includes(secret), false);
  assert.equal(JSON.stringify({ body: result.res.body, logCalls }).includes(ACTOR_ID), false);
});

test('a logger outage cannot make a rate-store outage fail open', async () => {
  const result = await run({
    consume: async () => { throw new Error('store unavailable'); },
    log: { error() { throw new Error('logger unavailable'); } },
  });
  assert.equal(result.res.statusCode, 503);
  assert.deepEqual(result.res.body, { error: 'moderation_rate_limit_unavailable' });
  assert.equal(result.nextCalls, 0);
});

test('aborts and fails closed when rate storage does not settle', async () => {
  let observedSignal;
  const result = await run({
    dependencyTimeoutMs: 10,
    consume: async (_input, { signal }) => {
      observedSignal = signal;
      return new Promise(() => {});
    },
  });
  assert.equal(observedSignal instanceof AbortSignal, true);
  assert.equal(observedSignal.aborted, true);
  assert.equal(result.res.statusCode, 503);
  assert.deepEqual(result.res.body, { error: 'moderation_rate_limit_unavailable' });
  assert.equal(result.nextCalls, 0);
});

test('rejects unknown or duplicate scopes during router construction', () => {
  const factory = createModerationRateLimiter({ consume: async () => ({ allowed: true }) });
  for (const scopes of [
    [],
    'unknown.scope',
    [MODERATION_RATE_LIMIT_SCOPES.QUEUE_READ, MODERATION_RATE_LIMIT_SCOPES.QUEUE_READ],
    [MODERATION_RATE_LIMIT_SCOPES.QUEUE_READ, 'unknown.scope'],
  ]) {
    assert.throws(() => factory(scopes), TypeError);
  }
  for (const dependencyTimeoutMs of [0, 10_001, 1.5]) {
    assert.throws(
      () => createModerationRateLimiter({
        consume: async () => ({ allowed: true }),
        dependencyTimeoutMs,
      }),
      TypeError,
    );
  }
});
