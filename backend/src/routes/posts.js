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
 *   GET    /posts                  feed (global, newest first; optional q/tag)
 *   GET    /posts/by-author/:userId  user timeline (root posts only)
 *   GET    /posts/:id              single post + author summary
 *   GET    /posts/:id/replies      replies to a post (cursor)
 *   POST   /posts                  create root post or reply (auth)
 *   PUT    /posts/:id              edit own post (auth)
 *   DELETE /posts/:id              delete own post (auth)
 *   POST   /posts/:id/report       report another user's post (auth, idempotent)
 *   POST   /posts/:id/like         like (auth, idempotent)
 *   DELETE /posts/:id/like         unlike (auth, idempotent)
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/db.js';
import { redactOwnedPost } from '../lib/account-deletion.js';
import { express4AsyncHandler } from '../lib/express-async.js';

export const postsRouter = Router();

const PAGE_DEFAULT = 20;
const PAGE_MAX = 100;
const REPORTS_PER_DAY_MAX = 20;

export const POST_REPORT_REASONS = Object.freeze([
  'SPAM',
  'NUDITY_SEXUAL_CONTENT',
  'HATE_SPEECH',
  'VIOLENCE_DANGEROUS',
  'BULLYING_HARASSMENT',
  'SCAM_FRAUD',
  'FALSE_INFORMATION',
]);

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
    deletedAt: row.deletedAt,
    deleted: Boolean(row.deletedAt),
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

function optionalTextQuery(value, maxLength = 100) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export function createGlobalFeedWhere({ query, tag } = {}) {
  return {
    parentPostId: null,
    deletedAt: null,
    authorId: { not: null },
    ...(query ? { body: { contains: query, mode: 'insensitive' } } : {}),
    ...(tag ? { AND: [{ body: { contains: tag, mode: 'insensitive' } }] } : {}),
  };
}

// --- GET /posts (global feed / text and hashtag discovery) ----------
postsRouter.get('/', express4AsyncHandler(async (req, res) => {
  const limit = parseLimit(req.query);
  const cursor = req.query.cursor ? String(req.query.cursor) : null;
  const query = optionalTextQuery(req.query.q);
  const tag = optionalTextQuery(req.query.tag, 50);
  const viewer = await viewerUserId(req);
  const { page, nextCursor } = await paginate({
    where: createGlobalFeedWhere({ query, tag }),
    limit,
    cursor,
  });
  const rows = await Promise.all(page.map((p) => shapePost(p, viewer)));
  res.json({ rows, nextCursor });
}));

// --- GET /posts/by-author/:userId -----------------------------------
postsRouter.get('/by-author/:userId', express4AsyncHandler(async (req, res) => {
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
}));

// --- GET /posts/:id (single) ----------------------------------------
postsRouter.get('/:id', express4AsyncHandler(async (req, res) => {
  const viewer = await viewerUserId(req);
  const post = await prisma.post.findUnique({
    where: { id: req.params.id },
    include: { author: { select: authorSummary } },
  });
  if (!post) return res.status(404).json({ error: 'not_found' });
  res.json({ post: await shapePost(post, viewer) });
}));

// --- GET /posts/:id/replies -----------------------------------------
postsRouter.get('/:id/replies', express4AsyncHandler(async (req, res) => {
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
}));

// --- POST /posts (create) -------------------------------------------
const createSchema = z.object({
  body: z.string().min(1).max(2000),
  parentPostId: z.string().min(1).optional(),
  mediaUrl: z.string().url().max(500).optional().nullable(),
});

postsRouter.post('/', requireAuth, express4AsyncHandler(async (req, res) => {
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
}));

// --- PUT /posts/:id (edit own post) --------------------------------
const updateSchema = z.object({
  body: z.string().min(1).max(2000),
  mediaUrl: z.string().url().max(500).optional().nullable(),
});

postsRouter.put('/:id', requireAuth, express4AsyncHandler(async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'bad_input', details: parsed.error.issues });
  }

  const user = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!user) return res.status(404).json({ error: 'user_not_found' });
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) return res.status(404).json({ error: 'not_found' });
  if (post.authorId !== user.id) return res.status(403).json({ error: 'forbidden' });

  const updated = await prisma.post.update({
    where: { id: post.id },
    data: {
      body: parsed.data.body,
      ...(Object.prototype.hasOwnProperty.call(parsed.data, 'mediaUrl')
        ? { mediaUrl: parsed.data.mediaUrl ?? null }
        : {}),
    },
    include: { author: { select: authorSummary } },
  });
  res.json({ post: await shapePost(updated, user.id) });
}));

