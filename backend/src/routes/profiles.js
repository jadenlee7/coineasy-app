/**
 * /profiles routes — public/private social profile.
 *
 * Phase 1 (Path C): one row per user, joined to the existing User
 * model. Username is optional + unique; lowercase enforced here.
 *
 * Endpoints
 *   GET  /profiles/me            — authed, returns own profile + wallet address
 *   PUT  /profiles/me            — authed, edit own profile
 *   GET  /profiles/search?q=     — public username/display-name search
 *   GET  /profiles/by-username/:username  — public lookup
 *   GET  /profiles/:userId       — public lookup by internal id (no wallet)
 *
 * Counts (followers/following/posts) are computed on read so we don't
 * have to maintain denormalized counters in Phase 1. If hot, we can
 * add cached counters in a later PR.
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/db.js';

export const profilesRouter = Router();

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const SEARCH_LIMIT_DEFAULT = 20;
const SEARCH_LIMIT_MAX = 50;

const updateSchema = z.object({
  username: z
    .string()
    .transform((s) => s.toLowerCase())
    .refine((s) => USERNAME_RE.test(s), {
      message: 'username must match ^[a-z0-9_]{3,20}$',
    })
    .optional(),
  displayName: z.string().max(50).optional(),
  pfp: z.string().url().max(500).optional().nullable(),
  bio: z.string().max(280).optional().nullable(),
});

export function profileFields(user, { includeWalletAddress = false } = {}) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    pfp: user.pfp,
    bio: user.bio,
    ...(includeWalletAddress ? { walletAddress: user.walletAddress } : {}),
    subname: user.subnameStatus === 'ISSUED' ? user.subname : null,
    createdAt: user.createdAt,
  };
}

async function profileWithCounts(user, options) {
  if (!user) return null;
  const [followers, following, posts] = await Promise.all([
    prisma.follow.count({ where: { followeeId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.post.count({ where: { authorId: user.id, parentPostId: null } }),
  ]);
  return {
    ...profileFields(user, options),
    counts: { followers, following, posts },
  };
}

profilesRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { privyDid: req.user.privyDid },
  });
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ profile: await profileWithCounts(user, { includeWalletAddress: true }) });
});

profilesRouter.put('/me', requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'bad_input', details: parsed.error.issues });
  }
  const user = await prisma.user.findUnique({
    where: { privyDid: req.user.privyDid },
  });
  if (!user) return res.status(404).json({ error: 'not_found' });

  // Username uniqueness collision -> 409.
  if (parsed.data.username && parsed.data.username !== user.username) {
    const taken = await prisma.user.findUnique({
      where: { username: parsed.data.username },
    });
    if (taken && taken.id !== user.id) {
      return res.status(409).json({ error: 'username_taken' });
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
  });
  res.json({ profile: await profileWithCounts(updated, { includeWalletAddress: true }) });
});

profilesRouter.get('/search', async (req, res) => {
  const query = String(req.query.q || '').trim().replace(/^@/, '').slice(0, 50);
  const requestedLimit = Number(req.query.limit);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(Math.floor(requestedLimit), SEARCH_LIMIT_MAX)
    : SEARCH_LIMIT_DEFAULT;

  if (query.length < 2) return res.json({ rows: [] });

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: query, mode: 'insensitive' } },
        { displayName: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  const rows = await Promise.all(users.map((user) => profileWithCounts(user)));
  res.json({ rows });
});

profilesRouter.get('/by-username/:username', async (req, res) => {
  const username = String(req.params.username || '').toLowerCase();
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'bad_username' });
  }
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ profile: await profileWithCounts(user) });
});

profilesRouter.get('/:userId', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
  });
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ profile: await profileWithCounts(user) });
});
