import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';
import {
  ACCOUNT_DELETION_PUBLIC_REQUEST_READY,
  accountDeletionGuardTarget,
  accountDeletionPublicRequestEnabled,
  accountDeletionStableIdentityGuardEnabled,
} from './account-deletion-gates.js';

const SUBJECT_HASH_KEY_VERSION = 1;
const ENCRYPTION_KEY_VERSION = 1;
const CIPHERTEXT_VERSION = 'v1';
const DELETION_AAD_PREFIX = 'easygo-account-deletion:';
const SUBJECT_KEY_FINGERPRINT_CONTEXT = 'easygo-account-deletion-hmac-key-v1';
const PROVIDER_IDENTITY_DIGEST_CONTEXT = 'easygo-account-deletion:stable-provider-identity:v1';

export const APPLE_STABLE_IDENTITY_PROVIDER = 'apple_oauth';
export const APPLE_STABLE_IDENTITY_CONTEXT = 'signin-with-apple.subject.v1';

export const DELETE_ACCOUNT_CONFIRMATION = 'DELETE_MY_EASYGO_ACCOUNT';
// Backwards-compatible name. The single source of truth lives with the other
// compile-time deletion release brakes.
export {
  ACCOUNT_DELETION_PUBLIC_REQUEST_READY as ACCOUNT_DELETION_ACTIVATION_READY,
};

export class AccountDeletionConfigurationError extends Error {
  constructor(code = 'account_deletion_not_configured') {
    super(code);
    this.name = 'AccountDeletionConfigurationError';
    this.code = code;
  }
}

export class AccountDeletionBlockedError extends Error {
  constructor(request = null) {
    super('account_deletion_in_progress');
    this.name = 'AccountDeletionBlockedError';
    this.code = 'account_deletion_in_progress';
    this.request = request;
  }
}

export class AccountDeletionIdentityError extends Error {
  constructor(code = 'stable_provider_identity_invalid') {
    super(code);
    this.name = 'AccountDeletionIdentityError';
    this.code = code;
  }
}

function accountDeletionGuardRequired(env = process.env) {
  return accountDeletionGuardTarget(env);
}

export function accountDeletionStableIdentityEnforced(env = process.env) {
  return accountDeletionStableIdentityGuardEnabled(env);
}

export const accountDeletionEnabled = accountDeletionPublicRequestEnabled;

function normalizedPrivyDid(privyDid) {
  const normalized = typeof privyDid === 'string' ? privyDid.trim() : '';
  if (!normalized) throw new TypeError('privyDid is required');
  return normalized;
}

function clean(value) {
  return String(value || '').trim();
}

function subjectHashKey(env, { required = accountDeletionGuardRequired(env) } = {}) {
  const value = clean(env.ACCOUNT_DELETION_SUBJECT_HMAC_KEY);
  if (!value) {
    if (required) throw new AccountDeletionConfigurationError('account_deletion_hash_key_missing');
    return null;
  }
  if (Buffer.byteLength(value, 'utf8') < 32) {
    throw new AccountDeletionConfigurationError('account_deletion_hash_key_invalid');
  }
  return value;
}

function encryptionKey(env) {
  const encoded = clean(env.ACCOUNT_DELETION_ENCRYPTION_KEY);
  if (!encoded) {
    throw new AccountDeletionConfigurationError('account_deletion_encryption_key_missing');
  }
  let key;
  try {
    key = Buffer.from(encoded, 'base64');
  } catch {
    throw new AccountDeletionConfigurationError('account_deletion_encryption_key_invalid');
  }
  if (key.length !== 32 || key.toString('base64').replace(/=+$/u, '') !== encoded.replace(/=+$/u, '')) {
    throw new AccountDeletionConfigurationError('account_deletion_encryption_key_invalid');
  }
  return key;
}

export function accountDeletionSubjectHash(privyDid, env = process.env, options = {}) {
  const key = subjectHashKey(env, options);
  if (!key) return null;
  return createHmac('sha256', key).update(normalizedPrivyDid(privyDid), 'utf8').digest('hex');
}

