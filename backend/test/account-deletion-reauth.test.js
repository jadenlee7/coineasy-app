import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { generateKeyPair, SignJWT } from 'jose';

import {
  APPLE_IDENTITY_ISSUER,
  EASYGO_APPLE_NATIVE_CLIENT_ID,
  AccountDeletionReauthError,
  consumeAccountDeletionReauthChallenge,
  findBoundAppleStableProviderIdentity,
  issueAccountDeletionReauthChallenge,
  requirePrivySessionId,
  verifyAppleIdentityToken,
  verifyAccountDeletionReauthChallenge,
} from '../src/lib/account-deletion-reauth.js';
import {
  accountDeletionSubjectKeyFingerprint,
  deriveAppleStableProviderIdentity,
} from '../src/lib/account-deletion.js';

const TEST_ENV = {
  ACCOUNT_DELETION_SUBJECT_HMAC_KEY: 'h'.repeat(32),
  ACCOUNT_DELETION_RECENT_AUTH_ENABLED: 'true',
};
const PRIVY_DID = 'did:privy:test-reauth-owner';
const SESSION_ID = 'privy-session-reauth-123';
const CLIENT_REQUEST_ID = '11111111-2222-4333-8444-555555555555';
const APPLE_SUBJECT = '001234.abcdef.stable-apple-subject';
const NOW = new Date('2026-08-08T12:00:00.000Z');
const CHALLENGE_ID = 'challenge_abc123';
const SYNTACTIC_JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhcHBsZSJ9.c2lnbmF0dXJl';

