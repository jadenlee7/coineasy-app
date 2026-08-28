export const MODERATION_RATE_LIMIT_DEPENDENCY_TIMEOUT_DEFAULT_MS = 2_000;

const CONSUMER_DEADLINE_MARKER = Symbol('easygo.moderationRateLimitConsumerDeadline');

export function bindModerationRateLimitConsumerDeadline(consume, dependencyTimeoutMs) {
  if (typeof consume !== 'function' || !Number.isSafeInteger(dependencyTimeoutMs)) {
    throw new TypeError('moderation rate-limit consumer deadline is invalid');
  }
  Object.defineProperty(consume, CONSUMER_DEADLINE_MARKER, {
    configurable: false,
    enumerable: false,
    value: dependencyTimeoutMs,
    writable: false,
  });
  return consume;
}

export function readModerationRateLimitConsumerDeadline(consume) {
  if (typeof consume !== 'function') return null;
  const descriptor = Object.getOwnPropertyDescriptor(consume, CONSUMER_DEADLINE_MARKER);
  if (!descriptor) return null;
  if (
    !Object.hasOwn(descriptor, 'value')
    || descriptor.configurable
    || descriptor.enumerable
    || descriptor.writable
    || !Number.isSafeInteger(descriptor.value)
  ) {
    throw new TypeError('moderation rate-limit consumer deadline is invalid');
  }
  return descriptor.value;
}