function normalizedIdentityNamespace(value, name, maxLength) {
  const normalized = typeof value === 'string' ? value : '';
  const pattern = name === 'provider'
    ? /^[a-z][a-z0-9_:-]*$/u
    : /^[a-z0-9][a-z0-9._:/-]*$/u;
  if (
    !normalized
    || normalized !== normalized.trim()
    || normalized.length > maxLength
    || !pattern.test(normalized)
  ) {
    throw new AccountDeletionIdentityError(`stable_provider_${name}_invalid`);
  }
  return normalized;
}

function normalizedProviderSubject(subject) {
  if (
    typeof subject !== 'string'
    || subject.length === 0
    || subject.length > 2048
    || subject !== subject.trim()
  ) {
    throw new AccountDeletionIdentityError('stable_provider_subject_invalid');
  }
  return subject;
}

/**
 * Derive a provider-generic stable identity without retaining the raw subject.
 * provider + context are part of the authenticated input, so equal raw values
 * in different identity systems cannot collide into the same namespace.
 */
export function deriveStableProviderIdentity(
  { provider, context, subject },
  env = process.env,
  options = {},
) {
  const normalizedProvider = normalizedIdentityNamespace(provider, 'provider', 64);
  const normalizedContext = normalizedIdentityNamespace(context, 'context', 128);
  const normalizedSubject = normalizedProviderSubject(subject);
  const key = subjectHashKey(env, options);
  if (!key) return null;
  const providerIdentityHash = createHmac('sha256', key)
    .update(PROVIDER_IDENTITY_DIGEST_CONTEXT, 'utf8')
    .update('\0', 'utf8')
    .update(normalizedProvider, 'utf8')
    .update('\0', 'utf8')
    .update(normalizedContext, 'utf8')
    .update('\0', 'utf8')
    .update(normalizedSubject, 'utf8')
    .digest('hex');
  return Object.freeze({
    provider: normalizedProvider,
    context: normalizedContext,
    providerIdentityHash,
  });
}

export function deriveAppleStableProviderIdentity(
  appleSubject,
  env = process.env,
  options = {},
) {
  if (appleSubject == null) return null;
  return deriveStableProviderIdentity({
    provider: APPLE_STABLE_IDENTITY_PROVIDER,
    context: APPLE_STABLE_IDENTITY_CONTEXT,
    subject: appleSubject,
  }, env, options);
}

export function accountDeletionSubjectKeyFingerprint(env = process.env, options = {}) {
  const key = subjectHashKey(env, options);
  if (!key) return null;
  return createHmac('sha256', key)
    .update(SUBJECT_KEY_FINGERPRINT_CONTEXT, 'utf8')
    .digest('hex');
}

function deletionAad(subjectHash) {
  return Buffer.from(`${DELETION_AAD_PREFIX}${subjectHash}`, 'utf8');
}

