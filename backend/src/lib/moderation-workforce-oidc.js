import { createLocalJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import {
  MODERATION_MFA_MAX_AGE_SECONDS,
  MODERATION_SESSION_MAX_AGE_SECONDS,
} from './moderation-principal.js';

export const MODERATION_WORKFORCE_TOKEN_MAX_LENGTH = 16 * 1_024;

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const KID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const ROLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/u;
const SUBJECT_PATTERN = /^[\x21-\x7E]{1,255}$/u;
const TOKEN_TYPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.+_-]{0,31}$/u;
const SUPPORTED_ALGORITHMS = new Set(['ES256', 'RS256']);
const UNSUPPORTED_HEADER_FIELDS = Object.freeze([
  'b64',
  'crit',
  'jku',
  'jwk',
  'x5c',
  'x5u',
]);
const JWKS_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENETUNREACH',
  'ENOTFOUND',
  'ERR_JWKS_TIMEOUT',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);
const TOKEN_VERIFICATION_CODES = new Set([
  'ERR_JOSE_ALG_NOT_ALLOWED',
  'ERR_JWS_INVALID',
  'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  'ERR_JWKS_NO_MATCHING_KEY',
  'ERR_JWT_CLAIM_VALIDATION_FAILED',
  'ERR_JWT_EXPIRED',
  'ERR_JWT_INVALID',
]);
const KEY_NOT_FOUND_CODES = new Set(['ERR_JWKS_NO_MATCHING_KEY']);
const JWKS_TIMEOUT_MS = 4_000;
const JWKS_CACHE_MS = 10 * 60 * 1_000;
const JWKS_COOLDOWN_MS = 30_000;
const JWKS_MAX_BYTES = 256 * 1_024;
const JWKS_MAX_KEYS = 64;

export class ModerationWorkforceOidcConfigError extends Error {
  constructor() {
    super('moderation workforce OIDC configuration is invalid');
    this.name = 'ModerationWorkforceOidcConfigError';
  }
}

export class ModerationWorkforceOidcTokenError extends Error {
  constructor() {
    super('moderation workforce identity is invalid');
    this.name = 'ModerationWorkforceOidcTokenError';
  }
}

export class ModerationWorkforceOidcUnavailableError extends Error {
  constructor() {
    super('moderation workforce OIDC verification is unavailable');
    this.name = 'ModerationWorkforceOidcUnavailableError';
  }
}

function configInvalid() {
  throw new ModerationWorkforceOidcConfigError();
}

function tokenInvalid() {
  throw new ModerationWorkforceOidcTokenError();
}

function strictObject(value, keys, invalid) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== 'string')) invalid();
  const sorted = ownKeys.sort();
  const expected = [...keys].sort();
  if (
    sorted.length !== expected.length
    || sorted.some((key, index) => key !== expected[index])
  ) {
    invalid();
  }
}

function exactHttpsUrl(value) {
  if (
    typeof value !== 'string'
    || value.length < 8
    || value.length > 2_048
    || value !== value.trim()
  ) {
    configInvalid();
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    configInvalid();
  }
  if (
    parsed.protocol !== 'https:'
    || !parsed.hostname
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    configInvalid();
  }
  return value;
}

function exactIdentifier(value) {
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) configInvalid();
  return value;
}

function exactTokenType(value) {
  if (typeof value !== 'string' || !TOKEN_TYPE_PATTERN.test(value)) configInvalid();
  return value;
}

function validateProtectedHeader(value, algorithms, tokenType) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) tokenInvalid();
  const keys = Reflect.ownKeys(value);
  if (
    keys.some((key) => typeof key !== 'string')
    || UNSUPPORTED_HEADER_FIELDS.some((field) => Object.hasOwn(value, field))
    || !algorithms.includes(value.alg)
    || value.typ !== tokenType
    || typeof value.kid !== 'string'
    || !KID_PATTERN.test(value.kid)
  ) {
    tokenInvalid();
  }
  return value;
}

