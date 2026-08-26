import assert from 'node:assert/strict';
import test from 'node:test';
import { ModerationError } from '../src/lib/moderation-service.js';
import { createModerationRouter } from '../src/routes/moderation.js';

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
  id = 'request-route-1',
  log,
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

  const req = { query, params, body, id, headers: {}, ...(log ? { log } : {}) };
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
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
  return { req, res, nextError };
}

function enabledRouter({ service, authenticate } = {}) {
  return createModerationRouter({
    db: {},
    env: {},
    phaseConfig: { POST_MODERATION_ENABLED: true },
    service,
    authenticate,
  });
}

test('all moderation routes apply no-store and keep the feature gate before auth/service', async () => {
  let authCalls = 0;
  let serviceCalls = 0;
  const service = {
    list: async () => { serviceCalls += 1; },
    claim: async () => { serviceCalls += 1; },
    decide: async () => { serviceCalls += 1; },
  };
  const authenticate = (_req, _res, next) => {
    authCalls += 1;
    next();
  };
  const router = createModerationRouter({
    db: {},
    env: {},
    phaseConfig: { POST_MODERATION_ENABLED: false },
    service,
    authenticate,
  });

  for (const route of [
    { method: 'GET', path: '/reports' },
    { method: 'POST', path: '/reports/:reportId/claim', params: { reportId: 'missing' } },
    { method: 'POST', path: '/reports/:reportId/decision', params: { reportId: 'missing' } },
  ]) {
    const { res, nextError } = await invokeRoute(router, route);
    assert.equal(nextError, undefined);
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { error: 'not_found' });
    assert.equal(res.headers['cache-control'], 'no-store');
  }
  assert.equal(authCalls, 0);
  assert.equal(serviceCalls, 0);
});

test('authentication runs before service lookup and cannot disclose report existence', async () => {
  let serviceCalls = 0;
  const router = enabledRouter({
    authenticate: (_req, res) => res.status(401).json({ error: 'invalid_moderation_key' }),
    service: {
      list: async () => { serviceCalls += 1; },
      claim: async () => { serviceCalls += 1; },
      decide: async () => { serviceCalls += 1; },
    },
  });

  const { res } = await invokeRoute(router, {
    method: 'POST',
    path: '/reports/:reportId/claim',
    params: { reportId: 'does-not-exist' },
    body: { expectedVersion: 0 },
  });
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'invalid_moderation_key' });
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(serviceCalls, 0);
});

test('enabled injected routes pass only authenticated moderator inputs to the service', async () => {
  const calls = [];
  const service = {
    list: async (...args) => {
      calls.push(['list', ...args]);
      return { reports: [], nextCursor: null };
    },
    claim: async (...args) => {
      calls.push(['claim', ...args]);
      return { report: { id: args[1], status: 'REVIEWING' } };
    },
    decide: async (...args) => {
      calls.push(['decide', ...args]);
      return { report: { id: args[1], status: 'DISMISSED' }, contentChanged: false };
    },
  };
  const authenticate = (req, _res, next) => {
    req.moderator = { keyId: 'primary-reviewer' };
    next();
  };
  const router = enabledRouter({ service, authenticate });

  const listQuery = { status: 'OPEN', limit: '5' };
  const listed = await invokeRoute(router, { query: listQuery, id: 'request-list' });
  assert.equal(listed.res.statusCode, 200);
  assert.deepEqual(listed.res.body, { reports: [], nextCursor: null });
  assert.equal(listed.res.headers['cache-control'], 'no-store');

  const claimBody = { expectedVersion: 0 };
  const claimed = await invokeRoute(router, {
    method: 'POST',
    path: '/reports/:reportId/claim',
    params: { reportId: 'report-1' },
    body: claimBody,
    id: 'request-claim',
  });
  assert.equal(claimed.res.statusCode, 200);
  assert.equal(claimed.res.headers['cache-control'], 'no-store');

  const decisionBody = {
    expectedVersion: 1,
    decision: 'DISMISS',
    expectedPostRevision: 0,
  };
  const decided = await invokeRoute(router, {
    method: 'POST',
    path: '/reports/:reportId/decision',
    params: { reportId: 'report-1' },
    body: decisionBody,
    id: 'request-decision',
  });
  assert.equal(decided.res.statusCode, 200);
  assert.equal(decided.res.headers['cache-control'], 'no-store');

  assert.deepEqual(calls, [
    ['list', 'primary-reviewer', listQuery],
    ['claim', 'primary-reviewer', 'report-1', claimBody],
    ['decide', 'primary-reviewer', 'report-1', decisionBody],
  ]);
});