export function encryptAccountDeletionSubject(
  privyDid,
  subjectHash,
  env = process.env,
  { bytes = randomBytes } = {},
) {
  if (!/^[a-f0-9]{64}$/u.test(String(subjectHash || ''))) {
    throw new TypeError('subjectHash must be a lowercase SHA-256 digest');
  }
  const key = encryptionKey(env);
  const iv = bytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(deletionAad(subjectHash));
  const ciphertext = Buffer.concat([
    cipher.update(normalizedPrivyDid(privyDid), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    CIPHERTEXT_VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptAccountDeletionSubject(value, subjectHash, env = process.env) {
  const [version, ivValue, tagValue, ciphertextValue, extra] = String(value || '').split('.');
  if (version !== CIPHERTEXT_VERSION || !ivValue || !tagValue || !ciphertextValue || extra) {
    throw new AccountDeletionConfigurationError('account_deletion_ciphertext_invalid');
  }
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(env),
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAAD(deletionAad(subjectHash));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (error) {
    if (error instanceof AccountDeletionConfigurationError) throw error;
    throw new AccountDeletionConfigurationError('account_deletion_ciphertext_invalid');
  }
}

export async function acquireAccountDeletionLock(tx, subjectHash) {
  if (!tx || typeof tx.$queryRawUnsafe !== 'function') {
    throw new TypeError('transaction client must support account-deletion advisory locks');
  }
  await tx.$queryRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0)) IS NULL AS "lockAcquired"',
    subjectHash,
  );
}

function validatedStableProviderIdentities(values = []) {
  if (!Array.isArray(values)) {
    throw new AccountDeletionIdentityError('stable_provider_identities_invalid');
  }
  const identities = [];
  const byNamespace = new Map();
  for (const value of values) {
    const provider = normalizedIdentityNamespace(value?.provider, 'provider', 64);
    const context = normalizedIdentityNamespace(value?.context, 'context', 128);
    const providerIdentityHash = String(value?.providerIdentityHash || '');
    if (!/^[a-f0-9]{64}$/u.test(providerIdentityHash)) {
      throw new AccountDeletionIdentityError('stable_provider_identity_hash_invalid');
    }
    const namespace = `${provider}\0${context}`;
    const previous = byNamespace.get(namespace);
    if (previous && previous.providerIdentityHash !== providerIdentityHash) {
      throw new AccountDeletionIdentityError('stable_provider_identity_conflict');
    }
    if (!previous) {
      const identity = Object.freeze({ provider, context, providerIdentityHash });
      byNamespace.set(namespace, identity);
      identities.push(identity);
    }
  }
  return identities.sort((left, right) => (
    `${left.provider}\0${left.context}\0${left.providerIdentityHash}`
      .localeCompare(`${right.provider}\0${right.context}\0${right.providerIdentityHash}`)
  ));
}

function stableProviderIdentityWhere(identity) {
  return {
    provider: identity.provider,
    context: identity.context,
    providerIdentityHash: identity.providerIdentityHash,
  };
}

function stableProviderIdentityLockKey(identity) {
  return `provider:${identity.provider}:${identity.context}:${identity.providerIdentityHash}`;
}

export async function acquireAccountDeletionLocks(
  tx,
  subjectHash,
  stableProviderIdentities = [],
) {
  const lockKeys = [
    subjectHash,
    ...validatedStableProviderIdentities(stableProviderIdentities)
      .map(stableProviderIdentityLockKey),
  ].filter(Boolean);
  const uniqueSorted = [...new Set(lockKeys)].sort();
  for (const lockKey of uniqueSorted) {
    await acquireAccountDeletionLock(tx, lockKey);
  }
}

async function assertAccountDeletionKeyFingerprint(tx, env) {
  const configuredFingerprint = accountDeletionSubjectKeyFingerprint(env, { required: true });
  await tx.accountDeletionKeyRegistry.createMany({
    data: [{
      keyVersion: SUBJECT_HASH_KEY_VERSION,
      fingerprint: configuredFingerprint,
    }],
    skipDuplicates: true,
  });
  const stored = await tx.accountDeletionKeyRegistry.findUnique({
    where: { keyVersion: SUBJECT_HASH_KEY_VERSION },
    select: { fingerprint: true },
  });
  if (!stored || stored.fingerprint !== configuredFingerprint) {
    throw new AccountDeletionConfigurationError('account_deletion_hash_key_mismatch');
  }
  return configuredFingerprint;
}


const DELETION_REQUEST_STATUS_SELECT = Object.freeze({
  id: true,
  subjectHash: true,
  state: true,
  requestedAt: true,
  localPurgedAt: true,
  completedAt: true,
});

async function findRequestByStableIdentities(tx, stableProviderIdentities, select) {
  const identities = validatedStableProviderIdentities(stableProviderIdentities);
  if (identities.length === 0) return null;
  const rows = await tx.accountDeletionProviderIdentity.findMany({
    where: { OR: identities.map(stableProviderIdentityWhere) },
    select: { request: { select } },
  });
  const requests = rows.map((row) => row.request).filter(Boolean);
  const requestIds = new Set(requests.map((request) => request.id));
  if (requestIds.size > 1) {
    throw new AccountDeletionIdentityError('stable_provider_tombstone_conflict');
  }
  return requests[0] || null;
}

async function findRequestUnderLock(
  tx,
  subjectHash,
  stableProviderIdentities,
  select = DELETION_REQUEST_STATUS_SELECT,
) {
  const didRequest = await tx.accountDeletionRequest.findUnique({
    where: { subjectHash },
    select,
  });
  const providerRequest = await findRequestByStableIdentities(
    tx,
    stableProviderIdentities,
    select,
  );
  if (didRequest && providerRequest && didRequest.id !== providerRequest.id) {
    throw new AccountDeletionIdentityError('stable_provider_tombstone_conflict');
  }
  return didRequest || providerRequest;
}

export async function findAccountDeletionRequest(
  prisma,
  privyDid,
  env = process.env,
  {
    required = accountDeletionGuardRequired(env),
    stableProviderIdentities = [],
  } = {},
) {
  const subjectHash = accountDeletionSubjectHash(privyDid, env, { required });
  if (!subjectHash) return null;
  const identities = validatedStableProviderIdentities(stableProviderIdentities);
  return prisma.$transaction(async (tx) => {
    await assertAccountDeletionKeyFingerprint(tx, env);
    await acquireAccountDeletionLocks(tx, subjectHash, identities);
    return findRequestUnderLock(
      tx,
      subjectHash,
      identities,
      DELETION_REQUEST_STATUS_SELECT,
    );
  });
}

export async function runWithAccountDeletionGuard({
  prisma,
  privyDid,
  stableProviderIdentities = [],
  env = process.env,
  operation,
}) {
  if (typeof operation !== 'function') throw new TypeError('operation is required');
  const identities = validatedStableProviderIdentities(stableProviderIdentities);
  const subjectHash = accountDeletionSubjectHash(privyDid, env, {
    required: accountDeletionGuardRequired(env),
  });

  // Before the feature has ever been configured there can be no tombstone.
  // Preserve local/test compatibility; activation preflight requires the key.
  if (!subjectHash) return operation(prisma);

  return prisma.$transaction(async (tx) => {
    const keyFingerprint = await assertAccountDeletionKeyFingerprint(tx, env);
    await acquireAccountDeletionLocks(tx, subjectHash, identities);
    const request = await findRequestUnderLock(
      tx,
      subjectHash,
      identities,
      { id: true, state: true },
    );
    if (request) throw new AccountDeletionBlockedError(request);
    return operation(tx, {
      subjectHash,
      stableProviderIdentities: identities,
      keyFingerprint,
      keyVersion: SUBJECT_HASH_KEY_VERSION,
    });
  });
}

/**
 * Bind the currently verified upstream identities to a local User. Existing
 * bindings are immutable: omission or replacement of an already stored
 * identity fails closed instead of silently weakening deletion recovery.
 */
export async function reconcileUserStableProviderIdentities(tx, {
  userId,
  stableProviderIdentities = [],
  expectedNamespaces = [],
  keyFingerprint,
  keyVersion = SUBJECT_HASH_KEY_VERSION,
  requireIdentity = false,
}) {
  const identities = validatedStableProviderIdentities(stableProviderIdentities);
  if (requireIdentity && identities.length === 0) {
    throw new AccountDeletionIdentityError('stable_provider_identity_required');
  }
  const namespaces = new Map();
  for (const identity of identities) {
    namespaces.set(`${identity.provider}\0${identity.context}`, {
      provider: identity.provider,
      context: identity.context,
    });
  }
  for (const value of expectedNamespaces) {
    const provider = normalizedIdentityNamespace(value?.provider, 'provider', 64);
    const context = normalizedIdentityNamespace(value?.context, 'context', 128);
    namespaces.set(`${provider}\0${context}`, { provider, context });
  }
  if (namespaces.size === 0) return [];

  const existing = await tx.userStableProviderIdentity.findMany({
    where: {
      userId,
      OR: [...namespaces.values()],
    },
    select: { provider: true, context: true, providerIdentityHash: true },
  });
  const incomingByNamespace = new Map(
    identities.map((identity) => [`${identity.provider}\0${identity.context}`, identity]),
  );
  const existingByNamespace = new Map(
    existing.map((identity) => [`${identity.provider}\0${identity.context}`, identity]),
  );

  for (const [namespace, stored] of existingByNamespace) {
    const incoming = incomingByNamespace.get(namespace);
    if (!incoming) {
      throw new AccountDeletionIdentityError('stable_provider_identity_missing');
    }
    if (stored.providerIdentityHash !== incoming.providerIdentityHash) {
      throw new AccountDeletionIdentityError('stable_provider_identity_conflict');
    }
  }

  const created = [];
  for (const [namespace, incoming] of incomingByNamespace) {
    if (existingByNamespace.has(namespace)) continue;
    try {
      created.push(await tx.userStableProviderIdentity.create({
        data: {
          userId,
          ...incoming,
          keyVersion,
          keyFingerprint,
        },
      }));
    } catch (error) {
      if (error?.code === 'P2002') {
        throw new AccountDeletionIdentityError('stable_provider_identity_conflict');
      }
      throw error;
    }
  }
  return [...existing, ...created];
}

export async function redactPostsByAuthor(tx, authorId, now = new Date()) {
  // The volatile advisory-lock function is evaluated in deterministic post-ID
  // order. This serializes account purge with edit, report creation, owner
  // deletion, and moderation for every affected post without exporting IDs.
  await tx.$queryRawUnsafe(
    `SELECT pg_advisory_xact_lock(
       hashtextextended('post-report-target:' || "id", 0)
     ) IS NULL AS "lockAcquired"
     FROM "Post"
     WHERE "authorId" = $1
     ORDER BY "id"`,
    authorId,
  );
  return tx.post.updateMany({
    where: { authorId },
    data: {
      authorId: null,
      body: '',
      mediaUrl: null,
      deletedAt: now,
      contentRevision: { increment: 1 },
    },
  });
}

export async function redactOwnedPost(prisma, { postId, authorId, now = new Date() }) {
  return prisma.$transaction(async (tx) => {
    // Serialize ordinary owner deletion with report creation and moderation.
    // A reporter can therefore never observe a live post and insert a new OPEN
    // report after this redaction has committed.
    await tx.$queryRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0)) IS NULL AS "lockAcquired"',
      `post-report-target:${postId}`,
    );
    const result = await tx.post.updateMany({
      where: { id: postId, authorId, deletedAt: null },
      data: {
        authorId: null,
        body: '',
        mediaUrl: null,
        deletedAt: now,
        contentRevision: { increment: 1 },
      },
    });
    return result.count === 1;
  });
}

