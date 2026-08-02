import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';

const SUBJECT_HASH_KEY_VERSION = 1;
const ENCRYPTION_KEY_VERSION = 1;
const CIPHERTEXT_VERSION = 'v1';
const DELETION_AAD_PREFIX = 'easygo-account-deletion:';
const SUBJECT_KEY_FINGERPRINT_CONTEXT = 'easygo-account-deletion-hmac-key-v1';

export const DELETE_ACCOUNT_CONFIRMATION = 'DELETE_MY_EASYGO_ACCOUNT';
// Compile-time release brake. Environment flags cannot expose destructive
// account deletion until the provider worker and durable mobile marker land
// in a separately reviewed change.
export const ACCOUNT_DELETION_ACTIVATION_READY = false;

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

function accountDeletionRequested(env = process.env) {
  return String(env.ACCOUNT_DELETION_ENABLED || '').trim().toLowerCase() === 'true';
}

function accountDeletionGuardRequired(env = process.env) {
  const deployTarget = String(env.EASYGO_DEPLOY_TARGET || '').trim().toLowerCase();
  return accountDeletionRequested(env)
    || String(env.NODE_ENV || '').trim().toLowerCase() === 'production'
    || deployTarget === 'staging'
    || deployTarget === 'production';
}

export function accountDeletionEnabled(env = process.env) {
  return ACCOUNT_DELETION_ACTIVATION_READY && accountDeletionRequested(env);
}

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

export async function findAccountDeletionRequest(
  prisma,
  privyDid,
  env = process.env,
  { required = accountDeletionGuardRequired(env) } = {},
) {
  const subjectHash = accountDeletionSubjectHash(privyDid, env, { required });
  if (!subjectHash) return null;
  return prisma.$transaction(async (tx) => {
    await assertAccountDeletionKeyFingerprint(tx, env);
    await acquireAccountDeletionLock(tx, subjectHash);
    return tx.accountDeletionRequest.findUnique({
      where: { subjectHash },
      select: {
        id: true,
        state: true,
        requestedAt: true,
        localPurgedAt: true,
        completedAt: true,
      },
    });
  });
}

export async function runWithAccountDeletionGuard({
  prisma,
  privyDid,
  env = process.env,
  operation,
}) {
  if (typeof operation !== 'function') throw new TypeError('operation is required');
  const subjectHash = accountDeletionSubjectHash(privyDid, env, {
    required: accountDeletionGuardRequired(env),
  });

  // Before the feature has ever been configured there can be no tombstone.
  // Preserve local/test compatibility; activation preflight requires the key.
  if (!subjectHash) return operation(prisma);

  return prisma.$transaction(async (tx) => {
    await assertAccountDeletionKeyFingerprint(tx, env);
    await acquireAccountDeletionLock(tx, subjectHash);
    const request = await tx.accountDeletionRequest.findUnique({
      where: { subjectHash },
      select: { id: true, state: true },
    });
    if (request) throw new AccountDeletionBlockedError(request);
    return operation(tx);
  });
}

export async function redactPostsByAuthor(tx, authorId, now = new Date()) {
  return tx.post.updateMany({
    where: { authorId },
    data: {
      authorId: null,
      body: '',
      mediaUrl: null,
      deletedAt: now,
    },
  });
}

export async function redactOwnedPost(prisma, { postId, authorId, now = new Date() }) {
  const result = await prisma.post.updateMany({
    where: { id: postId, authorId, deletedAt: null },
    data: {
      authorId: null,
      body: '',
      mediaUrl: null,
      deletedAt: now,
    },
  });
  return result.count === 1;
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

export async function requestAccountDeletion({
  prisma,
  privyDid,
  clientRequestId,
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

  return prisma.$transaction(async (tx) => {
    await assertAccountDeletionKeyFingerprint(tx, env);
    await acquireAccountDeletionLock(tx, subjectHash);
    let request = await tx.accountDeletionRequest.findUnique({ where: { subjectHash } });
    if (request && request.state !== 'REQUESTED') return deletionResult(request);

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
        },
      });
      created = true;
    }

    const user = await tx.user.findUnique({
      where: { privyDid: normalizedDid },
      select: { id: true },
    });
    let redactedPosts = 0;
    if (user) {
      const redacted = await redactPostsByAuthor(tx, user.id, now);
      redactedPosts = redacted.count;
      await tx.user.delete({ where: { id: user.id } });
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
