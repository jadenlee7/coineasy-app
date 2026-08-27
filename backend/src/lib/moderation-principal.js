export const MODERATION_AUTH_METHOD = 'workforce_oidc';

export const MODERATION_CAPABILITIES = Object.freeze({
  QUEUE_READ: 'queue.read',
  REPORT_CLAIM: 'report.claim',
  REPORT_DECIDE: 'report.decide',
  CONTENT_REMOVE: 'content.remove',
  AUDIT_READ: 'audit.read',
  ACCESS_ADMIN: 'access.admin',
});

export const MODERATION_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const MODERATION_MFA_MAX_AGE_SECONDS = 8 * 60 * 60;
export const MODERATION_DESTRUCTIVE_MFA_MAX_AGE_SECONDS = 15 * 60;

const ACTOR_ID_PATTERN = /^wf_[A-Za-z0-9_-]{22,60}$/u;
const PRINCIPAL_KEYS = Object.freeze([
  'actorId',
  'authMethod',
  'capabilities',
  'expiresAt',
  'issuedAt',
  'mfaAuthenticatedAt',
  'mfaVerified',
].sort());
const VALIDATION_OPTION_KEYS = Object.freeze([
  'clockSkewSeconds',
  'maxMfaAgeSeconds',
  'maxSessionAgeSeconds',
  'now',
].sort());
const KNOWN_CAPABILITIES = new Set(Object.values(MODERATION_CAPABILITIES));

export class ModerationPrincipalError extends Error {
  constructor() {
    super('moderation principal is invalid');
    this.name = 'ModerationPrincipalError';
  }
}

function invalid() {
  throw new ModerationPrincipalError();
}

function assertStrictObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== 'string')) invalid();
  const keys = ownKeys.sort();
  if (
    keys.length !== PRINCIPAL_KEYS.length
    || keys.some((key, index) => key !== PRINCIPAL_KEYS[index])
  ) {
    invalid();
  }
}

function normalizeCapabilities(value) {
  if (!Array.isArray(value) || value.length > KNOWN_CAPABILITIES.size) invalid();
  const unique = new Set();
  for (const capability of value) {
    if (
      typeof capability !== 'string'
      || !KNOWN_CAPABILITIES.has(capability)
      || unique.has(capability)
    ) {
      invalid();
    }
    unique.add(capability);
  }
  return Object.freeze([...unique].sort());
}

function normalizeValidationOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) invalid();
  const ownKeys = Reflect.ownKeys(options);
  if (ownKeys.some((key) => typeof key !== 'string')) invalid();
  const keys = ownKeys.sort();
  if (keys.some((key) => !VALIDATION_OPTION_KEYS.includes(key))) invalid();

  const normalized = {
    clockSkewSeconds: Object.hasOwn(options, 'clockSkewSeconds')
      ? options.clockSkewSeconds
      : 60,
    maxMfaAgeSeconds: Object.hasOwn(options, 'maxMfaAgeSeconds')
      ? options.maxMfaAgeSeconds
      : MODERATION_MFA_MAX_AGE_SECONDS,
    maxSessionAgeSeconds: Object.hasOwn(options, 'maxSessionAgeSeconds')
      ? options.maxSessionAgeSeconds
      : MODERATION_SESSION_MAX_AGE_SECONDS,
    now: Object.hasOwn(options, 'now') ? options.now : Date.now,
  };
  if (
    typeof normalized.now !== 'function'
    || !Number.isSafeInteger(normalized.maxSessionAgeSeconds)
    || normalized.maxSessionAgeSeconds < 300
    || normalized.maxSessionAgeSeconds > MODERATION_SESSION_MAX_AGE_SECONDS
    || !Number.isSafeInteger(normalized.maxMfaAgeSeconds)
    || normalized.maxMfaAgeSeconds < 60
    || normalized.maxMfaAgeSeconds > MODERATION_MFA_MAX_AGE_SECONDS
    || !Number.isSafeInteger(normalized.clockSkewSeconds)
    || normalized.clockSkewSeconds < 0
    || normalized.clockSkewSeconds > 300
  ) {
    invalid();
  }
  return normalized;
}

function nowEpochSeconds(now) {
  let value;
  try {
    value = now();
  } catch {
    invalid();
  }
  if (!Number.isFinite(value)) invalid();
  const seconds = Math.floor(value / 1_000);
  if (!Number.isSafeInteger(seconds)) invalid();
  return seconds;
}

export function validateModerationPrincipal(value, options = {}) {
  assertStrictObject(value);
  const {
    clockSkewSeconds,
    maxMfaAgeSeconds,
    maxSessionAgeSeconds,
    now,
  } = normalizeValidationOptions(options);
  if (
    value.authMethod !== MODERATION_AUTH_METHOD
    || value.mfaVerified !== true
    || typeof value.actorId !== 'string'
    || !ACTOR_ID_PATTERN.test(value.actorId)
    || !Number.isSafeInteger(value.expiresAt)
    || !Number.isSafeInteger(value.issuedAt)
    || !Number.isSafeInteger(value.mfaAuthenticatedAt)
  ) {
    invalid();
  }

  const currentTime = nowEpochSeconds(now);
  if (
    value.issuedAt > currentTime + clockSkewSeconds
    || value.mfaAuthenticatedAt > currentTime + clockSkewSeconds
    || value.mfaAuthenticatedAt > value.issuedAt + clockSkewSeconds
    || value.expiresAt <= currentTime
    || value.expiresAt <= value.issuedAt
    || value.mfaAuthenticatedAt >= value.expiresAt
    || value.expiresAt - value.issuedAt > maxSessionAgeSeconds
    || currentTime - value.issuedAt > maxSessionAgeSeconds
    || currentTime - value.mfaAuthenticatedAt > maxMfaAgeSeconds
  ) {
    invalid();
  }

  return Object.freeze({
    actorId: value.actorId,
    authMethod: value.authMethod,
    capabilities: normalizeCapabilities(value.capabilities),
    expiresAt: value.expiresAt,
    issuedAt: value.issuedAt,
    mfaAuthenticatedAt: value.mfaAuthenticatedAt,
    mfaVerified: true,
  });
}
