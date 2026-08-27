import {
  ModerationWorkforceOidcConfigError,
  ModerationWorkforceOidcTokenError,
  ModerationWorkforceOidcUnavailableError,
  MODERATION_WORKFORCE_TOKEN_MAX_LENGTH,
} from '../lib/moderation-workforce-oidc.js';
import {
  MODERATION_AUTH_METHOD,
  ModerationPrincipalError,
  validateModerationPrincipal,
} from '../lib/moderation-principal.js';

const ACCESS_KEYS = Object.freeze(['actorId', 'capabilities'].sort());
const IDENTITY_KEYS = Object.freeze([
  'expiresAt',
  'issuedAt',
  'issuer',
  'mfaAuthenticatedAt',
  'mfaVerified',
  'roleIds',
  'subject',
].sort());
const ROLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/u;
const SUBJECT_PATTERN = /^[\x21-\x7E]{1,255}$/u;
const ACCESS_TIMEOUT_DEFAULT_MS = 4_000;
const ACCESS_TIMEOUT_MAX_MS = 10_000;

export class ModerationWorkforceAccessConfigError extends Error {
  constructor() {
    super('moderation workforce access configuration is invalid');
    this.name = 'ModerationWorkforceAccessConfigError';
  }
}

export class ModerationWorkforceAccessUnavailableError extends Error {
  constructor() {
    super('moderation workforce access resolution is unavailable');
    this.name = 'ModerationWorkforceAccessUnavailableError';
  }
}

function errorType(error) {
  if (error instanceof ModerationWorkforceOidcUnavailableError) {
    return 'ModerationWorkforceOidcUnavailableError';
  }
  if (error instanceof ModerationWorkforceAccessUnavailableError) {
    return 'ModerationWorkforceAccessUnavailableError';
  }
  return 'ModerationWorkforceDependencyError';
}

function logUnavailable(req, error) {
  try {
    req.log?.error?.(
      { errorType: errorType(error) },
      'moderation workforce authentication failed',
    );
  } catch {
    // Authentication remains fail-closed when logging is unavailable.
  }
}

function send(res, status, error) {
  return res.status(status).json({ error });
}

function bearerToken(req) {
  const header = req?.headers?.authorization;
  if (typeof header !== 'string' || header.length > MODERATION_WORKFORCE_TOKEN_MAX_LENGTH + 16) {
    return null;
  }
  const match = header.match(/^Bearer\s+([^\s]+)$/iu);
  return match && match[1].length <= MODERATION_WORKFORCE_TOKEN_MAX_LENGTH
    ? match[1]
    : null;
}

function strictAccess(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ModerationWorkforceAccessConfigError();
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== 'string')) {
    throw new ModerationWorkforceAccessConfigError();
  }
  const sorted = ownKeys.sort();
  if (
    sorted.length !== ACCESS_KEYS.length
    || sorted.some((key, index) => key !== ACCESS_KEYS[index])
  ) {
    throw new ModerationWorkforceAccessConfigError();
  }
  return value;
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== 'string')) return false;
  const sorted = ownKeys.sort();
  return sorted.length === expected.length
    && sorted.every((key, index) => key === expected[index]);
}

function strictIdentity(value) {
  if (!exactKeys(value, IDENTITY_KEYS)) {
    throw new ModerationWorkforceAccessConfigError();
  }
  if (
    typeof value.issuer !== 'string'
    || value.issuer.length < 8
    || value.issuer.length > 2_048
    || value.issuer !== value.issuer.trim()
  ) {
    throw new ModerationWorkforceAccessConfigError();
  }
  let issuer;
  try {
    issuer = new URL(value.issuer);
  } catch {
    throw new ModerationWorkforceAccessConfigError();
  }
  if (
    issuer.protocol !== 'https:'
    || !issuer.hostname
    || issuer.username
    || issuer.password
    || issuer.search
    || issuer.hash
    || typeof value.subject !== 'string'
    || !SUBJECT_PATTERN.test(value.subject)
    || !Number.isSafeInteger(value.expiresAt)
    || !Number.isSafeInteger(value.issuedAt)
    || !Number.isSafeInteger(value.mfaAuthenticatedAt)
    || value.mfaVerified !== true
    || !Array.isArray(value.roleIds)
    || value.roleIds.length > 32
    || value.roleIds.some((roleId) => (
      typeof roleId !== 'string' || !ROLE_ID_PATTERN.test(roleId)
    ))
    || new Set(value.roleIds).size !== value.roleIds.length
  ) {
    throw new ModerationWorkforceAccessConfigError();
  }
  return Object.freeze({
    expiresAt: value.expiresAt,
    issuedAt: value.issuedAt,
    issuer: value.issuer,
    mfaAuthenticatedAt: value.mfaAuthenticatedAt,
    mfaVerified: true,
    roleIds: Object.freeze([...value.roleIds].sort()),
    subject: value.subject,
  });
}

