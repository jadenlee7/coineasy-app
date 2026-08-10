import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import {
  APPLE_STABLE_IDENTITY_CONTEXT,
  APPLE_STABLE_IDENTITY_PROVIDER,
  accountDeletionSubjectKeyFingerprint,
  accountDeletionSubjectHash,
  deriveAppleStableProviderIdentity,
} from './account-deletion.js';
import { accountDeletionRecentAuthEnabled } from './account-deletion-gates.js';

export const APPLE_IDENTITY_ISSUER = 'https://appleid.apple.com';
export const APPLE_IDENTITY_JWKS_URL = 'https://appleid.apple.com/auth/keys';
export const EASYGO_APPLE_NATIVE_CLIENT_ID = 'com.coineasy.coineasysocial';
export const ACCOUNT_DELETION_REAUTH_CHALLENGE_TTL_SECONDS = 5 * 60;

const APPLE_JWT_ALGORITHM = 'RS256';
const APPLE_JWKS_TIMEOUT_MS = 4_000;
const APPLE_JWKS_CACHE_MS = 10 * 60 * 1_000;
const APPLE_JWKS_COOLDOWN_MS = 30_000;
const APPLE_CLOCK_TOLERANCE_SECONDS = 60;
const OPAQUE_VALUE_BYTES = 32;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const HASH_CONTEXT = 'easygo-account-deletion:recent-auth:v1';
const SUBJECT_HASH_KEY_VERSION = 1;

let appleRemoteJwks;

export class AccountDeletionReauthError extends Error {
  constructor(code, { status = 409 } = {}) {
    super(code);
    this.name = 'AccountDeletionReauthError';
    this.code = code;
    this.status = status;
  }
}

function fail(code, status = 409) {
  throw new AccountDeletionReauthError(code, { status });
}

function assertFoundationEnabled(env, allowFoundationExecution) {
  if (!allowFoundationExecution && !accountDeletionRecentAuthEnabled(env)) {
    fail('account_deletion_reauth_disabled', 503);
  }
}

function cleanBounded(value, name, maxLength = 2048) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > maxLength
    || value !== value.trim()
  ) {
    fail(`account_deletion_reauth_${name}_invalid`, 400);
  }
  return value;
}

function normalizedClientRequestId(value) {
  const normalized = cleanBounded(value, 'client_request_id', 36).toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    fail('account_deletion_reauth_client_request_id_invalid', 400);
  }
  return normalized;
}

function normalizedChallengeId(value) {
  const normalized = cleanBounded(value, 'challenge_id', 128);
  if (!/^[A-Za-z0-9_-]+$/u.test(normalized)) {
    fail('account_deletion_reauth_challenge_id_invalid', 400);
  }
  return normalized;
}

function normalizedOpaqueValue(value, name) {
  const normalized = cleanBounded(value, name, 256);
  if (normalized.length < 32 || !BASE64URL_PATTERN.test(normalized)) {
    fail(`account_deletion_reauth_${name}_invalid`, 400);
  }
  return normalized;
}

function normalizedIdentityToken(value) {
  const normalized = cleanBounded(value, 'identity_token', 16_384);
  const parts = normalized.split('.');
  if (parts.length !== 3 || parts.some((part) => !part || !BASE64URL_PATTERN.test(part))) {
    fail('account_deletion_reauth_identity_token_invalid', 400);
  }
  return normalized;
}

function digestOpaque(label, value) {
  return createHash('sha256')
    .update(HASH_CONTEXT, 'utf8')
    .update('\0', 'utf8')
    .update(label, 'utf8')
    .update('\0', 'utf8')
    .update(value, 'utf8')
    .digest('hex');
}