// --- DELETE /posts/:id ----------------------------------------------
export function createDeletePostHandler({
  db = prisma,
  redactPost = redactOwnedPost,
} = {}) {
  return async function deletePost(req, res) {
    const user = await db.user.findUnique({ where: { privyDid: req.user.privyDid } });
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    const post = await db.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'not_found' });
    if (post.authorId !== user.id) return res.status(403).json({ error: 'forbidden' });
    const redacted = await redactPost(db, {
      postId: post.id,
      authorId: user.id,
    });
    if (!redacted) return res.status(409).json({ error: 'post_already_deleted' });
    return res.json({ ok: true, deleted: true });
  };
}

postsRouter.delete(
  '/:id',
  requireAuth,
  express4AsyncHandler(createDeletePostHandler()),
);

// --- POST /posts/:id/report (authenticated and idempotent) ----------
const reportSchema = z.object({
  reason: z.enum([...POST_REPORT_REASONS]),
}).strict();

export function createPostReportHandler({
  db = prisma,
  now = () => new Date(),
  reportsPerDayMax = REPORTS_PER_DAY_MAX,
} = {}) {
  return async function reportPost(req, res) {
    res.set('Cache-Control', 'no-store');
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'report_reason_invalid' });
    }

    const reporter = await db.user.findUnique({
      where: { privyDid: req.user.privyDid },
      select: { id: true },
    });
    if (!reporter) return res.status(404).json({ error: 'user_not_found' });

    const outcome = await db.$transaction(async (tx) => {
      // Serialize report creation per reporter. The unique constraint handles
      // same-pair replay; this lock also makes the rolling count a hard bound
      // when many different posts are reported concurrently.
      await tx.$queryRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0)) IS NULL AS "lockAcquired"',
        `post-report:${reporter.id}`,
      );

      const post = await tx.post.findUnique({
        where: { id: req.params.id },
        select: { id: true, authorId: true, deletedAt: true },
      });
      if (!post || post.deletedAt || !post.authorId) {
        return { body: { error: 'post_not_reportable' }, status: 404 };
      }
      if (post.authorId === reporter.id) {
        return { body: { error: 'cannot_report_own_post' }, status: 409 };
      }

      const unique = {
        postId_reporterId: { postId: post.id, reporterId: reporter.id },
      };
      const existing = await tx.postReport.findUnique({
        where: unique,
        select: { id: true },
      });
      if (existing) {
        return { body: { reported: true, duplicate: true }, status: 200 };
      }

      const currentTime = now();
      const windowStart = new Date(currentTime.getTime() - 24 * 60 * 60 * 1_000);
      const recentReports = await tx.postReport.count({
        where: {
          reporterId: reporter.id,
          createdAt: { gte: windowStart },
        },
      });
      if (recentReports >= reportsPerDayMax) {
        return { body: { error: 'report_rate_limited' }, retryAfter: '3600', status: 429 };
      }

      await tx.postReport.upsert({
        where: unique,
        create: {
          postId: post.id,
          reporterId: reporter.id,
          reason: parsed.data.reason,
        },
        update: {},
        select: { id: true },
      });
      return { body: { reported: true, duplicate: false }, status: 201 };
    });

    if (outcome.retryAfter) res.set('Retry-After', outcome.retryAfter);
    return res.status(outcome.status).json(outcome.body);
  };
}

postsRouter.post(
  '/:id/report',
  requireAuth,
  express4AsyncHandler(createPostReportHandler()),
);

// --- POST /posts/:id/like (idempotent) -------------------------------
postsRouter.post('/:id/like', requireAuth, express4AsyncHandler(async (req, res) => {
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
}));

// --- DELETE /posts/:id/like (idempotent) -----------------------------
postsRouter.delete('/:id/like', requireAuth, express4AsyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!user) return res.status(404).json({ error: 'user_not_found' });
  await prisma.like
    .delete({ where: { postId_userId: { postId: req.params.id, userId: user.id } } })
    .catch(() => null); // ignore "not found" so endpoint is idempotent
  const likes = await prisma.like.count({ where: { postId: req.params.id } });
  res.json({ liked: false, likes });
}));