async function withDependencyTimeout(operation, timeoutMs, createUnavailableError) {
  const controller = new AbortController();
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(createUnavailableError());
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      timeout,
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export function createModerationWorkforceAuth({
  dependencyTimeoutMs = ACCESS_TIMEOUT_DEFAULT_MS,
  now = Date.now,
  resolveAccess,
  verifyToken,
} = {}) {
  if (
    typeof now !== 'function'
    || typeof resolveAccess !== 'function'
    || typeof verifyToken !== 'function'
    || !Number.isSafeInteger(dependencyTimeoutMs)
    || dependencyTimeoutMs < 10
    || dependencyTimeoutMs > ACCESS_TIMEOUT_MAX_MS
  ) {
    throw new TypeError('moderation workforce authentication dependencies are required');
  }

  return async function moderationWorkforceAuth(req, res, next) {
    const token = bearerToken(req);
    if (!token) return send(res, 401, 'invalid_moderation_identity');

    let identity;
    try {
      identity = await withDependencyTimeout(
        (signal) => verifyToken(token, Object.freeze({ signal })),
        dependencyTimeoutMs,
        () => new ModerationWorkforceOidcUnavailableError(),
      );
    } catch (error) {
      if (error instanceof ModerationWorkforceOidcTokenError) {
        return send(res, 401, 'invalid_moderation_identity');
      }
      if (error instanceof ModerationWorkforceOidcConfigError) {
        return send(res, 503, 'moderation_auth_unconfigured');
      }
      if (error instanceof ModerationWorkforceOidcUnavailableError) {
        logUnavailable(req, error);
        return send(res, 503, 'moderation_auth_unavailable');
      }
      logUnavailable(req, error);
      return send(res, 503, 'moderation_auth_unavailable');
    }

    let normalizedIdentity;
    try {
      normalizedIdentity = strictIdentity(identity);
    } catch {
      return send(res, 503, 'moderation_auth_unconfigured');
    }

    let access;
    try {
      access = await withDependencyTimeout(
        (signal) => resolveAccess(Object.freeze({
          issuer: normalizedIdentity.issuer,
          roleIds: normalizedIdentity.roleIds,
          subject: normalizedIdentity.subject,
        }), Object.freeze({ signal })),
        dependencyTimeoutMs,
        () => new ModerationWorkforceAccessUnavailableError(),
      );
      if (access === null) return send(res, 403, 'moderation_forbidden');
      strictAccess(access);
      req.moderator = validateModerationPrincipal({
        actorId: access.actorId,
        authMethod: MODERATION_AUTH_METHOD,
        capabilities: access.capabilities,
        expiresAt: normalizedIdentity.expiresAt,
        issuedAt: normalizedIdentity.issuedAt,
        mfaAuthenticatedAt: normalizedIdentity.mfaAuthenticatedAt,
        mfaVerified: normalizedIdentity.mfaVerified,
      }, { now });
    } catch (error) {
      if (error instanceof ModerationWorkforceAccessUnavailableError) {
        logUnavailable(req, error);
        return send(res, 503, 'moderation_auth_unavailable');
      }
      if (error instanceof ModerationWorkforceAccessConfigError) {
        return send(res, 503, 'moderation_auth_unconfigured');
      }
      if (error instanceof ModerationPrincipalError) {
        return send(res, 503, 'moderation_auth_unconfigured');
      }
      logUnavailable(req, error);
      return send(res, 503, 'moderation_auth_unavailable');
    }

    return next();
  };
}
