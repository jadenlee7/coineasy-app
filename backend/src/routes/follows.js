/**
 * /follows routes — graph operations.
 *
 * Endpoints
 *   POST   /follows/:targetUserId   follow (auth, idempotent)
 *   DELETE /follows/:targetUserId   unfollow (auth, idempotent)
 *   GET    /profiles/:userId/followers  — handled here for cohesion
 *   GET    /profiles/:userId/following  — handled here for cohesion
 *
 * NOTE: We intentionally mount this router at root ('') in index.js so
 * the path prefixes match REST conventions across /follows and
 * /profiles/:userId/{followers,following}.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/db.js';

export const followsRouter = Router();

const userSummary = {
  id: true,
  username: true,
  displayName: true,
  pfp: true,
};

const PAGE_DEFAULT = 50;
const PAGE_MAX = 200;
function parseLimit(q) {
  const n = Number(q.limit);
  if (!Number.isFinite(n) || n <= 0) return PAGE_DEFAULT;
  return Math.min(Math.floor(n), PAGE_MAX);
}

// POST /follows/:targetUserId
followsRouter.post('/follows/:targetUserId', requireAuth, async (req, res) => {
  const me = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!me) return res.status(404).json({ error: 'user_not_found' });
  const target = await prisma.user.findUnique({ where: { id: req.params.targetUserId } });
  if (!target) return res.status(404).json({ error: 'target_not_found' });
  if (target.id === me.id) return res.status(400).json({ error: 'cannot_follow_self' });

  await prisma.follow.upsert({
    where: { followerId_followeeId: { followerId: me.id, followeeId: target.id } },
    create: { followerId: me.id, followeeId: target.id },
    update: {},
  });
  res.json({ following: true });
});

// DELETE /follows/:targetUserId
followsRouter.delete('/follows/:targetUserId', requireAuth, async (req, res) => {
  const me = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!me) return res.status(404).json({ error: 'user_not_found' });
  await prisma.follow
    .delete({
      where: {
        followerId_followeeId: { followerId: me.id, followeeId: req.params.targetUserId },
      },
    })
    .catch(() => null); // idempotent
  res.json({ following: false });
});

// GET /profiles/:userId/followers
followsRouter.get('/profiles/:userId/followers', async (req, res) => {
  const limit = parseLimit(req.query);
  const cursor = req.query.cursor ? String(req.query.cursor) : null;
  const rows = await prisma.follow.findMany({
    where: { followeeId: req.params.userId },
    orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { followerId_followeeId: { followerId: cursor, followeeId: req.params.userId } }, skip: 1 } : {}),
    include: { follower: { select: userSummary } },
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  res.json({
    rows: page.map((r) => r.follower),
    nextCursor: hasMore ? page[page.length - 1].followerId : null,
  });
});

// GET /profiles/:userId/following
followsRouter.get('/profiles/:userId/following', async (req, res) => {
  const limit = parseLimit(req.query);
  const cursor = req.query.cursor ? String(req.query.cursor) : null;
  const rows = await prisma.follow.findMany({
    where: { followerId: req.params.userId },
    orderBy: [{ createdAt: 'desc' }, { followeeId: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { followerId_followeeId: { followerId: req.params.userId, followeeId: cursor } }, skip: 1 } : {}),
    include: { followee: { select: userSummary } },
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  res.json({
    rows: page.map((r) => r.followee),
    nextCursor: hasMore ? page[page.length - 1].followeeId : null,
  });
});

// GET /follows/:targetUserId/status — does the viewer follow target?
followsRouter.get('/follows/:targetUserId/status', requireAuth, async (req, res) => {
  const me = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!me) return res.status(404).json({ error: 'user_not_found' });
  const row = await prisma.follow.findUnique({
    where: {
      followerId_followeeId: { followerId: me.id, followeeId: req.params.targetUserId },
    },
  });
  res.json({ following: !!row });
});