function normalizeAlgorithms(value) {
  if (
    !Array.isArray(value)
    || value.length < 1
    || value.length > SUPPORTED_ALGORITHMS.size
    || value.some((algorithm) => !SUPPORTED_ALGORITHMS.has(algorithm))
    || new Set(value).size !== value.length
  ) {
    configInvalid();
  }
  return Object.freeze([...value].sort());
}

function normalizeToken(value) {
  if (
    typeof value !== 'string'
    || value.length < 3
    || value.length > MODERATION_WORKFORCE_TOKEN_MAX_LENGTH
    || value !== value.trim()
  ) {
    tokenInvalid();
  }
  const parts = value.split('.');
  if (
    parts.length !== 3
    || parts.some((part) => !part || !BASE64URL_PATTERN.test(part))
  ) {
    tokenInvalid();
  }
  return value;
}

function currentEpochSeconds(now) {
  let milliseconds;
  try {
    milliseconds = now();
  } catch {
    throw new ModerationWorkforceOidcUnavailableError();
  }
  if (!Number.isFinite(milliseconds)) {
    throw new ModerationWorkforceOidcUnavailableError();
  }
  const seconds = Math.floor(milliseconds / 1_000);
  if (!Number.isSafeInteger(seconds)) {
    throw new ModerationWorkforceOidcUnavailableError();
  }
  return seconds;
}

function verificationErrorCode(error, codes) {
  let current = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current.code === 'string' && codes.has(current.code)) {
      return current.code;
    }
    current = current.cause;
  }
  return null;
}

function unavailable() {
  throw new ModerationWorkforceOidcUnavailableError();
}

function currentMilliseconds(now) {
  let value;
  try {
    value = now();
  } catch {
    unavailable();
  }
  if (
    !Number.isFinite(value)
    || value < 0
    || !Number.isSafeInteger(Math.floor(value))
  ) {
    unavailable();
  }
  return Math.floor(value);
}

function validateSignal(signal) {
  if (signal !== undefined && !(signal instanceof AbortSignal)) configInvalid();
  if (signal?.aborted) unavailable();
  return signal;
}

function signalFromOptions(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) configInvalid();
  const keys = Reflect.ownKeys(value);
  if (
    keys.some((key) => typeof key !== 'string')
    || keys.some((key) => key !== 'signal')
  ) {
    configInvalid();
  }
  return validateSignal(value.signal);
}

async function waitWithSignal(operation, signal) {
  if (!signal) return operation;
  validateSignal(signal);
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(new ModerationWorkforceOidcUnavailableError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

async function readBoundedJwksBody(response, controller) {
  if (
    !response
    || response.status !== 200
    || !response.body
    || typeof response.body.getReader !== 'function'
  ) {
    unavailable();
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) unavailable();
      total += value.byteLength;
      if (total > JWKS_MAX_BYTES) {
        controller.abort();
        unavailable();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let value;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch {
    unavailable();
  }
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || !Array.isArray(value.keys)
    || value.keys.length < 1
    || value.keys.length > JWKS_MAX_KEYS
    || value.keys.some((key) => !key || typeof key !== 'object' || Array.isArray(key))
  ) {
    unavailable();
  }
  return value;
}

async function fetchJwksWithDeadline(url, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new ModerationWorkforceOidcUnavailableError());
    }, timeoutMs);
  });
  const request = Promise.resolve().then(async () => {
    const response = await fetchImpl(url, {
      cache: 'no-store',
      headers: Object.freeze({ Accept: 'application/json' }),
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
    });
    return readBoundedJwksBody(response, controller);
  });
  try {
    return await Promise.race([request, timeout]);
  } catch {
    controller.abort();
    unavailable();
  } finally {
    clearTimeout(timeoutId);
  }
}

