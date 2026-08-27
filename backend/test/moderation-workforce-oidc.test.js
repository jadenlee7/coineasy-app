import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPair, SignJWT } from 'jose';

import {
  createAcrAmrWorkforceClaimsAdapter,
  createPinnedModerationRemoteJwks,
  createWorkforceOidcVerifier,
  ModerationWorkforceOidcConfigError,
  ModerationWorkforceOidcTokenError,
  ModerationWorkforceOidcUnavailableError,
} from '../src/lib/moderation-workforce-oidc.js';

const NOW_SECONDS = 1_800_000_000;
const NOW = () => NOW_SECONDS * 1_000;
const ISSUER = 'https://identity.example.test/moderation';
const AUDIENCE = 'easygo-moderation-api';
const SUBJECT = 'workforce|reviewer-123';
const ROLE_CLAIM = 'roles';
const TOKEN_TYPE = 'at+jwt';
const MFA_ACR = 'urn:easygo:test:mfa';

async function signedToken(privateKey, {
  algorithm = 'RS256',
  audience = AUDIENCE,
  expiresAt = NOW_SECONDS + 600,
  header = {},
  includeKid = true,
  issuedAt = NOW_SECONDS - 60,
  issuer = ISSUER,
  payload = {},
  subject = SUBJECT,
  tokenType = TOKEN_TYPE,
} = {}) {
  const jwt = new SignJWT({
    acr: MFA_ACR,
    amr: ['pwd', 'otp'],
    auth_time: NOW_SECONDS - 120,
    roles: ['moderation-reviewer'],
    ...payload,
  }).setProtectedHeader({
    alg: algorithm,
    ...(includeKid ? { kid: 'workforce-key-1' } : {}),
    typ: tokenType,
    ...header,
  });
  if (issuer !== null) jwt.setIssuer(issuer);
  if (audience !== null) jwt.setAudience(audience);
  if (subject !== null) jwt.setSubject(subject);
  if (issuedAt !== null) jwt.setIssuedAt(issuedAt);
  if (expiresAt !== null) jwt.setExpirationTime(expiresAt);
  return jwt.sign(privateKey);
}

function verifier(keyResolver, overrides = {}) {
  return createWorkforceOidcVerifier({
    adaptClaims: createAcrAmrWorkforceClaimsAdapter({
      acceptedMfaAcrValues: [MFA_ACR],
      requiredMfaAmrValues: ['pwd', 'otp'],
      roleClaim: ROLE_CLAIM,
    }),
    algorithms: ['RS256'],
    audience: AUDIENCE,
    issuer: ISSUER,
    keyResolver: typeof keyResolver === 'function'
      ? keyResolver
      : async () => keyResolver,
    maxMfaAgeSeconds: 900,
    maxTokenAgeSeconds: 900,
    now: NOW,
    tokenType: TOKEN_TYPE,
    ...overrides,
  });
}

test('verifies a pinned workforce token and returns only immutable mapping inputs', async () => {
  const rsa = await generateKeyPair('RS256');
  const verify = verifier(rsa.publicKey);
  const token = await signedToken(rsa.privateKey);

  const identity = await verify(token);
  assert.deepEqual(identity, {
    expiresAt: NOW_SECONDS + 600,
    issuedAt: NOW_SECONDS - 60,
    issuer: ISSUER,
    mfaAuthenticatedAt: NOW_SECONDS - 120,
    mfaVerified: true,
    roleIds: ['moderation-reviewer'],
    subject: SUBJECT,
  });
  assert.equal(Object.isFrozen(identity), true);
  assert.equal(Object.isFrozen(identity.roleIds), true);
  assert.equal(Object.hasOwn(identity, 'token'), false);
  assert.equal(Object.hasOwn(identity, 'claims'), false);
});

test('gives the provider adapter an immutable claim snapshot', async () => {
  const rsa = await generateKeyPair('RS256');
  let adapterCalls = 0;
  const verify = verifier(rsa.publicKey, {
    adaptClaims(payload) {
      adapterCalls += 1;
      assert.equal(Object.isFrozen(payload), true);
      assert.equal(Object.isFrozen(payload.roles), true);
      assert.throws(() => { payload.sub = 'attacker-subject'; }, TypeError);
      assert.throws(() => { payload.roles.push('attacker-role'); }, TypeError);
      return {
        mfaAuthenticatedAt: payload.auth_time,
        mfaVerified: true,
        roleIds: payload.roles,
      };
    },
  });

  const result = await verify(await signedToken(rsa.privateKey));
  assert.equal(adapterCalls, 1);
  assert.equal(result.subject, SUBJECT);
  assert.deepEqual(result.roleIds, ['moderation-reviewer']);
});

