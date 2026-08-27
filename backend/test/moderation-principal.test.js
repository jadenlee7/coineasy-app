import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MODERATION_AUTH_METHOD,
  MODERATION_CAPABILITIES,
  MODERATION_MFA_MAX_AGE_SECONDS,
  MODERATION_SESSION_MAX_AGE_SECONDS,
  ModerationPrincipalError,
  validateModerationPrincipal,
} from '../src/lib/moderation-principal.js';

const NOW_SECONDS = 1_800_000_000;
const NOW = () => NOW_SECONDS * 1_000;
const ACTOR_ID = `wf_${'a'.repeat(32)}`;

function principal(overrides = {}) {
  return {
    actorId: ACTOR_ID,
    authMethod: MODERATION_AUTH_METHOD,
    capabilities: [
      MODERATION_CAPABILITIES.REPORT_CLAIM,
      MODERATION_CAPABILITIES.QUEUE_READ,
    ],
    expiresAt: NOW_SECONDS + 600,
    issuedAt: NOW_SECONDS - 60,
    mfaAuthenticatedAt: NOW_SECONDS - 120,
    mfaVerified: true,
    ...overrides,
  };
}

function assertInvalid(value, options = {}) {
  assert.throws(
    () => validateModerationPrincipal(value, { now: NOW, ...options }),
    ModerationPrincipalError,
  );
}

test('accepts only a bounded MFA workforce principal and freezes normalized capabilities', () => {
  const input = principal();
  const result = validateModerationPrincipal(input, { now: NOW });

  assert.deepEqual(result, {
    actorId: ACTOR_ID,
    authMethod: MODERATION_AUTH_METHOD,
    capabilities: [
      MODERATION_CAPABILITIES.QUEUE_READ,
      MODERATION_CAPABILITIES.REPORT_CLAIM,
    ],
    expiresAt: NOW_SECONDS + 600,
    issuedAt: NOW_SECONDS - 60,
    mfaAuthenticatedAt: NOW_SECONDS - 120,
    mfaVerified: true,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.capabilities), true);
  assert.notEqual(result, input);
});

test('rejects legacy keys, raw identity claims, malformed actor IDs, and missing MFA', () => {
  for (const value of [
    { keyId: 'primary-reviewer' },
    principal({ email: 'reviewer@example.com' }),
    principal({ subject: 'raw-oidc-subject' }),
    principal({ actorId: 'primary-reviewer' }),
    principal({ actorId: `wf_${'a'.repeat(61)}` }),
    principal({ actorId: `wf_${'a'.repeat(21)}` }),
    principal({ actorId: `wf_${'a'.repeat(31)}+` }),
    principal({ authMethod: 'static_key' }),
    principal({ mfaVerified: false }),
    principal({ mfaVerified: 'true' }),
  ]) {
    assertInvalid(value);
  }

  const symbolClaim = principal();
  symbolClaim[Symbol('email')] = 'reviewer@example.com';
  assertInvalid(symbolClaim);

  const hiddenClaim = principal();
  Object.defineProperty(hiddenClaim, 'email', { value: 'reviewer@example.com' });
  assertInvalid(hiddenClaim);
});

test('rejects unknown, duplicate, non-string, or oversized capability sets', () => {
  for (const capabilities of [
    ['queue.read', 'queue.read'],
    ['queue.read', 'unknown.permission'],
    ['queue.read', null],
    Object.values(MODERATION_CAPABILITIES).concat('queue.read'),
    'queue.read',
  ]) {
    assertInvalid(principal({ capabilities }));
  }

  const empty = validateModerationPrincipal(principal({ capabilities: [] }), { now: NOW });
  assert.deepEqual(empty.capabilities, []);
});

test('separates token issuance from MFA authentication and rejects unsafe timing', () => {
  const maxSessionAge = MODERATION_SESSION_MAX_AGE_SECONDS;
  const maxMfaAge = MODERATION_MFA_MAX_AGE_SECONDS;
  for (const value of [
    principal({ expiresAt: NOW_SECONDS }),
    principal({ issuedAt: NOW_SECONDS + 61, expiresAt: NOW_SECONDS + 600 }),
    principal({ mfaAuthenticatedAt: NOW_SECONDS + 61 }),
    principal({ issuedAt: NOW_SECONDS - 60, mfaAuthenticatedAt: NOW_SECONDS + 1 }),
    principal({ expiresAt: NOW_SECONDS + 1, mfaAuthenticatedAt: NOW_SECONDS + 1 }),
    principal({ issuedAt: NOW_SECONDS - maxSessionAge - 1 }),
    principal({ mfaAuthenticatedAt: NOW_SECONDS - maxMfaAge - 1 }),
    principal({ issuedAt: NOW_SECONDS - 1, expiresAt: NOW_SECONDS + maxSessionAge }),
    principal({ issuedAt: NOW_SECONDS + 10, expiresAt: NOW_SECONDS + 9 }),
    principal({ issuedAt: 1.5 }),
    principal({ mfaAuthenticatedAt: 1.5 }),
    principal({ expiresAt: '1800000600' }),
  ]) {
    assertInvalid(value);
  }
});