function immutableJson(value, depth = 0, state = { nodes: 0 }) {
  state.nodes += 1;
  if (state.nodes > 512 || depth > 8) tokenInvalid();
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) tokenInvalid();
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => immutableJson(item, depth + 1, state)));
  }
  if (!value || typeof value !== 'object') tokenInvalid();
  const clone = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') tokenInvalid();
    clone[key] = immutableJson(value[key], depth + 1, state);
  }
  return Object.freeze(clone);
}

function normalizeRoleIds(value) {
  if (!Array.isArray(value) || value.length > 32) tokenInvalid();
  const unique = new Set();
  for (const roleId of value) {
    if (
      typeof roleId !== 'string'
      || !ROLE_ID_PATTERN.test(roleId)
      || unique.has(roleId)
    ) {
      tokenInvalid();
    }
    unique.add(roleId);
  }
  return Object.freeze([...unique].sort());
}

function validateAdaptedClaims(value, {
  currentTime,
  expiresAt,
  issuedAt,
  clockToleranceSeconds,
  maxMfaAgeSeconds,
}) {
  strictObject(
    value,
    ['mfaAuthenticatedAt', 'mfaVerified', 'roleIds'],
    tokenInvalid,
  );
  if (
    value.mfaVerified !== true
    || !Number.isSafeInteger(value.mfaAuthenticatedAt)
    || value.mfaAuthenticatedAt > currentTime + clockToleranceSeconds
    || value.mfaAuthenticatedAt > issuedAt + clockToleranceSeconds
    || value.mfaAuthenticatedAt >= expiresAt
    || currentTime - value.mfaAuthenticatedAt > maxMfaAgeSeconds
  ) {
    tokenInvalid();
  }
  return Object.freeze({
    mfaAuthenticatedAt: value.mfaAuthenticatedAt,
    mfaVerified: true,
    roleIds: normalizeRoleIds(value.roleIds),
  });
}

export function createAcrAmrWorkforceClaimsAdapter({
  acceptedMfaAcrValues,
  requiredMfaAmrValues,
  roleClaim,
} = {}) {
  const normalizedRoleClaim = exactIdentifier(roleClaim);
  if (
    !Array.isArray(acceptedMfaAcrValues)
    || acceptedMfaAcrValues.length < 1
    || acceptedMfaAcrValues.length > 8
    || acceptedMfaAcrValues.some((value) => (
      typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)
    ))
    || new Set(acceptedMfaAcrValues).size !== acceptedMfaAcrValues.length
    || !Array.isArray(requiredMfaAmrValues)
    || requiredMfaAmrValues.length < 2
    || requiredMfaAmrValues.length > 8
    || requiredMfaAmrValues.some((value) => (
      typeof value !== 'string' || !ROLE_ID_PATTERN.test(value)
    ))
    || new Set(requiredMfaAmrValues).size !== requiredMfaAmrValues.length
  ) {
    configInvalid();
  }
  const acceptedAcr = new Set(acceptedMfaAcrValues);
  const requiredAmr = new Set(requiredMfaAmrValues);

  return function adaptWorkforceClaims(payload) {
    const amr = payload?.amr;
    if (
      !Array.isArray(amr)
      || amr.length < 1
      || amr.length > 16
      || amr.some((value) => typeof value !== 'string' || !ROLE_ID_PATTERN.test(value))
      || new Set(amr).size !== amr.length
      || !acceptedAcr.has(payload?.acr)
      || [...requiredAmr].some((value) => !amr.includes(value))
      || !Number.isSafeInteger(payload?.auth_time)
    ) {
      tokenInvalid();
    }
    return {
      mfaAuthenticatedAt: payload.auth_time,
      mfaVerified: true,
      roleIds: payload[normalizedRoleClaim],
    };
  };
}