function deletionResult(request, { created = false, redactedPosts = 0 } = {}) {
  return {
    requestId: request.id,
    state: request.state,
    created,
    localDataDeleted: Boolean(request.localPurgedAt),
    providerDeletionPending: request.state !== 'COMPLETED',
    redactedPosts,
  };
}

async function ensureDeletionProviderIdentities(
  tx,
  requestId,
  stableProviderIdentities,
  keyFingerprint,
) {
  const identities = validatedStableProviderIdentities(stableProviderIdentities);
  if (identities.length === 0) {
    throw new AccountDeletionIdentityError('stable_provider_identity_required');
  }
  const existing = await tx.accountDeletionProviderIdentity.findMany({
    where: { OR: identities.map(stableProviderIdentityWhere) },
    select: {
      accountDeletionRequestId: true,
      provider: true,
      context: true,
      providerIdentityHash: true,
    },
  });
  const existingByNamespace = new Map(
    existing.map((identity) => [`${identity.provider}\0${identity.context}`, identity]),
  );
  for (const identity of identities) {
    const namespace = `${identity.provider}\0${identity.context}`;
    const stored = existingByNamespace.get(namespace);
    if (stored && (
      stored.accountDeletionRequestId !== requestId
      || stored.providerIdentityHash !== identity.providerIdentityHash
    )) {
      throw new AccountDeletionIdentityError('stable_provider_tombstone_conflict');
    }
    if (stored) continue;
    try {
      await tx.accountDeletionProviderIdentity.create({
        data: {
          accountDeletionRequestId: requestId,
          ...identity,
          keyVersion: SUBJECT_HASH_KEY_VERSION,
          keyFingerprint,
        },
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        throw new AccountDeletionIdentityError('stable_provider_tombstone_conflict');
      }
      throw error;
    }
  }
}

function identityNamespaceKey(identity) {
  return `${identity.provider}\0${identity.context}\0${identity.providerIdentityHash}`;
}

async function usersInStableIdentityComponent(
  tx,
  privyDid,
  stableProviderIdentities,
) {
  const identities = validatedStableProviderIdentities(stableProviderIdentities);
  const users = await tx.user.findMany({
    where: {
      OR: [
        { privyDid },
        {
          stableProviderIdentities: {
            some: { OR: identities.map(stableProviderIdentityWhere) },
          },
        },
      ],
    },
    select: {
      id: true,
      privyDid: true,
      stableProviderIdentities: {
        select: { provider: true, context: true, providerIdentityHash: true },
      },
    },
  });
  const lockedIdentities = new Set(identities.map(identityNamespaceKey));
  const closureComplete = users.every((user) => (
    user.stableProviderIdentities.every((identity) => (
      lockedIdentities.has(identityNamespaceKey(identity))
    ))
  ));
  return { users, closureComplete };
}

async function assertCurrentUserStableProviderIdentity(
  tx,
  privyDid,
  identity,
) {
  const user = await tx.user.findUnique({
    where: { privyDid },
    select: {
      id: true,
      stableProviderIdentities: {
        where: {
          provider: identity.provider,
          context: identity.context,
        },
        select: {
          provider: true,
          context: true,
          providerIdentityHash: true,
        },
      },
    },
  });
  const stored = user?.stableProviderIdentities?.[0];
  if (!user || !stored) {
    throw new AccountDeletionIdentityError('stable_provider_identity_missing');
  }
  if (stored.providerIdentityHash !== identity.providerIdentityHash) {
    throw new AccountDeletionIdentityError('stable_provider_identity_conflict');
  }
  return user;
}

export async function requestAccountDeletion({
  prisma,
  privyDid,
  appleSubject = null,
  stableProviderIdentities = [],
  clientRequestId,
  recentAuth = null,
  consumeRecentAuth = null,
  env = process.env,
  now = new Date(),
  allowFoundationExecution = false,
}) {
  if (!allowFoundationExecution && !accountDeletionEnabled(env)) {
    const error = new Error('account_deletion_disabled');
    error.code = 'account_deletion_disabled';
    throw error;
  }

  const normalizedDid = normalizedPrivyDid(privyDid);
  const subjectHash = accountDeletionSubjectHash(normalizedDid, env, { required: true });
  const subjectHashKeyFingerprint = accountDeletionSubjectKeyFingerprint(env, { required: true });
  const privyDidCiphertext = encryptAccountDeletionSubject(normalizedDid, subjectHash, env);
  const appleIdentity = deriveAppleStableProviderIdentity(
    appleSubject,
    env,
    { required: true },
  );
  const identities = validatedStableProviderIdentities([
    ...stableProviderIdentities,
    ...(appleIdentity ? [appleIdentity] : []),
  ]);
  if (identities.length === 0) {
    throw new AccountDeletionIdentityError('stable_provider_identity_required');
  }
  const appleStableIdentity = identities.find((identity) => (
    identity.provider === APPLE_STABLE_IDENTITY_PROVIDER
    && identity.context === APPLE_STABLE_IDENTITY_CONTEXT
  ));

  return prisma.$transaction(async (tx) => {
    await assertAccountDeletionKeyFingerprint(tx, env);
    await acquireAccountDeletionLocks(tx, subjectHash, identities);
    let request = await findRequestUnderLock(tx, subjectHash, identities, undefined);
    if (request && request.subjectHash !== subjectHash) {
      throw new AccountDeletionIdentityError('stable_provider_identity_component_conflict');
    }

    // A committed tombstone is the recovery authority. Lost-response retries
    // must remain recoverable after the one-time recent-auth proof was consumed
    // and even after the upstream Privy account no longer exists.
    if (!request) {
      if (!appleStableIdentity) {
        throw new AccountDeletionIdentityError('stable_provider_identity_required');
      }
      // The interactive Apple proof must match the immutable identity already
      // owned by this exact local User. Never backfill or replace a mapping in
      // the deletion transaction: legacy/unmapped and relinked accounts fail
      // closed before the one-time proof is consumed or any content is purged.
      await assertCurrentUserStableProviderIdentity(
        tx,
        normalizedDid,
        appleStableIdentity,
      );
      if (typeof consumeRecentAuth !== 'function') {
        throw new AccountDeletionConfigurationError(
          'account_deletion_recent_auth_not_configured',
        );
      }
      await consumeRecentAuth(tx, {
        privyDid: normalizedDid,
        subjectHash,
        sessionId: recentAuth?.sessionId,
        clientRequestId,
        challengeId: recentAuth?.challengeId,
        reauthProof: recentAuth?.reauthProof,
        stableProviderIdentity: appleStableIdentity,
        env,
      });
    }

    // Never auto-delete a second Privy principal (the provider worker only has
    // this request's encrypted DID), and never leave another stable identity
    // in the connected component untombstoned. The deletion intent is still
    // durably recorded below as MANUAL_REVIEW, but no local content is purged.
    const { users, closureComplete } = await usersInStableIdentityComponent(
      tx,
      normalizedDid,
      identities,
    );
    const hasAdditionalPrivyDid = users.some((user) => user.privyDid !== normalizedDid);
    const identityComponentConflict = !closureComplete || hasAdditionalPrivyDid;

    let created = false;
    if (!request) {
      request = await tx.accountDeletionRequest.create({
        data: {
          subjectHash,
          subjectHashKeyVersion: SUBJECT_HASH_KEY_VERSION,
          subjectHashKeyFingerprint,
          privyDidCiphertext,
          encryptionKeyVersion: ENCRYPTION_KEY_VERSION,
          clientRequestId,
          state: 'REQUESTED',
          ...(recentAuth?.challengeId
            ? { recentAuthChallengeId: recentAuth.challengeId }
            : {}),
        },
      });
      created = true;
    }

    // This durable mapping is written before any local purge. A new Privy DID
    // with the same upstream identity is therefore blocked even if the active
    // User row and its live identity binding are removed below.
    await ensureDeletionProviderIdentities(
      tx,
      request.id,
      identities,
      subjectHashKeyFingerprint,
    );
    if (identityComponentConflict) {
      if (request.state !== 'REQUESTED') {
        throw new AccountDeletionIdentityError('stable_provider_identity_component_conflict');
      }
      request = await tx.accountDeletionRequest.update({
        where: { id: request.id },
        data: {
          state: 'MANUAL_REVIEW',
          stateVersion: { increment: 1 },
          manualReviewAt: now,
          lastErrorAt: now,
          lastErrorCode: hasAdditionalPrivyDid
            ? 'stable_identity_additional_privy_did'
            : 'stable_identity_component_incomplete',
          nextAttemptAt: null,
        },
      });
      return deletionResult(request, { created });
    }
    if (request.state !== 'REQUESTED') return deletionResult(request);

    let redactedPosts = 0;
    for (const user of users) {
      const redacted = await redactPostsByAuthor(tx, user.id, now);
      redactedPosts += redacted.count;
    }
    if (users.length > 0) {
      await tx.user.deleteMany({
        where: { id: { in: users.map((user) => user.id) } },
      });
    }

    request = await tx.accountDeletionRequest.update({
      where: { id: request.id },
      data: {
        state: 'LOCAL_PURGED',
        stateVersion: { increment: 1 },
        localPurgedAt: now,
        nextAttemptAt: now,
      },
    });
    return deletionResult(request, { created, redactedPosts });
  });
}