test('rejects token confusion, signature, claim, MFA, and role failures generically', async (t) => {
  const rsa = await generateKeyPair('RS256');
  const outsider = await generateKeyPair('RS256');
  const ec = await generateKeyPair('ES256');
  const verify = verifier(rsa.publicKey);
  const invalidCases = [
    ['wrong signature', outsider.privateKey, {}],
    ['wrong algorithm', ec.privateKey, { algorithm: 'ES256' }],
    ['wrong issuer', rsa.privateKey, { issuer: 'https://attacker.example.test' }],
    ['wrong audience', rsa.privateKey, { audience: 'other-api' }],
    ['multiple audiences', rsa.privateKey, { audience: [AUDIENCE, 'other-api'] }],
    ['wrong token type', rsa.privateKey, { tokenType: 'JWT' }],
    ['missing key ID', rsa.privateKey, { includeKid: false }],
    ['non-string key ID', rsa.privateKey, { header: { kid: 123 } }],
    ['token-provided key URL', rsa.privateKey, {
      header: { jku: 'https://attacker.example.test/jwks.json' },
    }],
    ['expired token', rsa.privateKey, {
      issuedAt: NOW_SECONDS - 600,
      expiresAt: NOW_SECONDS - 1,
    }],
    ['oversized session', rsa.privateKey, {
      issuedAt: NOW_SECONDS - 1_000,
      expiresAt: NOW_SECONDS + 1,
    }],
    ['stale MFA', rsa.privateKey, {
      payload: { auth_time: NOW_SECONDS - 901 },
    }],
    ['MFA after issue time', rsa.privateKey, {
      payload: { auth_time: NOW_SECONDS + 1 },
    }],
    ['unapproved MFA method', rsa.privateKey, {
      payload: { amr: ['pwd'] },
    }],
    ['single second factor without the primary method', rsa.privateKey, {
      payload: { amr: ['otp'] },
    }],
    ['unapproved MFA assurance context', rsa.privateKey, {
      payload: { acr: 'urn:easygo:test:password-only' },
    }],
    ['duplicate roles', rsa.privateKey, {
      payload: { roles: ['moderation-reviewer', 'moderation-reviewer'] },
    }],
    ['missing subject', rsa.privateKey, { subject: null }],
    ['subject with whitespace', rsa.privateKey, { subject: 'reviewer subject' }],
  ];

  for (const [name, privateKey, options] of invalidCases) {
    await t.test(name, async () => {
      const token = await signedToken(privateKey, options);
      await assert.rejects(() => verify(token), ModerationWorkforceOidcTokenError);
    });
  }

  for (const token of [
    '',
    'not-a-jwt',
    'a.b.c',
    `a.${'b'.repeat(16 * 1_024)}.c`,
  ]) {
    await assert.rejects(() => verify(token), ModerationWorkforceOidcTokenError);
  }
});

test('classifies JWKS and clock outages separately from invalid identities', async () => {
  const rsa = await generateKeyPair('RS256');
  const token = await signedToken(rsa.privateKey);
  const timeout = new Error('secret provider endpoint details');
  timeout.code = 'ERR_JWKS_TIMEOUT';
  const unavailable = verifier(async () => { throw timeout; });

  await assert.rejects(
    () => unavailable(token),
    ModerationWorkforceOidcUnavailableError,
  );
  const unsupportedProviderKey = new Error('private provider key details');
  unsupportedProviderKey.code = 'ERR_JOSE_NOT_SUPPORTED';
  await assert.rejects(
    () => verifier(async () => { throw unsupportedProviderKey; })(token),
    ModerationWorkforceOidcUnavailableError,
  );
  await assert.rejects(
    () => verifier(rsa.publicKey, { now: () => { throw new Error('clock down'); } })(token),
    ModerationWorkforceOidcUnavailableError,
  );

  const badJwks = new Error('private JWKS response body');
  badJwks.code = 'ERR_JOSE_GENERIC';
  await assert.rejects(
    () => verifier(rsa.publicKey, {
      jwtVerifyImpl: async () => { throw badJwks; },
    })(token),
    ModerationWorkforceOidcUnavailableError,
  );

  const unknownKey = new Error('private key identifier');
  unknownKey.code = 'ERR_JWKS_NO_MATCHING_KEY';
  await assert.rejects(
    () => verifier(rsa.publicKey, {
      jwtVerifyImpl: async () => { throw unknownKey; },
    })(token),
    ModerationWorkforceOidcTokenError,
  );
});

