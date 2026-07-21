/**
 * /notifications — authenticated social activity inbox.
 *
 * Phase 1 derives activity from the canonical Follow, Like, and Post tables.
 * This keeps notifications consistent without introducing a duplicate event
 * table or a database migration. Read markers and push delivery can be added
 * later when the product needs durable unread state.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/db.js';

export const notificationsRouter = Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const actorSummary = {
  id: true,
  username: true,
  displayName: true,
  pfp: true,
};

function parseLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function compareNewest(left, right) {
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

notificationsRouter.get('/', requireAuth, async (req, res) => {
  const me = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!me) return res.status(404).json({ error: 'user_not_found' });

  const limit = parseLimit(req.query.limit);
  const sourceLimit = Math.min(limit * 2, MAX_LIMIT);
  const [follows, likes, replies] = await Promise.all([
    prisma.follow.findMany({
      where: { followeeId: me.id, followerId: { not: me.id } },
      orderBy: { createdAt: 'desc' },
      take: sourceLimit,
      include: { follower: { select: actorSummary } },
    }),
    prisma.like.findMany({
      where: {
        userId: { not: me.id },
        post: { authorId: me.id },
      },
      orderBy: { createdAt: 'desc' },
      take: sourceLimit,
      include: {
        user: { select: actorSummary },
        post: { select: { id: true, body: true } },
      },
    }),
    prisma.post.findMany({
      where: {
        authorId: { not: me.id },
        parentPostId: { not: null },
        parent: { is: { authorId: me.id } },
      },
      orderBy: { createdAt: 'desc' },
      take: sourceLimit,
      include: {
        author: { select: actorSummary },
        parent: { select: { id: true, body: true } },
      },
    }),
  ]);

  const rows = [
    ...follows.map((row) => ({
      id: `follow:${row.followerId}:${row.followeeId}`,
      family: 'follow',
      createdAt: row.createdAt,
      actor: row.follower,
      postId: null,
      postPreview: null,
    })),
    ...likes.map((row) => ({
      id: `like:${row.postId}:${row.userId}`,
      family: 'reaction',
      createdAt: row.createdAt,
      actor: row.user,
      postId: row.post.id,
      postPreview: row.post.body.slice(0, 140),
    })),
    ...replies.map((row) => ({
      id: `reply:${row.id}`,
      family: 'reply_to',
      createdAt: row.createdAt,
      actor: row.author,
      postId: row.parent.id,
      replyId: row.id,
      postPreview: row.body.slice(0, 140),
    })),
  ].sort(compareNewest).slice(0, limit);

  res.json({ rows });
});