export function createPinnedModerationRemoteJwks(
  jwksUrl,
  {
    createLocalJWKSetImpl = createLocalJWKSet,
    fetchImpl = globalThis.fetch,
    now = Date.now,
    timeoutMs = JWKS_TIMEOUT_MS,
  } = {},
) {
  const normalizedUrl = exactHttpsUrl(jwksUrl);
  if (
    typeof createLocalJWKSetImpl !== 'function'
    || typeof fetchImpl !== 'function'
    || typeof now !== 'function'
    || !Number.isSafeInteger(timeoutMs)
    || timeoutMs < 10
    || timeoutMs > 10_000
  ) {
    configInvalid();
  }
  const url = new URL(normalizedUrl);
  let fetchedAt = 0;
  let localResolver;
  let pendingFetch;

  function reload() {
    if (pendingFetch) return pendingFetch;
    const operation = (async () => {
      const jwks = await fetchJwksWithDeadline(url, fetchImpl, timeoutMs);
      let resolver;
      try {
        resolver = createLocalJWKSetImpl(jwks);
      } catch {
        unavailable();
      }
      if (typeof resolver !== 'function') unavailable();
      localResolver = resolver;
      fetchedAt = currentMilliseconds(now);
    })();
    pendingFetch = operation;
    operation.then(
      () => { if (pendingFetch === operation) pendingFetch = undefined; },
      () => { if (pendingFetch === operation) pendingFetch = undefined; },
    );
    return operation;
  }

  return async function resolvePinnedModerationKey(
    protectedHeader,
    token,
    options,
  ) {
    const signal = signalFromOptions(options);
    const currentTime = currentMilliseconds(now);
    if (localResolver && currentTime < fetchedAt) unavailable();
    if (!localResolver || currentTime - fetchedAt >= JWKS_CACHE_MS) {
      await waitWithSignal(reload(), signal);
    }
    try {
      return await localResolver(protectedHeader, token);
    } catch (error) {
      if (!verificationErrorCode(error, KEY_NOT_FOUND_CODES)) {
        unavailable();
      }
      const retryTime = currentMilliseconds(now);
      if (retryTime < fetchedAt) unavailable();
      if (retryTime - fetchedAt < JWKS_COOLDOWN_MS) throw error;
      await waitWithSignal(reload(), signal);
      try {
        return await localResolver(protectedHeader, token);
      } catch (retryError) {
        if (verificationErrorCode(retryError, KEY_NOT_FOUND_CODES)) {
          throw retryError;
        }
        unavailable();
      }
    }
  };
}

