import assert from 'node:assert/strict';
import test from 'node:test';
import { hashModerationApiKey } from '../src/lib/moderation-auth.js';
import {
  MODERATION_AUTH_METHOD,
  MODERATION_CAPABILITIES,
  MODERATION_DESTRUCTIVE_MFA_MAX_AGE_SECONDS,
} from '../src/lib/moderation-principal.js';
import { ModerationError } from '../src/lib/moderation-service.js';
import { createModerationRouter } from '../src/routes/moderation.js';

const ACTOR_ID = `wf_${'r'.repeat(32)}`;

function workforceModerator(
  capabilities = Object.values(MODERATION_CAPABILITIES),
  overrides = {},
) {
  const now = Math.floor(Date.now() / 1_000);
  return {
    actorId: ACTOR_ID,
    authMethod: MODERATION_AUTH_METHOD,
    capabilities,
    expiresAt: now + 600,
    issuedAt: now - 60,
    mfaAuthenticatedAt: now - 120,
    mfaVerified: true,
    ...overrides,
  };
}

function authenticateWorkforce(req, _res, next) {
  req.moderator = workforceModerator();
  next();
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
  id = 'request-route-1',
  headers = {},
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

  const req = { query, params, body, id, headers, ...(log ? { log } : {}) };
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

function enabledRouter({ service, authenticate = authenticateWorkforce, authorize } = {}) {
  return createModerationRouter({
    db: {},
    env: {},
    phaseConfig: { POST_MODERATION_ENABLED: true },
    service,
    authenticate,
    ...(authorize ? { authorize } : {}),
  });
}

test('all moderation routes apply no-store and keep the feature gate before auth/service', async () => {
  let authCalls = 0;
  let authorizationCalls = 0;
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
  const authorize = () => (_req, _res, next) => {
    authorizationCalls += 1;
    next();
  };
  const router = createModerationRouter({
    db: {},
    env: {},
    phaseConfig: { POST_MODERATION_ENABLED: false },
    service,
    authenticate,
    authorize,
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
  assert.equal(authorizationCalls, 0);
  assert.equal(serviceCalls, 0);
});

test('authentication runs before service lookup and cannot disclose report existence', async () => {
  let authorizationCalls = 0;
  let serviceCalls = 0;
  const router = enabledRouter({
    authenticate: (_req, res) => res.status(401).json({ error: 'invalid_moderation_key' }),
    authorize: () => (_req, _res, next) => {
      authorizationCalls += 1;
      next();
    },
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
  assert.equal(authorizationCalls, 0);
  assert.equal(serviceCalls, 0);
});

test('a valid legacy moderation key is rejected before every route service boundary', async () => {
  const legacyKey = `eg_mod_${'l'.repeat(32)}`;
  let serviceCalls = 0;
  const service = {
    list: async () => { serviceCalls += 1; },
    claim: async () => { serviceCalls += 1; },
    decide: async () => { serviceCalls += 1; },
  };
  const router = createModerationRouter({
    env: {
      MODERATION_API_KEY_HASHES_JSON: JSON.stringify({
        'legacy-reviewer': hashModerationApiKey(legacyKey),
      }),
    },
    phaseConfig: { POST_MODERATION_ENABLED: true },
    service,
  });

  const routes = [
    { method: 'GET', path: '/reports' },
    {
      method: 'POST',
      path: '/reports/:reportId/claim',
      params: { reportId: 'report-legacy-claim' },
      body: { expectedVersion: 0 },
    },
    {
      method: 'POST',
      path: '/reports/:reportId/decision',
      params: { reportId: 'report-legacy-dismiss' },
      body: { decision: 'DISMISS', expectedPostRevision: 0, expectedVersion: 1 },
    },
    {
      method: 'POST',
      path: '/reports/:reportId/decision',
      params: { reportId: 'report-legacy-remove' },
      body: { decision: 'REMOVE_POST', expectedPostRevision: 0, expectedVersion: 1 },
    },
  ];
  for (const route of routes) {
    const { req, res } = await invokeRoute(router, {
      ...route,
      headers: { authorization: `Bearer ${legacyKey}` },
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'moderation_forbidden' });
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.deepEqual(req.moderator, { keyId: 'legacy-reviewer' });
    const serialized = JSON.stringify(res.body);
    assert.equal(serialized.includes('legacy-reviewer'), false);
    assert.equal(serialized.includes(legacyKey), false);
  }
  assert.equal(serviceCalls, 0);

  const unconfiguredRouter = createModerationRouter({
    db: {},
    env: {
      MODERATION_API_KEY_HASHES_JSON: JSON.stringify({
        'legacy-reviewer': hashModerationApiKey(legacyKey),
      }),
      MODERATION_RESPONSE_SLA_HOURS: 'not-an-integer',
    },
    phaseConfig: { POST_MODERATION_ENABLED: true },
  });
  for (const route of routes) {
    const { res } = await invokeRoute(unconfiguredRouter, {
      ...route,
      headers: { authorization: `Bearer ${legacyKey}` },
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'moderation_forbidden' });
  }
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
  const router = enabledRouter({ service });

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
    ['list', ACTOR_ID, listQuery],
    ['claim', ACTOR_ID, 'report-1', claimBody],
    ['decide', ACTOR_ID, 'report-1', decisionBody],
  ]);
});

test('queue, claim, decision, and irreversible removal capabilities remain distinct', async () => {
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
      return { report: { id: args[1], status: 'ACTIONED' } };
    },
  };
  function routerFor(capabilities, principalOverrides = {}) {
    return enabledRouter({
      service,
      authenticate: (req, _res, next) => {
        req.moderator = workforceModerator(capabilities, principalOverrides);
        next();
      },
    });
  }

  const queueRouter = routerFor([MODERATION_CAPABILITIES.QUEUE_READ]);
  const listed = await invokeRoute(queueRouter);
  assert.equal(listed.res.statusCode, 200);
  const queueClaim = await invokeRoute(queueRouter, {
    method: 'POST',
    path: '/reports/:reportId/claim',
    params: { reportId: 'report-queue' },
    body: { expectedVersion: 0 },
  });
  assert.equal(queueClaim.res.statusCode, 403);
  assert.deepEqual(queueClaim.res.body, { error: 'moderation_forbidden' });

  const claimRouter = routerFor([MODERATION_CAPABILITIES.REPORT_CLAIM]);
  const claimed = await invokeRoute(claimRouter, {
    method: 'POST',
    path: '/reports/:reportId/claim',
    params: { reportId: 'report-claim' },
    body: { expectedVersion: 0 },
  });
  assert.equal(claimed.res.statusCode, 200);
  const claimList = await invokeRoute(claimRouter);
  assert.equal(claimList.res.statusCode, 403);

  const decisionRouter = routerFor([MODERATION_CAPABILITIES.REPORT_DECIDE]);
  const dismissed = await invokeRoute(decisionRouter, {
    method: 'POST',
    path: '/reports/:reportId/decision',
    params: { reportId: 'report-dismiss' },
    body: { decision: 'DISMISS', expectedPostRevision: 0, expectedVersion: 1 },
  });
  assert.equal(dismissed.res.statusCode, 200);
  const removalDenied = await invokeRoute(decisionRouter, {
    method: 'POST',
    path: '/reports/:reportId/decision',
    params: { reportId: 'report-remove-denied' },
    body: { decision: 'REMOVE_POST', expectedPostRevision: 0, expectedVersion: 1 },
  });
  assert.equal(removalDenied.res.statusCode, 403);
  assert.deepEqual(removalDenied.res.body, { error: 'moderation_forbidden' });

  const removalOnlyRouter = routerFor([MODERATION_CAPABILITIES.CONTENT_REMOVE]);
  const removalOnlyDenied = await invokeRoute(removalOnlyRouter, {
    method: 'POST',
    path: '/reports/:reportId/decision',
    params: { reportId: 'report-remove-only' },
    body: { decision: 'REMOVE_POST', expectedPostRevision: 0, expectedVersion: 1 },
  });
  assert.equal(removalOnlyDenied.res.statusCode, 403);
  assert.deepEqual(removalOnlyDenied.res.body, { error: 'moderation_forbidden' });

  const removalRouter = routerFor([
    MODERATION_CAPABILITIES.REPORT_DECIDE,
    MODERATION_CAPABILITIES.CONTENT_REMOVE,
  ]);
  const removalAllowed = await invokeRoute(removalRouter, {
    method: 'POST',
    path: '/reports/:reportId/decision',
    params: { reportId: 'report-remove-allowed' },
    body: { decision: 'REMOVE_POST', expectedPostRevision: 0, expectedVersion: 1 },
  });
  assert.equal(removalAllowed.res.statusCode, 200);

  const now = Math.floor(Date.now() / 1_000);
  const staleMfaRouter = routerFor([
    MODERATION_CAPABILITIES.REPORT_DECIDE,
    MODERATION_CAPABILITIES.CONTENT_REMOVE,
  ], {
    mfaAuthenticatedAt: now - MODERATION_DESTRUCTIVE_MFA_MAX_AGE_SECONDS - 1,
  });
  const staleMfaDismissed = await invokeRoute(staleMfaRouter, {
    method: 'POST',
    path: '/reports/:reportId/decision',
    params: { reportId: 'report-dismiss-stale-mfa' },
    body: { decision: 'DISMISS', expectedPostRevision: 0, expectedVersion: 1 },
  });
  assert.equal(staleMfaDismissed.res.statusCode, 200);
  const staleMfaDenied = await invokeRoute(staleMfaRouter, {
    method: 'POST',
    path: '/reports/:reportId/decision',
    params: { reportId: 'report-remove-stale-mfa' },
    body: { decision: 'REMOVE_POST', expectedPostRevision: 0, expectedVersion: 1 },
  });
  assert.equal(staleMfaDenied.res.statusCode, 403);
  assert.deepEqual(staleMfaDenied.res.body, { error: 'moderation_forbidden' });

  for (const result of [
    listed,
    queueClaim,
    claimed,
    claimList,
    dismissed,
    removalDenied,
    removalOnlyDenied,
    removalAllowed,
    staleMfaDismissed,
    staleMfaDenied,
  ]) {
    assert.equal(result.res.headers['cache-control'], 'no-store');
  }
  assert.deepEqual(calls, [
    ['list', ACTOR_ID, {}],
    ['claim', ACTOR_ID, 'report-claim', { expectedVersion: 0 }],
    ['decide', ACTOR_ID, 'report-dismiss', {
      decision: 'DISMISS',
      expectedPostRevision: 0,
      expectedVersion: 1,
    }],
    ['decide', ACTOR_ID, 'report-remove-allowed', {
      decision: 'REMOVE_POST',
      expectedPostRevision: 0,
      expectedVersion: 1,
    }],
    ['decide', ACTOR_ID, 'report-dismiss-stale-mfa', {
      decision: 'DISMISS',
      expectedPostRevision: 0,
      expectedVersion: 1,
    }],
  ]);
});

test('unknown or malformed decisions fail before the service boundary', async () => {
  let serviceCalls = 0;
  const router = enabledRouter({
    service: {
      list: async () => ({ reports: [], nextCursor: null }),
      claim: async () => ({ report: {} }),
      decide: async () => {
        serviceCalls += 1;
        return { report: {} };
      },
    },
  });

  for (const body of [
    {},
    { decision: null, expectedPostRevision: 0, expectedVersion: 1 },
    { decision: { value: 'DISMISS' }, expectedPostRevision: 0, expectedVersion: 1 },
    { decision: 'BAN_USER', expectedPostRevision: 0, expectedVersion: 1 },
  ]) {
    const { res } = await invokeRoute(router, {
      method: 'POST',
      path: '/reports/:reportId/decision',
      params: { reportId: 'report-invalid-decision' },
      body,
    });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'bad_input' });
    assert.equal(res.headers['cache-control'], 'no-store');
  }
  assert.equal(serviceCalls, 0);
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
    authenticate: authenticateWorkforce,
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
