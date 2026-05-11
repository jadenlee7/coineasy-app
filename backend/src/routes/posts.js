/**
 * /posts routes — Twitter-style flat thread.
 *
 * Phase 1 (Path C):
 *   - Post is the only content unit.
 *   - Replies are Posts with parentPostId pointing at the parent Post.
 *   - mediaUrl column exists in DB (PR #9 schema) but upload flow is
 *     deferred to PR #10. For now mediaUrl is accepted as a plain URL
 *     string if the client provides one.
 *
 * Cursor pagination
 *   - Order: createdAt DESC, id DESC
 *   - cursor param: opaque to clients, but is just the last seen id.
 *   - Returns { rows, nextCursor }. nextCursor === null means end.
 *
 * Endpoints
 *   GET    /posts                  feed (global, newest first)
 *   GET    /posts/by-author/:userId  user timeline (root posts only)
 *   GET    /posts/:id              single post + author summary
 *   GET    /posts/:id/replies      replies to a post (cursor)
 *   POST   /posts                  create root post or reply (auth)
 *   DELETE /posts/:id              delete own post (auth)
 *   POST   /posts/:id/like         like (auth, idempotent)
 *   DELETE /posts/:id/like         unlike (auth, idempotent)
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/db.js';

export const postsRouter = Router();

const PAGE_DEFAULT = 20;
const PAGE_MAX = 100;

function parseLimit(q) {
  const n = Number(q.limit);
  if (!Number.isFinite(n) || n <= 0) return PAGE_DEFAULT;
  return Math.min(Math.floor(n), PAGE_MAX);
}

const authorSummary = {
  id: true,
  username: true,
  displayName: true,
  pfp: true,
};

async function shapePost(row, viewerUserId) {
  const [likeCount, replyCount, likedByMe] = await Promise.all([
    prisma.like.count({ where: { postId: row.id } }),
    prisma.post.count({ where: { parentPostId: row.id } }),
    viewerUserId
      ? prisma.like.findUnique({
          where: { postId_userId: { postId: row.id, userId: viewerUserId } },
        })
      : Promise.resolve(null),
  ]);
  return {
    id: row.id,
    body: row.body,
    mediaUrl: row.mediaUrl,
    parentPostId: row.parentPostId,
    createdAt: row.createdAt,
    author: row.author,
    counts: { likes: likeCount, replies: replyCount },
    likedByMe: !!likedByMe,
  };
}

async function viewerUserId(req) {
  // Optional auth: if a valid bearer is present, resolve viewer id;
  // otherwise treat as anonymous.
  const header = req.headers.authorization || '';
  if (!/^Bearer\s+/i.test(header)) return null;
  try {
    const { verifyAccessToken } = await import('../lib/privy.js');
    const token = header.replace(/^Bearer\s+/i, '');
    const { userId: privyDid } = await verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { privyDid } });
    return user?.id || null;
  } catch {
    return null;
  }
}

async function paginate({ where, limit, cursor }) {
  const rows = await prisma.post.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { author: { select: authorSummary } },
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { page, nextCursor: hasMore ? page[page.length - 1].id : null };
}

// --- GET /posts (global feed) ---------------------------------------
postsRouter.get('/', async (req, res) => {
  const limit = parseLimit(req.query);
  const cursor = req.query.cursor ? String(req.query.cursor) : null;
  const viewer = await viewerUserId(req);
  const { page, nextCursor } = await paginate({
    where: { parentPostId: null },
    limit,
    cursor,
  });
  const rows = await Promise.all(page.map((p) => shapePost(p, viewer)));
  res.json({ rows, nextCursor });
});

// --- GET /posts/by-author/:userId -----------------------------------
postsRouter.get('/by-author/:userId', async (req, res) => {
  const limit = parseLimit(req.query);
  const cursor = req.query.cursor ? String(req.query.cursor) : null;
  const viewer = await viewerUserId(req);
  const { page, nextCursor } = await paginate({
    where: { authorId: req.params.userId, parentPostId: null },
    limit,
    cursor,
  });
  const rows = await Promise.all(page.map((p) => shapePost(p, viewer)));
  res.json({ rows, nextCursor });
});

// --- GET /posts/:id (single) ----------------------------------------
postsRouter.get('/:id', async (req, res) => {
  const viewer = await viewerUserId(req);
  const post = await prisma.post.findUnique({
    where: { id: req.params.id },
    include: { author: { select: authorSummary } },
  });
  if (!post) return res.status(404).json({ error: 'not_found' });
  res.json({ post: await shapePost(post, viewer) });
});

// --- GET /posts/:id/replies -----------------------------------------
postsRouter.get('/:id/replies', async (req, res) => {
  const limit = parseLimit(req.query);
  const cursor = req.query.cursor ? String(req.query.cursor) : null;
  const viewer = await viewerUserId(req);
  const { page, nextCursor } = await paginate({
    where: { parentPostId: req.params.id },
    limit,
    cursor,
  });
  const rows = await Promise.all(page.map((p) => shapePost(p, viewer)));
  res.json({ rows, nextCursor });
});

// --- POST /posts (create) -------------------------------------------
const createSchema = z.object({
  body: z.string().min(1).max(2000),
  parentPostId: z.string().min(1).optional(),
  mediaUrl: z.string().url().max(500).optional().nullable(),
});

postsRouter.post('/', requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'bad_input', details: parsed.error.issues });
  }
  const user = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  if (parsed.data.parentPostId) {
    const parent = await prisma.post.findUnique({ where: { id: parsed.data.parentPostId } });
    if (!parent) return res.status(404).json({ error: 'parent_not_found' });
  }

  const created = await prisma.post.create({
    data: {
      authorId: user.id,
      body: parsed.data.body,
      parentPostId: parsed.data.parentPostId ?? null,
      mediaUrl: parsed.data.mediaUrl ?? null,
    },
    include: { author: { select: authorSummary } },
  });
  res.status(201).json({ post: await shapePost(created, user.id) });
});

// --- DELETE /posts/:id ----------------------------------------------
postsRouter.delete('/:id', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!user) return res.status(404).json({ error: 'user_not_found' });
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) return res.status(404).json({ error: 'not_found' });
  if (post.authorId !== user.id) return res.status(403).json({ error: 'forbidden' });
  await prisma.post.delete({ where: { id: post.id } });
  res.json({ ok: true });
});

// --- POST /posts/:id/like (idempotent) -------------------------------
postsRouter.post('/:id/like', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!user) return res.status(404).json({ error: 'user_not_found' });
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) return res.status(404).json({ error: 'not_found' });
  await prisma.like.upsert({
    where: { postId_userId: { postId: post.id, userId: user.id } },
    create: { postId: post.id, userId: user.id },
    update: {},
  });
  const likes = await prisma.like.count({ where: { postId: post.id } });
  res.json({ liked: true, likes });
});

// --- DELETE /posts/:id/like (idempotent) -----------------------------
postsRouter.delete('/:id/like', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!user) return res.status(404).json({ error: 'user_not_found' });
  await prisma.like
    .delete({ where: { postId_userId: { postId: req.params.id, userId: user.id } } })
    .catch(() => null); // ignore "not found" so endpoint is idempotent
  const likes = await prisma.like.count({ where: { postId: req.params.id } });
  res.json({ liked: false, likes });
});
