/** Follow graph operations with authenticated user-block enforcement. */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/db.js';
import { express4AsyncHandler } from '../lib/express-async.js';
import { resolveOptionalSocialViewer } from '../lib/social-viewer.js';
import {
  isUserPairBlocked,
  lockUserPair,
  userVisibleToViewerWhere,
} from '../lib/user-blocks.js';

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

export function createFollowHandler({ db = prisma } = {}) {
  return async function follow(req, res) {
    const me = await db.user.findUnique({ where: { privyDid: req.user.privyDid } });
    if (!me) return res.status(404).json({ error: 'user_not_found' });
    if (req.params.targetUserId === me.id) {
      return res.status(400).json({ error: 'cannot_follow_self' });
    }

    const outcome = await db.$transaction(async (tx) => {
      await lockUserPair(tx, me.id, req.params.targetUserId);
      const target = await tx.user.findUnique({
        where: { id: req.params.targetUserId },
        select: { id: true },
      });
      if (!target) return { error: 'target_not_found', status: 404 };
      if (await isUserPairBlocked(tx, me.id, target.id)) {
        return { error: 'blocked_interaction', status: 409 };
      }
      await tx.follow.upsert({
        where: { followerId_followeeId: { followerId: me.id, followeeId: target.id } },
        create: { followerId: me.id, followeeId: target.id },
        update: {},
      });
      return { following: true };
    });
    if (outcome.error) return res.status(outcome.status).json({ error: outcome.error });
    return res.json(outcome);
  };
}

// Removing a relationship stays available even when either side has blocked
// the other. This lets users reduce existing interaction state at any time.
export function createUnfollowHandler({ db = prisma } = {}) {
  return async function unfollow(req, res) {
    const me = await db.user.findUnique({ where: { privyDid: req.user.privyDid } });
    if (!me) return res.status(404).json({ error: 'user_not_found' });
    await db.follow.deleteMany({
      where: { followerId: me.id, followeeId: req.params.targetUserId },
    });
    return res.json({ following: false });
  };
}

export function createFollowersHandler({ db = prisma, resolveViewer = resolveOptionalSocialViewer } = {}) {
  return async function followers(req, res) {
    const limit = parseLimit(req.query);
    const cursor = req.query.cursor ? String(req.query.cursor) : null;
    const viewer = await resolveViewer(req, { db });
    if (viewer?.id && await isUserPairBlocked(db, viewer.id, req.params.userId)) {
      return res.status(404).json({ error: 'not_found' });
    }
    const rows = await db.follow.findMany({
      where: {
        followeeId: req.params.userId,
        ...(viewer?.id ? {
          follower: { is: userVisibleToViewerWhere(viewer.id) },
        } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
      take: limit + 1,
      ...(cursor ? {
        cursor: { followerId_followeeId: { followerId: cursor, followeeId: req.params.userId } },
        skip: 1,
      } : {}),
      include: { follower: { select: userSummary } },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return res.json({
      rows: page.map((row) => row.follower),
      nextCursor: hasMore ? page.at(-1).followerId : null,
    });
  };
}

export function createFollowingHandler({ db = prisma, resolveViewer = resolveOptionalSocialViewer } = {}) {
  return async function following(req, res) {
    const limit = parseLimit(req.query);
    const cursor = req.query.cursor ? String(req.query.cursor) : null;
    const viewer = await resolveViewer(req, { db });
    if (viewer?.id && await isUserPairBlocked(db, viewer.id, req.params.userId)) {
      return res.status(404).json({ error: 'not_found' });
    }
    const rows = await db.follow.findMany({
      where: {
        followerId: req.params.userId,
        ...(viewer?.id ? {
          followee: { is: userVisibleToViewerWhere(viewer.id) },
        } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { followeeId: 'desc' }],
      take: limit + 1,
      ...(cursor ? {
        cursor: { followerId_followeeId: { followerId: req.params.userId, followeeId: cursor } },
        skip: 1,
      } : {}),
      include: { followee: { select: userSummary } },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return res.json({
      rows: page.map((row) => row.followee),
      nextCursor: hasMore ? page.at(-1).followeeId : null,
    });
  };
}

export function createFollowStatusHandler({ db = prisma } = {}) {
  return async function followStatus(req, res) {
    const me = await db.user.findUnique({ where: { privyDid: req.user.privyDid } });
    if (!me) return res.status(404).json({ error: 'user_not_found' });
    // Resolve existence and both block directions through the same relation
    // anti-filter. Missing and blocked targets are deliberately indistinguishable.
    const target = await db.user.findFirst({
      where: {
        id: req.params.targetUserId,
        ...userVisibleToViewerWhere(me.id),
      },
      select: { id: true },
    });
    if (!target) {
      return res.status(404).json({ error: 'not_found' });
    }
    const row = await db.follow.findUnique({
      where: {
        followerId_followeeId: { followerId: me.id, followeeId: req.params.targetUserId },
      },
    });
    return res.json({ following: Boolean(row) });
  };
}

followsRouter.post(
  '/follows/:targetUserId',
  requireAuth,
  express4AsyncHandler(createFollowHandler()),
);
followsRouter.delete(
  '/follows/:targetUserId',
  requireAuth,
  express4AsyncHandler(createUnfollowHandler()),
);
followsRouter.get(
  '/profiles/:userId/followers',
  express4AsyncHandler(createFollowersHandler()),
);
followsRouter.get(
  '/profiles/:userId/following',
  express4AsyncHandler(createFollowingHandler()),
);
followsRouter.get(
  '/follows/:targetUserId/status',
  requireAuth,
  express4AsyncHandler(createFollowStatusHandler()),
);