async function signedAppleToken(privateKey, {
  algorithm = 'RS256',
  issuer = APPLE_IDENTITY_ISSUER,
  audience = EASYGO_APPLE_NATIVE_CLIENT_ID,
  nonce,
  issuedAt,
  expiresAt,
  subject = APPLE_SUBJECT,
} = {}) {
  return new SignJWT({ nonce })
    .setProtectedHeader({ alg: algorithm, kid: 'local-test-key' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(privateKey);
}

function byteSource() {
  let next = 1;
  return (length) => Buffer.alloc(length, next++);
}

function makeMemoryPrisma() {
  let challenge;
  const transitionCalls = [];
  const tx = {
    accountDeletionKeyRegistry: {
      async createMany() { return { count: 1 }; },
      async findUnique() {
        return { fingerprint: accountDeletionSubjectKeyFingerprint(TEST_ENV, { required: true }) };
      },
    },
    accountDeletionReauthChallenge: {
      async deleteMany(args) {
        assert.deepEqual(args.where.status.in, ['ISSUED', 'ATTESTED']);
        assert.deepEqual(args.where.expiresAt, { lte: NOW });
        return { count: 0 };
      },
      async create({ data }) {
        challenge = {
          id: CHALLENGE_ID,
          ...data,
          createdAt: NOW,
          updatedAt: NOW,
        };
        return { id: CHALLENGE_ID, expiresAt: data.expiresAt };
      },
    },
    async $queryRawUnsafe(query, ...params) {
      if (/^SELECT CURRENT_TIMESTAMP/u.test(query)) return [{ now: NOW }];
      transitionCalls.push({ query, params });
      if (/SET "status" = 'ATTESTED'/u.test(query) && challenge?.status === 'ISSUED') {
        challenge = {
          ...challenge,
          status: 'ATTESTED',
          providerIdentityHash: params[8],
          proofHash: params[9],
          attestedAt: NOW,
        };
        return [{ expiresAt: challenge.expiresAt, attestedAt: NOW }];
      }
      if (/SET "status" = 'CONSUMED'/u.test(query) && challenge?.status === 'ATTESTED') {
        challenge = { ...challenge, status: 'CONSUMED', consumedAt: NOW };
        return [{ consumedAt: NOW }];
      }
      return [];
    },
  };
  const prisma = {
    accountDeletionReauthChallenge: {
      async findUnique() { return challenge; },
    },
    async $queryRawUnsafe(query, ...params) {
      return tx.$queryRawUnsafe(query, ...params);
    },
    async $transaction(operation) { return operation(tx); },
  };
  return {
    prisma,
    tx,
    transitionCalls,
    get challenge() { return challenge; },
  };
}

test('recent reauth stays unavailable behind the independent compile latch', async () => {
  await assert.rejects(
    () => issueAccountDeletionReauthChallenge({
      prisma: {},
      privyDid: PRIVY_DID,
      sessionId: SESSION_ID,
      clientRequestId: CLIENT_REQUEST_ID,
      env: TEST_ENV,
    }),
    (error) => (
      error instanceof AccountDeletionReauthError
      && error.code === 'account_deletion_reauth_disabled'
      && error.status === 503
    ),
  );
});

test('Privy reauth binding requires the verified session ID claim', () => {
  assert.equal(requirePrivySessionId({ sessionId: SESSION_ID }), SESSION_ID);
  for (const claims of [undefined, {}, { sessionId: '' }, { sessionId: ' padded ' }]) {
    assert.throws(
      () => requirePrivySessionId(claims),
      (error) => error.code === 'account_deletion_reauth_session_required',
    );
  }
});

test('recent auth loads the immutable Apple digest bound to the exact local DID', async () => {
  const expected = deriveAppleStableProviderIdentity(APPLE_SUBJECT, TEST_ENV);
  let query;
  const identity = await findBoundAppleStableProviderIdentity({
    userStableProviderIdentity: {
      async findFirst(options) {
        query = options;
        return expected;
      },
    },
  }, PRIVY_DID);

  assert.deepEqual(identity, expected);
  assert.deepEqual(query.where, {
    provider: 'apple_oauth',
    context: 'signin-with-apple.subject.v1',
    user: { privyDid: PRIVY_DID },
  });
  assert.equal(JSON.stringify(query).includes(APPLE_SUBJECT), false);

  await assert.rejects(
    () => findBoundAppleStableProviderIdentity({
      userStableProviderIdentity: { async findFirst() { return null; } },
    }, PRIVY_DID),
    (error) => (
      error.code === 'account_deletion_reauth_stable_apple_identity_required'
      && error.status === 409
    ),
  );
});

test('default Apple verifier pins RS256 and every challenge-bound JWT claim', async (t) => {
  const nowSeconds = Math.floor(NOW.getTime() / 1000);
  const nonce = Buffer.alloc(32, 3).toString('base64url');
  const wrongNonce = Buffer.alloc(32, 4).toString('base64url');
  const rsa = await generateKeyPair('RS256');
  const ec = await generateKeyPair('ES256');
  const validClaims = {
    nonce,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + 300,
  };

  await t.test('accepts a valid local RS256 Apple assertion', async () => {
    const identityToken = await signedAppleToken(rsa.privateKey, validClaims);
    const verified = await verifyAppleIdentityToken({
      identityToken,
      expectedNonce: nonce,
      challengeCreatedAt: NOW,
      currentDate: NOW,
      keyResolver: rsa.publicKey,
    });
    assert.equal(verified.subject, APPLE_SUBJECT);
    assert.equal(verified.issuedAt, nowSeconds);
    assert.equal(verified.expiresAt, nowSeconds + 300);
  });

  const invalidCases = [
    {
      name: 'wrong algorithm',
      key: ec,
      claims: { ...validClaims, algorithm: 'ES256' },
    },
    {
      name: 'wrong issuer',
      key: rsa,
      claims: { ...validClaims, issuer: 'https://attacker.example' },
    },
    {
      name: 'wrong audience',
      key: rsa,
      claims: { ...validClaims, audience: 'com.example.other-app' },
    },
    {
      name: 'wrong nonce',
      key: rsa,
      claims: { ...validClaims, nonce: wrongNonce },
    },
    {
      name: 'expired token',
      key: rsa,
      claims: {
        ...validClaims,
        issuedAt: nowSeconds - 240,
        expiresAt: nowSeconds - 120,
      },
      challengeCreatedAt: new Date(NOW.getTime() - 300_000),
    },
    {
      name: 'token issued before this challenge',
      key: rsa,
      claims: {
        ...validClaims,
        issuedAt: nowSeconds - 120,
        expiresAt: nowSeconds + 180,
      },
    },
  ];

  for (const invalid of invalidCases) {
    await t.test(`rejects ${invalid.name}`, async () => {
      const identityToken = await signedAppleToken(invalid.key.privateKey, invalid.claims);
      await assert.rejects(
        () => verifyAppleIdentityToken({
          identityToken,
          expectedNonce: nonce,
          challengeCreatedAt: invalid.challengeCreatedAt || NOW,
          currentDate: NOW,
          keyResolver: invalid.key.publicKey,
        }),
        (error) => (
          error instanceof AccountDeletionReauthError
          && error.code === 'account_deletion_reauth_apple_token_invalid'
          && error.status === 401
        ),
      );
    });
  }
});

test('challenge issuance persists only hashes, pins the HMAC key, and uses DB-clock expiry', async () => {
  const db = makeMemoryPrisma();
  const result = await issueAccountDeletionReauthChallenge({
    prisma: db.prisma,
    privyDid: PRIVY_DID,
    sessionId: SESSION_ID,
    clientRequestId: CLIENT_REQUEST_ID,
    env: TEST_ENV,
    randomBytesImpl: byteSource(),
    allowFoundationExecution: true,
  });

  assert.equal(result.challengeId, CHALLENGE_ID);
  assert.equal(result.expiresAt, '2026-08-08T12:05:00.000Z');
  assert.match(result.nonce, /^[A-Za-z0-9_-]{43}$/u);
  assert.match(result.state, /^[A-Za-z0-9_-]{43}$/u);
  assert.equal(db.challenge.status, 'ISSUED');
  assert.equal(db.challenge.subjectHashKeyVersion, 1);
  assert.equal(
    db.challenge.subjectHashKeyFingerprint,
    accountDeletionSubjectKeyFingerprint(TEST_ENV, { required: true }),
  );
  for (const raw of [PRIVY_DID, SESSION_ID, CLIENT_REQUEST_ID, result.nonce, result.state]) {
    assert.equal(JSON.stringify(db.challenge).includes(raw), false);
  }
  for (const digest of [
    db.challenge.subjectHash,
    db.challenge.sessionHash,
    db.challenge.clientRequestHash,
    db.challenge.nonceHash,
    db.challenge.stateHash,
  ]) {
    assert.match(digest, /^[0-9a-f]{64}$/u);
  }
});

test('Apple attestation is challenge-bound and returns a hashed-at-rest one-time proof', async () => {
  const db = makeMemoryPrisma();
  const issued = await issueAccountDeletionReauthChallenge({
    prisma: db.prisma,
    privyDid: PRIVY_DID,
    sessionId: SESSION_ID,
    clientRequestId: CLIENT_REQUEST_ID,
    env: TEST_ENV,
    randomBytesImpl: byteSource(),
    allowFoundationExecution: true,
  });
  const stableProviderIdentity = deriveAppleStableProviderIdentity(
    APPLE_SUBJECT,
    TEST_ENV,
    { required: true },
  );
  let verifierCalls = 0;
  const verified = await verifyAccountDeletionReauthChallenge({
    prisma: db.prisma,
    privyDid: PRIVY_DID,
    sessionId: SESSION_ID,
    clientRequestId: CLIENT_REQUEST_ID,
    challengeId: issued.challengeId,
    nonce: issued.nonce,
    state: issued.state,
    identityToken: SYNTACTIC_JWT,
    stableProviderIdentity,
    env: TEST_ENV,
    verifyAppleToken: async (input) => {
      verifierCalls += 1;
      assert.equal(input.identityToken, SYNTACTIC_JWT);
      assert.equal(input.expectedNonce, issued.nonce);
      assert.equal(input.challengeCreatedAt, NOW);
      assert.equal(input.currentDate, NOW);
      return { subject: APPLE_SUBJECT };
    },
    randomBytesImpl: () => Buffer.alloc(32, 9),
    allowFoundationExecution: true,
  });

  assert.equal(verifierCalls, 1);
  assert.equal(verified.challengeId, CHALLENGE_ID);
  assert.match(verified.reauthProof, /^[A-Za-z0-9_-]{43}$/u);
  assert.equal(db.challenge.status, 'ATTESTED');
  assert.equal(db.challenge.providerIdentityHash, stableProviderIdentity.providerIdentityHash);
  assert.match(db.challenge.proofHash, /^[0-9a-f]{64}$/u);
  assert.notEqual(db.challenge.proofHash, verified.reauthProof);
  assert.equal(JSON.stringify(db.challenge).includes(SYNTACTIC_JWT), false);
  assert.equal(JSON.stringify(db.challenge).includes(APPLE_SUBJECT), false);
  assert.equal(JSON.stringify(db.challenge).includes(verified.reauthProof), false);

  const transition = db.transitionCalls.at(-1);
  for (const raw of [issued.nonce, issued.state, SYNTACTIC_JWT, APPLE_SUBJECT, verified.reauthProof]) {
    assert.equal(JSON.stringify(transition.params).includes(raw), false);
  }
});

test('binding mismatch fails before Apple verification and does not consume the challenge', async () => {
  const db = makeMemoryPrisma();
  const issued = await issueAccountDeletionReauthChallenge({
    prisma: db.prisma,
    privyDid: PRIVY_DID,
    sessionId: SESSION_ID,
    clientRequestId: CLIENT_REQUEST_ID,
    env: TEST_ENV,
    randomBytesImpl: byteSource(),
    allowFoundationExecution: true,
  });
  let verifierCalled = false;
  await assert.rejects(
    () => verifyAccountDeletionReauthChallenge({
      prisma: db.prisma,
      privyDid: PRIVY_DID,
      sessionId: 'different-session',
      clientRequestId: CLIENT_REQUEST_ID,
      challengeId: issued.challengeId,
      nonce: issued.nonce,
      state: issued.state,
      identityToken: SYNTACTIC_JWT,
      stableProviderIdentity: deriveAppleStableProviderIdentity(
        APPLE_SUBJECT,
        TEST_ENV,
        { required: true },
      ),
      env: TEST_ENV,
      verifyAppleToken: async () => { verifierCalled = true; },
      allowFoundationExecution: true,
    }),
    (error) => error.code === 'account_deletion_reauth_challenge_invalid',
  );
  assert.equal(verifierCalled, false);
  assert.equal(db.challenge.status, 'ISSUED');
});

test('consume is single-use, DB-clock checked, and intended for the deletion transaction', async () => {
  const db = makeMemoryPrisma();
  const issued = await issueAccountDeletionReauthChallenge({
    prisma: db.prisma,
    privyDid: PRIVY_DID,
    sessionId: SESSION_ID,
    clientRequestId: CLIENT_REQUEST_ID,
    env: TEST_ENV,
    randomBytesImpl: byteSource(),
    allowFoundationExecution: true,
  });
  const stableProviderIdentity = deriveAppleStableProviderIdentity(
    APPLE_SUBJECT,
    TEST_ENV,
    { required: true },
  );
  const verified = await verifyAccountDeletionReauthChallenge({
    prisma: db.prisma,
    privyDid: PRIVY_DID,
    sessionId: SESSION_ID,
    clientRequestId: CLIENT_REQUEST_ID,
    challengeId: issued.challengeId,
    nonce: issued.nonce,
    state: issued.state,
    identityToken: SYNTACTIC_JWT,
    stableProviderIdentity,
    env: TEST_ENV,
    verifyAppleToken: async () => ({ subject: APPLE_SUBJECT }),
    randomBytesImpl: () => Buffer.alloc(32, 7),
    allowFoundationExecution: true,
  });

  const consumed = await consumeAccountDeletionReauthChallenge(db.tx, {
    privyDid: PRIVY_DID,
    sessionId: SESSION_ID,
    clientRequestId: CLIENT_REQUEST_ID,
    challengeId: issued.challengeId,
    reauthProof: verified.reauthProof,
    stableProviderIdentity,
    env: TEST_ENV,
    allowFoundationExecution: true,
  });
  assert.equal(consumed.consumedAt, NOW.toISOString());
  assert.equal(db.challenge.status, 'CONSUMED');

  await assert.rejects(
    () => consumeAccountDeletionReauthChallenge(db.tx, {
      privyDid: PRIVY_DID,
      sessionId: SESSION_ID,
      clientRequestId: CLIENT_REQUEST_ID,
      challengeId: issued.challengeId,
      reauthProof: verified.reauthProof,
      stableProviderIdentity,
      env: TEST_ENV,
      allowFoundationExecution: true,
    }),
    (error) => error.code === 'account_deletion_reauth_proof_invalid' && error.status === 409,
  );
});

test('consume distinguishes a database outage from an invalid proof without leaking details', async () => {
  const stableProviderIdentity = deriveAppleStableProviderIdentity(
    APPLE_SUBJECT,
    TEST_ENV,
    { required: true },
  );
  await assert.rejects(
    () => consumeAccountDeletionReauthChallenge({
      async $queryRawUnsafe() { throw new Error('secret database host'); },
    }, {
      privyDid: PRIVY_DID,
      sessionId: SESSION_ID,
      clientRequestId: CLIENT_REQUEST_ID,
      challengeId: CHALLENGE_ID,
      reauthProof: Buffer.alloc(32, 8).toString('base64url'),
      stableProviderIdentity,
      env: TEST_ENV,
      allowFoundationExecution: true,
    }),
    (error) => (
      error.code === 'account_deletion_reauth_database_unavailable'
      && error.status === 503
      && !error.message.includes('secret database host')
    ),
  );
});

test('migration enforces hash-only state transitions and durable tombstone attribution', async () => {
  const migration = await readFile(new URL(
    '../prisma/migrations/20260808153000_account_deletion_recent_reauth/migration.sql',
    import.meta.url,
  ), 'utf8');
  assert.match(migration, /AccountDeletionReauthChallenge_digests_check/u);
  assert.match(migration, /AccountDeletionReauthChallenge_status_check/u);
  assert.match(migration, /TIMESTAMPTZ\(3\)/u);
  assert.match(migration, /AccountDeletionReauthChallenge_transition_guard/u);
  assert.match(migration, /invalid account deletion reauth status transition/u);
  assert.match(migration, /AccountDeletionReauthChallenge_subject_key_fkey/u);
  assert.match(migration, /AccountDeletionRequest_recent_auth_fkey/u);
  assert.match(migration, /recentAuthChallengeId/u);
  assert.doesNotMatch(migration, /identityToken|authorizationCode|appleSubject|privyDid/u);
  assert.doesNotMatch(migration, /uniq_deletion_reauth_active_session/u);
});
