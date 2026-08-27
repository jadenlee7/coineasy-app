import {
  MODERATION_CAPABILITIES,
  MODERATION_MFA_MAX_AGE_SECONDS,
  validateModerationPrincipal,
} from '../lib/moderation-principal.js';

const KNOWN_CAPABILITIES = new Set(Object.values(MODERATION_CAPABILITIES));
const ROUTE_OPTION_KEYS = Object.freeze(['maxMfaAgeSeconds']);

function isValidMfaLimit(value) {
  return Number.isSafeInteger(value)
    && value >= 60
    && value <= MODERATION_MFA_MAX_AGE_SECONDS;
}

function normalizeRequiredCapabilities(value) {
  const capabilities = Array.isArray(value) ? value : [value];
  if (
    capabilities.length < 1
    || capabilities.some((capability) => (
      typeof capability !== 'string' || !KNOWN_CAPABILITIES.has(capability)
    ))
    || new Set(capabilities).size !== capabilities.length
  ) {
    throw new TypeError('moderation capability requirement is invalid');
  }
  return Object.freeze([...capabilities]);
}

function forbidden(res) {
  return res.status(403).json({ error: 'moderation_forbidden' });
}

export function createModerationAuthorizer(options = {}) {
  return function requireModerationCapabilities(value, routeOptions = {}) {
    const required = normalizeRequiredCapabilities(value);
    if (
      !routeOptions
      || typeof routeOptions !== 'object'
      || Array.isArray(routeOptions)
    ) {
      throw new TypeError('moderation authorization options are invalid');
    }
    const routeOptionKeys = Reflect.ownKeys(routeOptions);
    if (
      routeOptionKeys.some((key) => (
        typeof key !== 'string' || !ROUTE_OPTION_KEYS.includes(key)
      ))
      || (
        Object.hasOwn(routeOptions, 'maxMfaAgeSeconds')
        && !isValidMfaLimit(routeOptions.maxMfaAgeSeconds)
      )
    ) {
      throw new TypeError('moderation authorization options are invalid');
    }
    const validationOptions = { ...options };
    if (Object.hasOwn(routeOptions, 'maxMfaAgeSeconds')) {
      const baseHasMfaLimit = Object.hasOwn(options, 'maxMfaAgeSeconds');
      validationOptions.maxMfaAgeSeconds = baseHasMfaLimit
        ? (
          isValidMfaLimit(options.maxMfaAgeSeconds)
            ? Math.min(options.maxMfaAgeSeconds, routeOptions.maxMfaAgeSeconds)
            : options.maxMfaAgeSeconds
        )
        : routeOptions.maxMfaAgeSeconds;
    }

    return function moderationAuthorization(req, res, next) {
      let principal;
      try {
        principal = validateModerationPrincipal(req?.moderator, validationOptions);
      } catch {
        return forbidden(res);
      }

      const granted = new Set(principal.capabilities);
      if (required.some((capability) => !granted.has(capability))) {
        return forbidden(res);
      }

      req.moderator = principal;
      return next();
    };
  };
}