function equalDigest(left, right) {
  if (!DIGEST_PATTERN.test(String(left || '')) || !DIGEST_PATTERN.test(String(right || ''))) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function equalSecret(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function opaqueSecret(bytes = randomBytes) {
  const value = bytes(OPAQUE_VALUE_BYTES);
  if (!Buffer.isBuffer(value) || value.length !== OPAQUE_VALUE_BYTES) {
    throw new TypeError('random byte source must return exactly 32 bytes');
  }
  return value.toString('base64url');
}

function challengeBindings({ privyDid, sessionId, clientRequestId, env }) {
  return {
    subjectHash: accountDeletionSubjectHash(privyDid, env, { required: true }),
    subjectHashKeyVersion: SUBJECT_HASH_KEY_VERSION,
    subjectHashKeyFingerprint: accountDeletionSubjectKeyFingerprint(
      env,
      { required: true },
    ),
    sessionHash: digestOpaque('privy-session', cleanBounded(sessionId, 'session', 2048)),
    clientRequestHash: digestOpaque(
      'client-request',
      normalizedClientRequestId(clientRequestId),
    ),
  };
}

async function assertSubjectHashKeyRegistered(tx, fingerprint) {
  await tx.accountDeletionKeyRegistry.createMany({
    data: [{ keyVersion: SUBJECT_HASH_KEY_VERSION, fingerprint }],
    skipDuplicates: true,
  });
  const registered = await tx.accountDeletionKeyRegistry.findUnique({
    where: { keyVersion: SUBJECT_HASH_KEY_VERSION },
    select: { fingerprint: true },
  });
  if (!registered || !equalDigest(registered.fingerprint, fingerprint)) {
    fail('account_deletion_reauth_hash_key_mismatch', 503);
  }
}

function validatedStableAppleIdentity(identity) {
  if (
    identity?.provider !== APPLE_STABLE_IDENTITY_PROVIDER
    || identity?.context !== APPLE_STABLE_IDENTITY_CONTEXT
    || !DIGEST_PATTERN.test(String(identity?.providerIdentityHash || ''))
  ) {
    fail('account_deletion_reauth_stable_apple_identity_required', 409);
  }
  return identity;
}

/**
 * Load the immutable Apple identity digest already bound to the authenticated
 * local account. A mutable Privy linked-account response is not sufficient
 * authority for a destructive recent-authentication proof.
 */
export async function findBoundAppleStableProviderIdentity(prisma, privyDid) {
  if (!prisma?.userStableProviderIdentity
    || typeof prisma.userStableProviderIdentity.findFirst !== 'function') {
    throw new TypeError('prisma stable-provider identity client is required');
  }
  const normalizedDid = cleanBounded(privyDid, 'privy_did', 512);
  let identity;
  try {
    identity = await prisma.userStableProviderIdentity.findFirst({
      where: {
        provider: APPLE_STABLE_IDENTITY_PROVIDER,
        context: APPLE_STABLE_IDENTITY_CONTEXT,
        user: { privyDid: normalizedDid },
      },
      select: {
        provider: true,
        context: true,
        providerIdentityHash: true,
      },
    });
  } catch {
    fail('account_deletion_reauth_database_unavailable', 503);
  }
  if (!identity) {
    fail('account_deletion_reauth_stable_apple_identity_required', 409);
  }
  return Object.freeze(validatedStableAppleIdentity(identity));
}

async function databaseNow(db) {
  if (!db || typeof db.$queryRawUnsafe !== 'function') {
    throw new TypeError('database client must support a PostgreSQL clock query');
  }
  let rows;
  try {
    rows = await db.$queryRawUnsafe('SELECT CURRENT_TIMESTAMP AS "now"');
  } catch {
    fail('account_deletion_reauth_database_clock_unavailable', 503);
  }
  const value = Array.isArray(rows) ? rows[0]?.now : undefined;
  const now = value instanceof Date ? value : new Date(value);
  if (!value || Number.isNaN(now.getTime())) {
    fail('account_deletion_reauth_database_clock_unavailable', 503);
  }
  return now;
}

function getAppleRemoteJwks() {
  if (!appleRemoteJwks) {
    appleRemoteJwks = createRemoteJWKSet(new URL(APPLE_IDENTITY_JWKS_URL), {
      timeoutDuration: APPLE_JWKS_TIMEOUT_MS,
      cacheMaxAge: APPLE_JWKS_CACHE_MS,
      cooldownDuration: APPLE_JWKS_COOLDOWN_MS,
    });
  }
  return appleRemoteJwks;
}

/**
 * Verify a native Sign in with Apple identity token. Apple currently publishes
 * RSA/RS256 signing keys at its documented JWKS endpoint; accepting an
 * algorithm based only on the token header would permit algorithm confusion.
 */
export async function verifyAppleIdentityToken({
  identityToken,
  expectedNonce,
  challengeCreatedAt,
  currentDate,
  keyResolver = getAppleRemoteJwks(),
}) {
  const token = normalizedIdentityToken(identityToken);
  const nonce = normalizedOpaqueValue(expectedNonce, 'nonce');
  const createdAt = new Date(challengeCreatedAt);
  const now = new Date(currentDate);
  if (Number.isNaN(createdAt.getTime()) || Number.isNaN(now.getTime())) {
    fail('account_deletion_reauth_apple_token_invalid', 401);
  }

  let verified;
  try {
    verified = await jwtVerify(token, keyResolver, {
      algorithms: [APPLE_JWT_ALGORITHM],
      issuer: APPLE_IDENTITY_ISSUER,
      audience: EASYGO_APPLE_NATIVE_CLIENT_ID,
      clockTolerance: APPLE_CLOCK_TOLERANCE_SECONDS,
      maxTokenAge: `${ACCOUNT_DELETION_REAUTH_CHALLENGE_TTL_SECONDS + APPLE_CLOCK_TOLERANCE_SECONDS}s`,
      currentDate: now,
    });
  } catch {
    fail('account_deletion_reauth_apple_token_invalid', 401);
  }

  const { payload, protectedHeader } = verified;
  const issuedAt = payload.iat;
  const expiresAt = payload.exp;
  const subject = payload.sub;
  const earliestIssuedAt = Math.floor(createdAt.getTime() / 1000) - APPLE_CLOCK_TOLERANCE_SECONDS;
  const latestIssuedAt = Math.floor(now.getTime() / 1000) + APPLE_CLOCK_TOLERANCE_SECONDS;
  if (
    protectedHeader.alg !== APPLE_JWT_ALGORITHM
    || !Number.isInteger(issuedAt)
    || !Number.isInteger(expiresAt)
    || expiresAt <= issuedAt
    || issuedAt < earliestIssuedAt
    || issuedAt > latestIssuedAt
    || typeof payload.nonce !== 'string'
    || !equalSecret(payload.nonce, nonce)
    || typeof subject !== 'string'
    || subject.length === 0
    || subject.length > 2048
    || subject !== subject.trim()
  ) {
    fail('account_deletion_reauth_apple_token_invalid', 401);
  }

  return Object.freeze({ subject, issuedAt, expiresAt });
}

export function requirePrivySessionId(claims) {
  const sessionId = claims?.sessionId;
  if (
    typeof sessionId !== 'string'
    || sessionId.length === 0
    || sessionId.length > 2048
    || sessionId !== sessionId.trim()
  ) {
    fail('account_deletion_reauth_session_required', 401);
  }
  return sessionId;
}

export async function issueAccountDeletionReauthChallenge({
  prisma,
  privyDid,
  sessionId,
  clientRequestId,
  env = process.env,
  randomBytesImpl = randomBytes,
  allowFoundationExecution = false,
}) {
  assertFoundationEnabled(env, allowFoundationExecution);
  if (!prisma || typeof prisma.$transaction !== 'function') {
    throw new TypeError('prisma transaction client is required');
  }
  const bindings = challengeBindings({ privyDid, sessionId, clientRequestId, env });
  const nonce = opaqueSecret(randomBytesImpl);
  const state = opaqueSecret(randomBytesImpl);
  const nonceHash = digestOpaque('apple-nonce', nonce);
  const stateHash = digestOpaque('apple-state', state);

  try {
    return await prisma.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const expiresAt = new Date(
        now.getTime() + ACCOUNT_DELETION_REAUTH_CHALLENGE_TTL_SECONDS * 1_000,
      );

      await assertSubjectHashKeyRegistered(tx, bindings.subjectHashKeyFingerprint);
      // Multiple client-request-bound challenges may coexist. In particular,
      // bearer-only issuance must never invalidate a proof that already passed
      // a fresh Apple prompt. Expired, unconsumed rows are safe to prune.
      await tx.accountDeletionReauthChallenge.deleteMany({
        where: {
          subjectHash: bindings.subjectHash,
          sessionHash: bindings.sessionHash,
          expiresAt: { lte: now },
          status: { in: ['ISSUED', 'ATTESTED'] },
        },
      });
      const challenge = await tx.accountDeletionReauthChallenge.create({
        data: {
          ...bindings,
          nonceHash,
          stateHash,
          expiresAt,
          status: 'ISSUED',
        },
        select: { id: true, expiresAt: true },
      });
      return Object.freeze({
        challengeId: challenge.id,
        nonce,
        state,
        expiresAt: challenge.expiresAt.toISOString(),
      });
    });
  } catch (error) {
    if (error instanceof AccountDeletionReauthError) throw error;
    if (error?.code === 'P2002' || error?.code === '23505') {
      fail('account_deletion_reauth_challenge_conflict', 409);
    }
    fail('account_deletion_reauth_database_unavailable', 503);
  }
}

