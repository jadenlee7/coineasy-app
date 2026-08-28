import { createModerationAuthorizer } from '../middleware/moderation-authorization.js';
import { createModerationRateLimiter } from '../middleware/moderation-rate-limit.js';
import { createModerationWorkforceAuth } from '../middleware/moderation-workforce-auth.js';

const OPTION_KEYS = Object.freeze([
  'authDependencyTimeoutMs',
  'consumeRateLimit',
  'now',
  'rateLimitDependencyTimeoutMs',
  'resolveAccess',
  'verifyToken',
].sort());
const REQUIRED_KEYS = Object.freeze([
  'consumeRateLimit',
  'resolveAccess',
  'verifyToken',
]);

function dataOptions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('dormant moderation runtime dependencies are required');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => (
      typeof key !== 'string'
      || !OPTION_KEYS.includes(key)
      || !Object.hasOwn(descriptors[key], 'value')
    ))
    || REQUIRED_KEYS.some((key) => !Object.hasOwn(descriptors, key))
  ) {
    throw new TypeError('dormant moderation runtime dependencies are required');
  }
  return descriptors;
}

export function createDormantModerationRuntime(options) {
  const descriptors = dataOptions(options);
  const now = descriptors.now ? descriptors.now.value : Date.now;
  if (
    typeof descriptors.consumeRateLimit.value !== 'function'
    || typeof now !== 'function'
  ) {
    throw new TypeError('dormant moderation runtime dependencies are required');
  }
  const authOptions = {
    now,
    resolveAccess: descriptors.resolveAccess.value,
    verifyToken: descriptors.verifyToken.value,
  };
  if (descriptors.authDependencyTimeoutMs) {
    authOptions.dependencyTimeoutMs = descriptors.authDependencyTimeoutMs.value;
  }
  const rateLimitOptions = {
    consume: descriptors.consumeRateLimit.value,
  };
  if (descriptors.rateLimitDependencyTimeoutMs) {
    rateLimitOptions.dependencyTimeoutMs = descriptors.rateLimitDependencyTimeoutMs.value;
  }

  return Object.freeze({
    authenticate: createModerationWorkforceAuth(authOptions),
    authorize: createModerationAuthorizer({ now }),
    limit: createModerationRateLimiter(rateLimitOptions),
  });
}