test('service configuration is resolved only after the feature gate and authentication', async () => {
  const malformedEnv = { MODERATION_RESPONSE_SLA_HOURS: 'not-an-integer' };
  let disabledAuthCalls = 0;
  const disabled = createModerationRouter({
    db: {},
    env: malformedEnv,
    phaseConfig: { POST_MODERATION_ENABLED: false },
    authenticate: (_req, _res, next) => {
      disabledAuthCalls += 1;
      next();
    },
  });
  const disabledResult = await invokeRoute(disabled);
  assert.equal(disabledResult.res.statusCode, 404);
  assert.deepEqual(disabledResult.res.body, { error: 'not_found' });
  assert.equal(disabledAuthCalls, 0);

  const unauthenticated = createModerationRouter({
    db: {},
    env: malformedEnv,
    phaseConfig: { POST_MODERATION_ENABLED: true },
    authenticate: (_req, res) => res.status(401).json({ error: 'invalid_moderation_key' }),
  });
  const unauthenticatedResult = await invokeRoute(unauthenticated);
  assert.equal(unauthenticatedResult.res.statusCode, 401);
  assert.deepEqual(unauthenticatedResult.res.body, { error: 'invalid_moderation_key' });

  const authenticated = createModerationRouter({
    db: {},
    env: malformedEnv,
    phaseConfig: { POST_MODERATION_ENABLED: true },
    authenticate: (req, _res, next) => {
      req.moderator = { keyId: 'primary-reviewer' };
      next();
    },
  });
  const authenticatedResult = await invokeRoute(authenticated);
  assert.equal(authenticatedResult.res.statusCode, 503);
  assert.deepEqual(authenticatedResult.res.body, {
    error: 'moderation_service_unconfigured',
  });
  assert.equal(authenticatedResult.res.headers['cache-control'], 'no-store');
});

test('malformed SLA configuration cannot crash singleton module import', async () => {
  const previous = process.env.MODERATION_RESPONSE_SLA_HOURS;
  process.env.MODERATION_RESPONSE_SLA_HOURS = 'malformed-at-import';
  try {
    const moduleUrl = new URL(
      `../src/routes/moderation.js?malformed-sla=${Date.now()}`,
      import.meta.url,
    );
    const imported = await import(moduleUrl);
    assert.ok(imported.moderationRouter);
  } finally {
    if (previous === undefined) {
      delete process.env.MODERATION_RESPONSE_SLA_HOURS;
    } else {
      process.env.MODERATION_RESPONSE_SLA_HOURS = previous;
    }
  }
});

test('known moderation errors return only the safe code without logging the raw cause', async () => {
  const secret = 'raw reporter and post details';
  const logCalls = [];
  const router = enabledRouter({
    authenticate: (req, _res, next) => {
      req.moderator = { keyId: 'primary-reviewer' };
      next();
    },
    service: {
      list: async () => {
        throw new ModerationError('report_not_found', {
          status: 404,
          cause: new Error(secret),
        });
      },
    },
  });

  const { res } = await invokeRoute(router, {
    log: { error: (...args) => logCalls.push(args) },
  });
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'report_not_found' });
  assert.equal(logCalls.length, 0);
  assert.equal(JSON.stringify(res.body).includes(secret), false);
});

test('unexpected errors log metadata only and return a stable body without raw errors', async () => {
  const secret = 'database row contained reporter-private-1 and raw body';
  const rawError = new Error(secret);
  rawError.name = 'DatabaseReadFailure';
  rawError.code = 'E_DB_READ';
  const logCalls = [];
  const router = enabledRouter({
    authenticate: (req, _res, next) => {
      req.moderator = { keyId: 'primary-reviewer' };
      next();
    },
    service: {
      list: async () => { throw rawError; },
    },
  });

  const { res, nextError } = await invokeRoute(router, {
    id: 'request-failure',
    log: { error: (...args) => logCalls.push(args) },
  });
  assert.equal(nextError, undefined);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'internal_error', requestId: 'request-failure' });
  assert.equal(logCalls.length, 1);
  assert.deepEqual(logCalls[0], [
    {
      requestId: 'request-failure',
      errorType: 'DatabaseReadFailure',
      errorCode: 'E_DB_READ',
    },
    'moderation request failed',
  ]);
  const serialized = JSON.stringify({ response: res.body, logCalls });
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes('reporter-private-1'), false);
  assert.equal(serialized.includes('raw body'), false);
  assert.equal(Object.hasOwn(logCalls[0][0], 'err'), false);
  assert.equal(Object.values(logCalls[0][0]).includes(rawError), false);
});

test('unexpected error names and codes are bounded before logging', async () => {
  const secret = 'raw reporter body and credential';
  const rawError = new Error(secret);
  rawError.name = `DatabaseFailure ${secret}`;
  rawError.code = `E_DB_${secret}`;
  const logCalls = [];
  const router = enabledRouter({
    authenticate: (req, _res, next) => {
      req.moderator = { keyId: 'primary-reviewer' };
      next();
    },
    service: { list: async () => { throw rawError; } },
  });

  const { res } = await invokeRoute(router, {
    id: 'request-bounded-error',
    log: { error: (...args) => logCalls.push(args) },
  });
  assert.equal(res.statusCode, 500);
  assert.deepEqual(logCalls[0][0], {
    requestId: 'request-bounded-error',
    errorType: 'Error',
    errorCode: undefined,
  });
  assert.equal(JSON.stringify({ res: res.body, logCalls }).includes(secret), false);
});
