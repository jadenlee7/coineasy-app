import { MODERATION_CAPABILITIES } from '../lib/moderation-principal.js';
import {
  MODERATION_RATE_LIMIT_DEPENDENCY_TIMEOUT_DEFAULT_MS,
  readModerationRateLimitConsumerDeadline,
} from '../lib/moderation-rate-limit-deadline.js';

export const MODERATION_RATE_LIMIT_SCOPES = Object.freeze({
  QUEUE_READ: MODERATION_CAPABILITIES.QUEUE_READ,
  REPORT_CLAIM: MODERATION_CAPABILITIES.REPORT_CLAIM,
  REPORT_DECIDE: MODERATION_CAPABILITIES.REPORT_DECIDE,
  CONTENT_REMOVE: MODERATION_CAPABILITIES.CONTENT_REMOVE,
});

const ACTOR_ID_PATTERN = /^wf_[A-Za-z0-9_-]{22,60}$/u;
const KNOWN_SCOPES = new Set(Object.values(MODERATION_RATE_LIMIT_SCOPES));
const RETRY_AFTER_MAX_SECONDS = 3_600;
const STORE_TIMEOUT_MAX_MS = 10_000;

class ModerationRateLimitUnavailableError extends Error {
  constructor() {
    super('moderation rate-limit storage is unavailable');
    this.name = 'ModerationRateLimitUnavailableError';
  }
}

function normalizeScopes(value) {
  const scopes = Array.isArray(value) ? value : [value];
  if (
    scopes.length < 1
    || scopes.length > KNOWN_SCOPES.size
    || scopes.some((scope) => typeof scope !== 'string' || !KNOWN_SCOPES.has(scope))
    || new Set(scopes).size !== scopes.length
  ) {
    throw new TypeError('moderation rate-limit scopes are invalid');
  }
  return Object.freeze([...scopes].sort());
}

function errorType(error) {
  return error instanceof ModerationRateLimitUnavailableError
    ? 'ModerationRateLimitUnavailableError'
    : 'ModerationRateLimitDependencyError';
}

function logUnavailable(req, error) {
  try {
    req.log?.error?.(
      { errorType: errorType(error) },
      'moderation rate limit failed',
    );
  } catch {
    // Rate limiting remains fail-closed when logging is unavailable.
  }
}

function normalizeOutcome(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== 'string')) return null;
  keys.sort();
  if (
    keys.some((key) => !Object.hasOwn(descriptors[key], 'value'))
    || !Object.hasOwn(descriptors, 'allowed')
  ) {
    return null;
  }
  const allowed = descriptors.allowed.value;
  if (allowed === true) {
    return keys.length === 1 && keys[0] === 'allowed'
      ? Object.freeze({ allowed: true })
      : null;
  }
  const retryAfterSeconds = descriptors.retryAfterSeconds?.value;
  return allowed === false
    && keys.length === 2
    && keys[0] === 'allowed'
    && keys[1] === 'retryAfterSeconds'
    && Number.isSafeInteger(retryAfterSeconds)
    && retryAfterSeconds >= 1
    && retryAfterSeconds <= RETRY_AFTER_MAX_SECONDS
    ? Object.freeze({ allowed: false, retryAfterSeconds })
    : null;
}

async function withStoreTimeout(operation, timeoutMs) {
  const controller = new AbortController();
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new ModerationRateLimitUnavailableError());
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

export function createModerationRateLimiter({
  consume,
  dependencyTimeoutMs = MODERATION_RATE_LIMIT_DEPENDENCY_TIMEOUT_DEFAULT_MS,
} = {}) {
  if (
    !Number.isSafeInteger(dependencyTimeoutMs)
    || dependencyTimeoutMs < 10
    || dependencyTimeoutMs > STORE_TIMEOUT_MAX_MS
  ) {
    throw new TypeError('moderation rate-limit timeout is invalid');
  }
  const consumerDeadlineMs = readModerationRateLimitConsumerDeadline(consume);
  if (typeof consume === 'function' && consumerDeadlineMs === null) {
    throw new TypeError('moderation rate-limit consumer deadline is unbound');
  }
  if (consumerDeadlineMs !== null && consumerDeadlineMs !== dependencyTimeoutMs) {
    throw new TypeError('moderation rate-limit consumer deadline does not match middleware');
  }

  return function requireModerationRateLimit(value) {
    const scopes = normalizeScopes(value);

    return async function moderationRateLimit(req, res, next) {
      if (typeof consume !== 'function') {
        return res.status(503).json({ error: 'moderation_rate_limit_unconfigured' });
      }
      const actorId = req?.moderator?.actorId;
      if (typeof actorId !== 'string' || !ACTOR_ID_PATTERN.test(actorId)) {
        return res.status(403).json({ error: 'moderation_forbidden' });
      }

      let outcome;
      try {
        outcome = await withStoreTimeout(
          (signal) => consume(
            Object.freeze({ actorId, scopes }),
            Object.freeze({ signal }),
          ),
          dependencyTimeoutMs,
        );
        outcome = normalizeOutcome(outcome);
        if (!outcome) {
          return res.status(503).json({ error: 'moderation_rate_limit_unavailable' });
        }
      } catch (error) {
        logUnavailable(req, error);
        return res.status(503).json({ error: 'moderation_rate_limit_unavailable' });
      }
      if (!outcome.allowed) {
        res.set('Retry-After', String(outcome.retryAfterSeconds));
        return res.status(429).json({ error: 'moderation_rate_limited' });
      }
      return next();
    };
  };
}