function assertIssuedChallenge(challenge, bindings, nonce, state, now) {
  if (!challenge) fail('account_deletion_reauth_challenge_invalid', 409);
  if (
    challenge.status !== 'ISSUED'
    || !equalDigest(challenge.subjectHash, bindings.subjectHash)
    || challenge.subjectHashKeyVersion !== bindings.subjectHashKeyVersion
    || !equalDigest(
      challenge.subjectHashKeyFingerprint,
      bindings.subjectHashKeyFingerprint,
    )
    || !equalDigest(challenge.sessionHash, bindings.sessionHash)
    || !equalDigest(challenge.clientRequestHash, bindings.clientRequestHash)
    || !equalDigest(challenge.nonceHash, digestOpaque('apple-nonce', nonce))
    || !equalDigest(challenge.stateHash, digestOpaque('apple-state', state))
  ) {
    fail('account_deletion_reauth_challenge_invalid', 409);
  }
  if (!(challenge.expiresAt instanceof Date) || challenge.expiresAt <= now) {
    fail('account_deletion_reauth_challenge_expired', 409);
  }
}

export async function verifyAccountDeletionReauthChallenge({
  prisma,
  privyDid,
  sessionId,
  clientRequestId,
  challengeId,
  nonce,
  state,
  identityToken,
  stableProviderIdentity,
  env = process.env,
  verifyAppleToken = verifyAppleIdentityToken,
  randomBytesImpl = randomBytes,
  allowFoundationExecution = false,
}) {
  assertFoundationEnabled(env, allowFoundationExecution);
  if (
    !prisma
    || typeof prisma.$transaction !== 'function'
    || !prisma.accountDeletionReauthChallenge
  ) {
    throw new TypeError('prisma account-deletion reauth client is required');
  }
  if (typeof verifyAppleToken !== 'function') {
    throw new TypeError('verifyAppleToken must be a function');
  }
  const id = normalizedChallengeId(challengeId);
  const normalizedNonce = normalizedOpaqueValue(nonce, 'nonce');
  const normalizedState = normalizedOpaqueValue(state, 'state');
  const token = normalizedIdentityToken(identityToken);
  const bindings = challengeBindings({ privyDid, sessionId, clientRequestId, env });
  const currentIdentity = validatedStableAppleIdentity(stableProviderIdentity);
  const now = await databaseNow(prisma);
  let challenge;
  try {
    challenge = await prisma.accountDeletionReauthChallenge.findUnique({
      where: { id },
      select: {
        id: true,
        subjectHash: true,
        subjectHashKeyVersion: true,
        subjectHashKeyFingerprint: true,
        sessionHash: true,
        clientRequestHash: true,
        nonceHash: true,
        stateHash: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  } catch {
    fail('account_deletion_reauth_database_unavailable', 503);
  }
  assertIssuedChallenge(challenge, bindings, normalizedNonce, normalizedState, now);

  let appleProof;
  try {
    appleProof = await verifyAppleToken({
      identityToken: token,
      expectedNonce: normalizedNonce,
      challengeCreatedAt: challenge.createdAt,
      currentDate: now,
    });
  } catch (error) {
    if (error instanceof AccountDeletionReauthError) throw error;
    fail('account_deletion_reauth_apple_token_invalid', 401);
  }
  let attestedIdentity;
  try {
    attestedIdentity = deriveAppleStableProviderIdentity(
      appleProof?.subject,
      env,
      { required: true },
    );
  } catch {
    fail('account_deletion_reauth_apple_token_invalid', 401);
  }
  if (
    !attestedIdentity
    || attestedIdentity.provider !== currentIdentity.provider
    || attestedIdentity.context !== currentIdentity.context
    || !equalDigest(
      attestedIdentity.providerIdentityHash,
      currentIdentity.providerIdentityHash,
    )
  ) {
    fail('account_deletion_reauth_apple_identity_mismatch', 409);
  }

  const reauthProof = opaqueSecret(randomBytesImpl);
  const proofHash = digestOpaque('reauth-proof', reauthProof);
  const nonceHash = digestOpaque('apple-nonce', normalizedNonce);
  const stateHash = digestOpaque('apple-state', normalizedState);

  let rows;
  try {
    rows = await prisma.$transaction((tx) => tx.$queryRawUnsafe(
      `UPDATE "AccountDeletionReauthChallenge"
         SET "status" = 'ATTESTED'::"AccountDeletionReauthStatus",
             "providerIdentityHash" = $9,
             "proofHash" = $10,
             "attestedAt" = CURRENT_TIMESTAMP,
             "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $1
         AND "status" = 'ISSUED'::"AccountDeletionReauthStatus"
         AND "subjectHash" = $2
         AND "subjectHashKeyVersion" = $3
         AND "subjectHashKeyFingerprint" = $4
         AND "sessionHash" = $5
         AND "clientRequestHash" = $6
         AND "nonceHash" = $7
         AND "stateHash" = $8
         AND "expiresAt" > CURRENT_TIMESTAMP
         AND "providerIdentityHash" IS NULL
         AND "proofHash" IS NULL
       RETURNING "expiresAt", "attestedAt"`,
      id,
      bindings.subjectHash,
      bindings.subjectHashKeyVersion,
      bindings.subjectHashKeyFingerprint,
      bindings.sessionHash,
      bindings.clientRequestHash,
      nonceHash,
      stateHash,
      currentIdentity.providerIdentityHash,
      proofHash,
    ));
  } catch (error) {
    if (error?.code === '23505' || error?.code === 'P2002') {
      fail('account_deletion_reauth_challenge_conflict', 409);
    }
    fail('account_deletion_reauth_database_unavailable', 503);
  }
  if (!Array.isArray(rows) || rows.length !== 1) {
    fail('account_deletion_reauth_challenge_invalid', 409);
  }
  return Object.freeze({
    challengeId: id,
    reauthProof,
    expiresAt: new Date(rows[0].expiresAt).toISOString(),
  });
}

/**
 * Consume an attested proof on the caller's existing Prisma transaction. The
 * transition therefore commits or rolls back with tombstone creation/local
 * purge and cannot be consumed by a failed deletion attempt.
 */
export async function consumeAccountDeletionReauthChallenge(tx, {
  privyDid,
  sessionId,
  clientRequestId,
  challengeId,
  reauthProof,
  stableProviderIdentity,
  env = process.env,
  allowFoundationExecution = false,
}) {
  assertFoundationEnabled(env, allowFoundationExecution);
  if (!tx || typeof tx.$queryRawUnsafe !== 'function') {
    throw new TypeError('transaction client must support account-deletion reauth consumption');
  }
  const id = normalizedChallengeId(challengeId);
  const proof = normalizedOpaqueValue(reauthProof, 'proof');
  const bindings = challengeBindings({ privyDid, sessionId, clientRequestId, env });
  const identity = validatedStableAppleIdentity(stableProviderIdentity);
  const proofHash = digestOpaque('reauth-proof', proof);

  let rows;
  try {
    rows = await tx.$queryRawUnsafe(
      `UPDATE "AccountDeletionReauthChallenge"
         SET "status" = 'CONSUMED'::"AccountDeletionReauthStatus",
             "consumedAt" = CURRENT_TIMESTAMP,
             "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $1
         AND "status" = 'ATTESTED'::"AccountDeletionReauthStatus"
         AND "subjectHash" = $2
         AND "subjectHashKeyVersion" = $3
         AND "subjectHashKeyFingerprint" = $4
         AND "sessionHash" = $5
         AND "clientRequestHash" = $6
         AND "providerIdentityHash" = $7
         AND "proofHash" = $8
         AND "expiresAt" > CURRENT_TIMESTAMP
       RETURNING "consumedAt"`,
      id,
      bindings.subjectHash,
      bindings.subjectHashKeyVersion,
      bindings.subjectHashKeyFingerprint,
      bindings.sessionHash,
      bindings.clientRequestHash,
      identity.providerIdentityHash,
      proofHash,
    );
  } catch {
    fail('account_deletion_reauth_database_unavailable', 503);
  }
  if (!Array.isArray(rows) || rows.length !== 1) {
    fail('account_deletion_reauth_proof_invalid', 409);
  }
  return Object.freeze({
    challengeId: id,
    consumedAt: new Date(rows[0].consumedAt).toISOString(),
  });
}