export function createWorkforceOidcVerifier({
  adaptClaims,
  algorithms,
  audience,
  clockToleranceSeconds = 60,
  issuer,
  keyResolver,
  maxMfaAgeSeconds = MODERATION_MFA_MAX_AGE_SECONDS,
  maxTokenAgeSeconds = MODERATION_SESSION_MAX_AGE_SECONDS,
  now = Date.now,
  tokenType,
  jwtVerifyImpl = jwtVerify,
} = {}) {
  const normalizedIssuer = exactHttpsUrl(issuer);
  const normalizedAudience = exactIdentifier(audience);
  const normalizedAlgorithms = normalizeAlgorithms(algorithms);
  const normalizedTokenType = exactTokenType(tokenType);
  if (
    typeof adaptClaims !== 'function'
    || typeof keyResolver !== 'function'
    || typeof jwtVerifyImpl !== 'function'
    || typeof now !== 'function'
    || !Number.isSafeInteger(clockToleranceSeconds)
    || clockToleranceSeconds < 0
    || clockToleranceSeconds > 300
    || !Number.isSafeInteger(maxTokenAgeSeconds)
    || maxTokenAgeSeconds < 300
    || maxTokenAgeSeconds > MODERATION_SESSION_MAX_AGE_SECONDS
    || !Number.isSafeInteger(maxMfaAgeSeconds)
    || maxMfaAgeSeconds < 60
    || maxMfaAgeSeconds > MODERATION_MFA_MAX_AGE_SECONDS
  ) {
    configInvalid();
  }

  return async function verifyWorkforceOidcToken(value, options) {
    const token = normalizeToken(value);
    const signal = signalFromOptions(options);
    const currentTime = currentEpochSeconds(now);
    let unverifiedHeader;
    try {
      unverifiedHeader = decodeProtectedHeader(token);
    } catch {
      tokenInvalid();
    }
    validateProtectedHeader(
      unverifiedHeader,
      normalizedAlgorithms,
      normalizedTokenType,
    );
    const resolveKey = async (protectedHeader, flattenedJws) => {
      try {
        return await keyResolver(
          protectedHeader,
          flattenedJws,
          Object.freeze({ signal }),
        );
      } catch (error) {
        if (
          error instanceof ModerationWorkforceOidcConfigError
          || error instanceof ModerationWorkforceOidcTokenError
          || error instanceof ModerationWorkforceOidcUnavailableError
          || verificationErrorCode(error, KEY_NOT_FOUND_CODES)
        ) {
          throw error;
        }
        throw new ModerationWorkforceOidcUnavailableError();
      }
    };
    let verified;
    try {
      verified = await waitWithSignal(
        Promise.resolve().then(() => jwtVerifyImpl(token, resolveKey, {
          algorithms: normalizedAlgorithms,
          audience: normalizedAudience,
          clockTolerance: clockToleranceSeconds,
          currentDate: new Date(currentTime * 1_000),
          issuer: normalizedIssuer,
          maxTokenAge: `${maxTokenAgeSeconds}s`,
          requiredClaims: ['exp', 'iat', 'sub'],
          typ: normalizedTokenType,
        })),
        signal,
      );
    } catch (error) {
      if (error instanceof ModerationWorkforceOidcConfigError) throw error;
      if (error instanceof ModerationWorkforceOidcTokenError) throw error;
      if (
        error instanceof ModerationWorkforceOidcUnavailableError
        || verificationErrorCode(error, JWKS_UNAVAILABLE_CODES)
      ) {
        throw new ModerationWorkforceOidcUnavailableError();
      }
      if (verificationErrorCode(error, TOKEN_VERIFICATION_CODES)) tokenInvalid();
      throw new ModerationWorkforceOidcUnavailableError();
    }

    const rawPayload = verified?.payload;
    const protectedHeader = verified?.protectedHeader;
    if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
      tokenInvalid();
    }
    const payload = immutableJson(rawPayload);
    validateProtectedHeader(
      protectedHeader,
      normalizedAlgorithms,
      normalizedTokenType,
    );
    const {
      aud,
      azp,
      exp,
      iat,
      iss,
      nbf,
      sub,
    } = payload;
    if (
      iss !== normalizedIssuer
      || aud !== normalizedAudience
      || (azp !== undefined && azp !== normalizedAudience)
      || typeof sub !== 'string'
      || !SUBJECT_PATTERN.test(sub)
      || !Number.isSafeInteger(iat)
      || !Number.isSafeInteger(exp)
      || (nbf !== undefined && !Number.isSafeInteger(nbf))
      || iat > currentTime + clockToleranceSeconds
      || exp <= currentTime
      || exp <= iat
      || exp - iat > maxTokenAgeSeconds
      || currentTime - iat > maxTokenAgeSeconds
    ) {
      tokenInvalid();
    }

    let adapted;
    try {
      adapted = adaptClaims(payload);
    } catch (error) {
      if (error instanceof ModerationWorkforceOidcConfigError) throw error;
      if (error instanceof ModerationWorkforceOidcUnavailableError) throw error;
      tokenInvalid();
    }
    const claims = validateAdaptedClaims(adapted, {
      clockToleranceSeconds,
      currentTime,
      expiresAt: exp,
      issuedAt: iat,
      maxMfaAgeSeconds,
    });

    return Object.freeze({
      expiresAt: exp,
      issuedAt: iat,
      issuer: normalizedIssuer,
      mfaAuthenticatedAt: claims.mfaAuthenticatedAt,
      mfaVerified: true,
      roleIds: claims.roleIds,
      subject: sub,
    });
  };
}
