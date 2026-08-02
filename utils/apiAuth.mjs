// Pure auth-token registry used by the API client.
//
// Ordinary API calls intentionally keep their historical fail-soft behavior.
// Destructive calls use resolveBoundAuthHeader(), which requires the token
// provider to be explicitly bound to the expected authenticated Privy user and
// rejects if that binding changes while the asynchronous token read is active.

export const API_AUTH_ERROR_CODES = Object.freeze({
  EXPECTED_USER_REQUIRED: 'api_auth_expected_user_required',
  PROVIDER_UNAVAILABLE: 'api_auth_provider_unavailable',
  OWNER_MISMATCH: 'api_auth_owner_mismatch',
  SESSION_CHANGED: 'api_auth_session_changed',
  TOKEN_UNAVAILABLE: 'api_auth_token_unavailable',
  TOKEN_OWNER_MISMATCH: 'api_auth_token_owner_mismatch',
});

export class ApiAuthBindingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ApiAuthBindingError';
    this.code = code;
  }
}

function normalizedUserId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function ownerFromBinding(binding) {
  if (typeof binding === 'string') return normalizedUserId(binding);
  if (!binding || typeof binding !== 'object') return null;
  return normalizedUserId(binding.userId ?? binding.ownerUserId);
}

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function accessTokenSubject(token) {
  if (typeof token !== 'string' || token.length > 16_384) return null;
  const segments = token.split('.');
  const payload = segments.length === 3 ? segments[1] : '';
  if (!payload || !/^[A-Za-z0-9_-]+$/u.test(payload)) return null;

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let buffer = 0;
  let bitCount = 0;
  const bytes = [];
  for (const character of payload) {
    const value = alphabet.indexOf(character);
    if (value < 0) return null;
    buffer = (buffer << 6) | value;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((buffer >> bitCount) & 0xff);
      buffer &= (1 << bitCount) - 1;
    }
  }

  let json = '';
  for (const byte of bytes) json += String.fromCharCode(byte);
  try {
    const claims = JSON.parse(json);
    return normalizedUserId(claims?.sub);
  } catch {
    return null;
  }
}

/**
 * Create an isolated registry. The optional error observer is injectable so
 * the module stays independent of React Native and console globals in tests.
 */
export function createApiAuthRegistry({ onOptionalProviderError } = {}) {
  let revision = 0;
  let provider = null;
  let ownerUserId = null;

  function setTokenProvider(nextProvider, ownerBinding) {
    if (nextProvider !== null && nextProvider !== undefined && typeof nextProvider !== 'function') {
      throw new TypeError('API token provider must be a function or null');
    }

    revision += 1;
    provider = typeof nextProvider === 'function' ? nextProvider : null;
    ownerUserId = provider ? ownerFromBinding(ownerBinding) : null;
  }

  async function resolveOptionalAuthHeader() {
    const optionalProvider = provider;
    if (!optionalProvider) return {};

    try {
      return authHeader(await optionalProvider());
    } catch (error) {
      try {
        onOptionalProviderError?.(error);
      } catch {
        // Diagnostics must never turn an ordinary fail-soft request into a failure.
      }
      return {};
    }
  }

  async function resolveBoundAuthHeader(expectedAuthUserId) {
    const expectedUserId = normalizedUserId(expectedAuthUserId);
    if (!expectedUserId) {
      throw new ApiAuthBindingError(
        API_AUTH_ERROR_CODES.EXPECTED_USER_REQUIRED,
        'A verified auth owner is required for this request',
      );
    }

    const snapshot = {
      revision,
      provider,
      ownerUserId,
    };

    if (!snapshot.provider) {
      throw new ApiAuthBindingError(
        API_AUTH_ERROR_CODES.PROVIDER_UNAVAILABLE,
        'The authenticated token provider is unavailable',
      );
    }

    if (!snapshot.ownerUserId || snapshot.ownerUserId !== expectedUserId) {
      throw new ApiAuthBindingError(
        API_AUTH_ERROR_CODES.OWNER_MISMATCH,
        'The authenticated token provider belongs to a different session',
      );
    }

    let token;
    try {
      token = await snapshot.provider();
    } catch {
      if (
        revision !== snapshot.revision ||
        provider !== snapshot.provider ||
        ownerUserId !== snapshot.ownerUserId
      ) {
        throw new ApiAuthBindingError(
          API_AUTH_ERROR_CODES.SESSION_CHANGED,
          'The authenticated session changed before the request was sent',
        );
      }

      throw new ApiAuthBindingError(
        API_AUTH_ERROR_CODES.TOKEN_UNAVAILABLE,
        'An authenticated token could not be obtained',
      );
    }

    if (
      revision !== snapshot.revision ||
      provider !== snapshot.provider ||
      ownerUserId !== snapshot.ownerUserId
    ) {
      throw new ApiAuthBindingError(
        API_AUTH_ERROR_CODES.SESSION_CHANGED,
        'The authenticated session changed before the request was sent',
      );
    }

    if (!token) {
      throw new ApiAuthBindingError(
        API_AUTH_ERROR_CODES.TOKEN_UNAVAILABLE,
        'An authenticated token could not be obtained',
      );
    }

    if (accessTokenSubject(token) !== expectedUserId) {
      throw new ApiAuthBindingError(
        API_AUTH_ERROR_CODES.TOKEN_OWNER_MISMATCH,
        'The access token belongs to a different authenticated user',
      );
    }

    return authHeader(token);
  }

  function bindingSnapshot() {
    return Object.freeze({
      revision,
      hasProvider: Boolean(provider),
      ownerUserId,
    });
  }

  return Object.freeze({
    setTokenProvider,
    resolveOptionalAuthHeader,
    resolveBoundAuthHeader,
    bindingSnapshot,
  });
}