test('pins, bounds, caches, and aborts the remote JWKS transport', async () => {
  const localKey = Object.freeze({ key: 'local-test-key' });
  const fetchCalls = [];
  const localCalls = [];
  let receivedJwks;
  const result = createPinnedModerationRemoteJwks(
    'https://identity.example.test/.well-known/jwks.json',
    {
      createLocalJWKSetImpl(jwks) {
        receivedJwks = jwks;
        return async (header, token) => {
          localCalls.push({ header, token });
          return localKey;
        };
      },
      async fetchImpl(url, options) {
        fetchCalls.push({ options, url: String(url) });
        return new Response(JSON.stringify({
          keys: [{ kid: 'workforce-key-1', kty: 'RSA' }],
        }), { status: 200 });
      },
      now: () => NOW_SECONDS * 1_000,
    },
  );
  const header = { alg: 'RS256', kid: 'workforce-key-1' };
  const token = { protected: 'header', payload: 'claims', signature: 'signature' };
  assert.equal(await result(header, token), localKey);
  assert.equal(await result(header, token), localKey);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'https://identity.example.test/.well-known/jwks.json');
  assert.equal(fetchCalls[0].options.method, 'GET');
  assert.equal(fetchCalls[0].options.redirect, 'error');
  assert.equal(fetchCalls[0].options.cache, 'no-store');
  assert.deepEqual(fetchCalls[0].options.headers, { Accept: 'application/json' });
  assert.equal(fetchCalls[0].options.signal instanceof AbortSignal, true);
  assert.equal(fetchCalls[0].options.signal.aborted, false);
  assert.deepEqual(receivedJwks, {
    keys: [{ kid: 'workforce-key-1', kty: 'RSA' }],
  });
  assert.deepEqual(localCalls, [{ header, token }, { header, token }]);

  let transportSignal;
  const stalled = createPinnedModerationRemoteJwks(
    'https://identity.example.test/.well-known/jwks.json',
    {
      createLocalJWKSetImpl: () => assert.fail('stalled body must not be cached'),
      fetchImpl: async (_url, { signal }) => {
        transportSignal = signal;
        return {
          status: 200,
          body: {
            getReader() {
              return {
                read() {
                  return new Promise((_resolve, reject) => {
                    signal.addEventListener('abort', () => {
                      reject(new Error('transport aborted'));
                    }, { once: true });
                  });
                },
                releaseLock() {},
              };
            },
          },
        };
      },
      timeoutMs: 10,
    },
  );
  await assert.rejects(
    () => stalled(header, token),
    ModerationWorkforceOidcUnavailableError,
  );
  assert.equal(transportSignal instanceof AbortSignal, true);
  assert.equal(transportSignal.aborted, true);

  let rejectedResponseSignal;
  const rejectedResponse = createPinnedModerationRemoteJwks(
    'https://identity.example.test/.well-known/jwks.json',
    {
      createLocalJWKSetImpl: () => assert.fail('rejected response must not be cached'),
      fetchImpl: async (_url, { signal }) => {
        rejectedResponseSignal = signal;
        return {
          status: 503,
          body: {
            getReader: () => assert.fail('non-200 response body must not be read'),
          },
        };
      },
    },
  );
  await assert.rejects(
    () => rejectedResponse(header, token),
    ModerationWorkforceOidcUnavailableError,
  );
  assert.equal(rejectedResponseSignal instanceof AbortSignal, true);
  assert.equal(rejectedResponseSignal.aborted, true);
});

test('rejects unsafe remote JWKS and verifier configuration', () => {

  for (const unsafeUrl of [
    'http://identity.example.test/jwks.json',
    'https://user:pass@identity.example.test/jwks.json',
    'https://identity.example.test/jwks.json?tenant=easygo',
  ]) {
    assert.throws(
      () => createPinnedModerationRemoteJwks(unsafeUrl),
      ModerationWorkforceOidcConfigError,
    );
  }
  for (const options of [
    { fetchImpl: null },
    { createLocalJWKSetImpl: null },
    { timeoutMs: 0 },
    { timeoutMs: 10_001 },
  ]) {
    assert.throws(
      () => createPinnedModerationRemoteJwks(
        'https://identity.example.test/.well-known/jwks.json',
        options,
      ),
      ModerationWorkforceOidcConfigError,
    );
  }

  const validAdapter = createAcrAmrWorkforceClaimsAdapter({
    acceptedMfaAcrValues: [MFA_ACR],
    requiredMfaAmrValues: ['pwd', 'otp'],
    roleClaim: ROLE_CLAIM,
  });
  for (const overrides of [
    { algorithms: ['HS256'] },
    { audience: '' },
    { issuer: 'http://identity.example.test' },
    { tokenType: '' },
    { keyResolver: null },
    { maxTokenAgeSeconds: 8 * 60 * 60 + 1 },
  ]) {
    assert.throws(
      () => createWorkforceOidcVerifier({
        adaptClaims: validAdapter,
        algorithms: ['RS256'],
        audience: AUDIENCE,
        issuer: ISSUER,
        keyResolver: () => {},
        tokenType: TOKEN_TYPE,
        ...overrides,
      }),
      ModerationWorkforceOidcConfigError,
    );
  }
});

test('the ACR and AMR adapter accepts only explicit MFA evidence and bounded roles', () => {
  assert.throws(
    () => createAcrAmrWorkforceClaimsAdapter({
      acceptedMfaAcrValues: [],
      requiredMfaAmrValues: ['pwd', 'otp'],
      roleClaim: ROLE_CLAIM,
    }),
    ModerationWorkforceOidcConfigError,
  );
  assert.throws(
    () => createAcrAmrWorkforceClaimsAdapter({
      acceptedMfaAcrValues: [MFA_ACR],
      requiredMfaAmrValues: ['pwd', 'otp'],
      roleClaim: 'roles with spaces',
    }),
    ModerationWorkforceOidcConfigError,
  );
  assert.throws(
    () => createAcrAmrWorkforceClaimsAdapter({
      acceptedMfaAcrValues: [MFA_ACR],
      requiredMfaAmrValues: ['otp'],
      roleClaim: ROLE_CLAIM,
    }),
    ModerationWorkforceOidcConfigError,
  );
});
