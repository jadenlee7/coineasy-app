/**
 * /profiles routes — public/private social profile.
 *
 * Phase 1 (Path C): one row per user, joined to the existing User
 * model. Username is optional + unique; lowercase enforced here.
 *
 * Endpoints
 *   GET  /profiles/me            — authed, returns own profile
 *   PUT  /profiles/me            — authed, edit own profile
 *   GET  /profiles/by-username/:username  — public lookup
 *   GET  /profiles/:userId       — public lookup by internal id
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

async function publicProfile(user) {
  if (!user) return null;
  const [followers, following, posts] = await Promise.all([
    prisma.follow.count({ where: { followeeId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.post.count({ where: { authorId: user.id, parentPostId: null } }),
  ]);
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    pfp: user.pfp,
    bio: user.bio,
    walletAddress: user.walletAddress,
    createdAt: user.createdAt,
    counts: { followers, following, posts },
  };
}

profilesRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { privyDid: req.user.privyDid },
  });
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ profile: await publicProfile(user) });
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
  res.json({ profile: await publicProfile(updated) });
});

profilesRouter.get('/by-username/:username', async (req, res) => {
  const username = String(req.params.username || '').toLowerCase();
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'bad_username' });
  }
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ profile: await publicProfile(user) });
});

profilesRouter.get('/:userId', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
  });
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ profile: await publicProfile(user) });
});
