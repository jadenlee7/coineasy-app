import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MODERATION_AUTH_METHOD,
  MODERATION_CAPABILITIES,
  MODERATION_MFA_MAX_AGE_SECONDS,
} from '../src/lib/moderation-principal.js';
import { createModerationAuthorizer } from '../src/middleware/moderation-authorization.js';

const NOW_SECONDS = 1_800_000_000;
const NOW = () => NOW_SECONDS * 1_000;
const ACTOR_ID = `wf_${'b'.repeat(32)}`;

function principal(capabilities, overrides = {}) {
  return {
    actorId: ACTOR_ID,
    authMethod: MODERATION_AUTH_METHOD,
    capabilities,
    expiresAt: NOW_SECONDS + 600,
    issuedAt: NOW_SECONDS - 60,
    mfaAuthenticatedAt: NOW_SECONDS - 120,
    mfaVerified: true,
    ...overrides,
  };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function authorize(required, moderator, routeOptions = {}, authorizerOptions = {}) {
  const middleware = createModerationAuthorizer({
    now: NOW,
    ...authorizerOptions,
  })(required, routeOptions);
  const req = { moderator };
  const res = response();
  let nextCalls = 0;
  middleware(req, res, () => { nextCalls += 1; });
  return { req, res, nextCalls };
}

test('allows only explicitly granted capabilities and attaches the strict principal', () => {
  const moderator = principal([
    MODERATION_CAPABILITIES.QUEUE_READ,
    MODERATION_CAPABILITIES.REPORT_CLAIM,
  ]);
  const result = authorize([
    MODERATION_CAPABILITIES.QUEUE_READ,
    MODERATION_CAPABILITIES.REPORT_CLAIM,
  ], moderator);

  assert.equal(result.nextCalls, 1);
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.res.body, null);
  assert.notEqual(result.req.moderator, moderator);
  assert.equal(Object.isFrozen(result.req.moderator), true);
  assert.deepEqual(result.req.moderator.capabilities, [
    MODERATION_CAPABILITIES.QUEUE_READ,
    MODERATION_CAPABILITIES.REPORT_CLAIM,
  ]);
});

test('denies a missing capability without disclosing actor or policy data', () => {
  const result = authorize(
    MODERATION_CAPABILITIES.REPORT_DECIDE,
    principal([MODERATION_CAPABILITIES.QUEUE_READ]),
  );

  assert.equal(result.nextCalls, 0);
  assert.equal(result.res.statusCode, 403);
  assert.deepEqual(result.res.body, { error: 'moderation_forbidden' });
  const serialized = JSON.stringify(result.res.body);
  assert.equal(serialized.includes(ACTOR_ID), false);
  assert.equal(serialized.includes(MODERATION_CAPABILITIES.REPORT_DECIDE), false);
});

test('legacy static keys and invalid workforce sessions fail closed with the same 403', () => {
  for (const moderator of [
    { keyId: 'primary-reviewer' },
    undefined,
    principal([MODERATION_CAPABILITIES.QUEUE_READ], { mfaVerified: false }),
    principal([MODERATION_CAPABILITIES.QUEUE_READ], { expiresAt: NOW_SECONDS }),
    principal(['unknown.permission']),
  ]) {
    const result = authorize(MODERATION_CAPABILITIES.QUEUE_READ, moderator);
    assert.equal(result.nextCalls, 0);
    assert.equal(result.res.statusCode, 403);
    assert.deepEqual(result.res.body, { error: 'moderation_forbidden' });
  }
});

test('each capability remains independent and content removal needs its own grant', () => {
  const capabilities = Object.values(MODERATION_CAPABILITIES);
  for (const required of capabilities) {
    const permitted = authorize(required, principal([required]));
    assert.equal(permitted.nextCalls, 1, required);

    const denied = authorize(
      required,
      principal(capabilities.filter((capability) => capability !== required)),
    );
    assert.equal(denied.nextCalls, 0, required);
    assert.equal(denied.res.statusCode, 403, required);
  }
});

test('route MFA limits can only shorten the authorizer boundary', () => {
  const required = MODERATION_CAPABILITIES.CONTENT_REMOVE;
  const exact = authorize(required, principal([required], {
    mfaAuthenticatedAt: NOW_SECONDS - 300,
  }), { maxMfaAgeSeconds: 300 });
  assert.equal(exact.nextCalls, 1);

  const stale = authorize(required, principal([required], {
    mfaAuthenticatedAt: NOW_SECONDS - 301,
  }), { maxMfaAgeSeconds: 300 });
  assert.equal(stale.nextCalls, 0);
  assert.equal(stale.res.statusCode, 403);

  const cannotRelaxBase = authorize(required, principal([required], {
    mfaAuthenticatedAt: NOW_SECONDS - 301,
  }), { maxMfaAgeSeconds: 900 }, { maxMfaAgeSeconds: 300 });
  assert.equal(cannotRelaxBase.nextCalls, 0);
  assert.equal(cannotRelaxBase.res.statusCode, 403);

  for (const invalidBaseLimit of [null, MODERATION_MFA_MAX_AGE_SECONDS + 1]) {
    const cannotMaskInvalidBase = authorize(
      required,
      principal([required]),
      { maxMfaAgeSeconds: 900 },
      { maxMfaAgeSeconds: invalidBaseLimit },
    );
    assert.equal(cannotMaskInvalidBase.nextCalls, 0);
    assert.equal(cannotMaskInvalidBase.res.statusCode, 403);
  }
});

test('invalid route capability requirements fail during router construction', () => {
  const authorizer = createModerationAuthorizer({ now: NOW });
  for (const required of [
    [],
    ['queue.read', 'queue.read'],
    'unknown.permission',
    null,
  ]) {
    assert.throws(
      () => authorizer(required),
      TypeError,
    );
  }

  for (const routeOptions of [
    null,
    [],
    { unknownOption: true },
    { maxMfaAgeSeconds: 59 },
    { maxMfaAgeSeconds: MODERATION_MFA_MAX_AGE_SECONDS + 1 },
    { maxMfaAgeSeconds: 1.5 },
  ]) {
    assert.throws(
      () => authorizer(MODERATION_CAPABILITIES.QUEUE_READ, routeOptions),
      TypeError,
    );
  }

  const symbolOptions = {};
  symbolOptions[Symbol('unsafe')] = true;
  assert.throws(
    () => authorizer(MODERATION_CAPABILITIES.QUEUE_READ, symbolOptions),
    TypeError,
  );
});
