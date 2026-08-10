import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const advertiserSlug = z.string().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sha256Digest = z.string().regex(/^[a-f0-9]{64}$/);
const apiKey = z.string().min(32).max(256).regex(/^eg_adv_[A-Za-z0-9_-]+$/);

export class AdvertiserAuthConfigError extends Error {
  constructor() {
    super('advertiser API key configuration is invalid');
    this.name = 'AdvertiserAuthConfigError';
  }
}

export function hashAdvertiserApiKey(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function parseAdvertiserKeyHashes(raw) {
  if (!raw) throw new AdvertiserAuthConfigError();
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new AdvertiserAuthConfigError();
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AdvertiserAuthConfigError();
  }
  const entries = Object.entries(value);
  if (entries.length < 1 || entries.length > 1_000) {
    throw new AdvertiserAuthConfigError();
  }

  const hashes = new Set();
  const parsed = entries.map(([slug, digest]) => {
    const result = z.tuple([advertiserSlug, sha256Digest]).safeParse([slug, digest]);
    if (!result.success || hashes.has(result.data?.[1])) {
      throw new AdvertiserAuthConfigError();
    }
    hashes.add(result.data[1]);
    return result.data;
  });
  return parsed;
}

export function resolveAdvertiserSlug(token, entries) {
  const parsedToken = apiKey.safeParse(token);
  if (!parsedToken.success) return null;
  const candidate = Buffer.from(hashAdvertiserApiKey(parsedToken.data), 'hex');
  let matchedSlug = null;
  for (const [slug, digest] of entries) {
    const matches = timingSafeEqual(candidate, Buffer.from(digest, 'hex'));
    if (matches) matchedSlug = slug;
  }
  return matchedSlug;
}

export function createAdvertiserAuth({ db, env = process.env } = {}) {
  if (!db) throw new Error('db is required');
  let cachedRaw;
  let cachedEntries;

  return async function advertiserAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: 'missing_advertiser_key' });

    const rawConfig = env.ADVERTISER_API_KEY_HASHES_JSON || '';
    try {
      if (rawConfig !== cachedRaw) {
        cachedEntries = parseAdvertiserKeyHashes(rawConfig);
        cachedRaw = rawConfig;
      }
    } catch {
      return res.status(503).json({ error: 'advertiser_admin_unconfigured' });
    }

    const slug = resolveAdvertiserSlug(match[1], cachedEntries);
    if (!slug) return res.status(401).json({ error: 'invalid_advertiser_key' });

    try {
      const advertiser = await db.advertiser.findUnique({
        where: { slug },
        select: { id: true, slug: true, name: true, status: true },
      });
      if (!advertiser) {
        return res.status(503).json({ error: 'advertiser_not_provisioned' });
      }
      if (advertiser.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'advertiser_inactive' });
      }
      req.advertiser = advertiser;
      return next();
    } catch (error) {
      req.log?.error({ err: error }, 'advertiser authentication failed');
      return res.status(503).json({ error: 'advertiser_auth_unavailable' });
    }
  };
}
