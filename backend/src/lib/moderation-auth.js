import { createHash, timingSafeEqual } from 'node:crypto';

const MODERATOR_KEY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256_DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const MODERATION_API_KEY_PATTERN = /^eg_mod_[A-Za-z0-9_-]{32,220}$/;

function isModeratorKeyId(value) {
  return typeof value === 'string'
    && value.length >= 2
    && value.length <= 64
    && MODERATOR_KEY_ID_PATTERN.test(value);
}

function isSha256Digest(value) {
  return typeof value === 'string' && SHA256_DIGEST_PATTERN.test(value);
}

function isModerationApiKey(value) {
  return typeof value === 'string' && MODERATION_API_KEY_PATTERN.test(value);
}

export class ModerationAuthConfigError extends Error {
  constructor() {
    super('moderation API key configuration is invalid');
    this.name = 'ModerationAuthConfigError';
  }
}

export function hashModerationApiKey(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function parseModerationKeyHashes(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new ModerationAuthConfigError();
  }

  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ModerationAuthConfigError();
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ModerationAuthConfigError();
  }

  const entries = Object.entries(value);
  if (entries.length < 1 || entries.length > 50) {
    throw new ModerationAuthConfigError();
  }

  const hashes = new Set();
  const parsed = [];
  for (const [keyId, digest] of entries) {
    if (!isModeratorKeyId(keyId) || !isSha256Digest(digest) || hashes.has(digest)) {
      throw new ModerationAuthConfigError();
    }
    hashes.add(digest);
    parsed.push([keyId, digest]);
  }
  return parsed;
}

export function resolveModeratorKeyId(token, entries) {
  if (!isModerationApiKey(token)) return null;

  const candidate = Buffer.from(hashModerationApiKey(token), 'hex');
  let matchedKeyId = null;
  for (const [keyId, digest] of entries) {
    const matches = timingSafeEqual(candidate, Buffer.from(digest, 'hex'));
    if (matches) matchedKeyId = keyId;
  }
  return matchedKeyId;
}

function errorType(error) {
  return typeof error?.name === 'string'
    && /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/u.test(error.name)
    ? error.name
    : 'Error';
}

function logUnexpectedFailure(req, error) {
  try {
    req.log?.error?.(
      { errorType: errorType(error) },
      'moderation authentication failed',
    );
  } catch {
    // Authentication must still fail closed when logging is unavailable.
  }
}

export function createModerationAuth({ env = process.env } = {}) {
  let cachedRaw;
  let cachedEntries;

  return function moderationAuth(req, res, next) {
    const header = req?.headers?.authorization;
    if (header === undefined || header === null || header === '') {
      return res.status(401).json({ error: 'missing_moderation_key' });
    }
    if (typeof header !== 'string') {
      return res.status(401).json({ error: 'invalid_moderation_key' });
    }

    const match = header.match(/^Bearer\s+([^\s]+)$/i);
    if (!match || !isModerationApiKey(match[1])) {
      return res.status(401).json({ error: 'invalid_moderation_key' });
    }

    try {
      const rawConfig = env.MODERATION_API_KEY_HASHES_JSON;
      if (!cachedEntries || rawConfig !== cachedRaw) {
        const parsedEntries = parseModerationKeyHashes(rawConfig);
        cachedEntries = parsedEntries;
        cachedRaw = rawConfig;
      }

      const keyId = resolveModeratorKeyId(match[1], cachedEntries);
      if (!keyId) {
        return res.status(401).json({ error: 'invalid_moderation_key' });
      }

      req.moderator = { keyId };
    } catch (error) {
      if (error instanceof ModerationAuthConfigError) {
        return res.status(503).json({ error: 'moderation_auth_unconfigured' });
      }
      logUnexpectedFailure(req, error);
      return res.status(503).json({ error: 'moderation_auth_unavailable' });
    }

    return next();
  };
}