test('accepts exact safe time boundaries and rejects the first unsafe second', () => {
  const futureAtSkew = principal({
    expiresAt: NOW_SECONDS + 360,
    issuedAt: NOW_SECONDS + 60,
    mfaAuthenticatedAt: NOW_SECONDS + 60,
  });
  assert.doesNotThrow(() => validateModerationPrincipal(futureAtSkew, { now: NOW }));
  assertInvalid(principal({
    expiresAt: NOW_SECONDS + 361,
    issuedAt: NOW_SECONDS + 61,
    mfaAuthenticatedAt: NOW_SECONDS + 61,
  }));

  assertInvalid(principal({ expiresAt: NOW_SECONDS }));
  assert.doesNotThrow(() => validateModerationPrincipal(
    principal({
      expiresAt: NOW_SECONDS + 1,
      mfaAuthenticatedAt: NOW_SECONDS,
    }),
    { now: NOW },
  ));

  const exactLifetime = principal({
    expiresAt: NOW_SECONDS - 1 + MODERATION_SESSION_MAX_AGE_SECONDS,
    issuedAt: NOW_SECONDS - 1,
  });
  assert.doesNotThrow(() => validateModerationPrincipal(exactLifetime, { now: NOW }));
  assertInvalid(principal({
    expiresAt: NOW_SECONDS + MODERATION_SESSION_MAX_AGE_SECONDS,
    issuedAt: NOW_SECONDS - 1,
  }));

  assert.doesNotThrow(() => validateModerationPrincipal(principal({
    mfaAuthenticatedAt: NOW_SECONDS - MODERATION_MFA_MAX_AGE_SECONDS,
  }), { now: NOW }));
  assertInvalid(principal({
    mfaAuthenticatedAt: NOW_SECONDS - MODERATION_MFA_MAX_AGE_SECONDS - 1,
  }));
});

test('accepts safe validator option limits and rejects boundary weakening', () => {
  const shortest = principal({
    expiresAt: NOW_SECONDS + 299,
    issuedAt: NOW_SECONDS - 1,
    mfaAuthenticatedAt: NOW_SECONDS - 60,
  });
  assert.doesNotThrow(() => validateModerationPrincipal(shortest, {
    clockSkewSeconds: 0,
    maxMfaAgeSeconds: 60,
    maxSessionAgeSeconds: 300,
    now: NOW,
  }));
  assert.doesNotThrow(() => validateModerationPrincipal(principal(), {
    clockSkewSeconds: 300,
    maxMfaAgeSeconds: MODERATION_MFA_MAX_AGE_SECONDS,
    maxSessionAgeSeconds: MODERATION_SESSION_MAX_AGE_SECONDS,
    now: NOW,
  }));

  for (const options of [
    { maxSessionAgeSeconds: 299 },
    { maxSessionAgeSeconds: MODERATION_SESSION_MAX_AGE_SECONDS + 1 },
    { maxSessionAgeSeconds: 1.5 },
    { maxMfaAgeSeconds: 59 },
    { maxMfaAgeSeconds: MODERATION_MFA_MAX_AGE_SECONDS + 1 },
    { maxMfaAgeSeconds: 1.5 },
    { clockSkewSeconds: -1 },
    { clockSkewSeconds: 301 },
    { clockSkewSeconds: 1.5 },
    { now: () => Number.NaN },
    { now: () => { throw new Error('clock unavailable'); } },
    { now: null },
    { unknownOption: true },
  ]) {
    assertInvalid(principal(), options);
  }

  const symbolOptions = { now: NOW };
  symbolOptions[Symbol('unsafe')] = true;
  assert.throws(
    () => validateModerationPrincipal(principal(), symbolOptions),
    ModerationPrincipalError,
  );
});
