/**
 * /posts routes — Twitter-style flat thread.
 *
 * Phase 1 (Path C):
 *   - Post is the only content unit.
 *   - Replies are Posts with parentPostId pointing at the parent Post.
 *   - mediaUrl exists in the DB, but upload and server-authoritative media
 *     screening are deferred. Create/edit reject every non-null media URL;
 *     edit omission preserves legacy media and null removes it.
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
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/db.js';
import { redactOwnedPost } from '../lib/account-deletion.js';
import { express4AsyncHandler } from '../lib/express-async.js';
import { PENDING_REPORTS_PER_POST_MAX } from '../lib/moderation-limits.js';
import {
  inspectPostContentSafety,
  inspectPostMediaSafety,
  POST_CONTENT_SAFETY_REJECTION_CODE,
  POST_MEDIA_SAFETY_REJECTION_CODE,
} from '../lib/post-content-safety.js';

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

export function publicPostContent(row) {
  const deleted = Boolean(row.deletedAt);
  return {
    body: deleted ? '' : row.body,
    mediaUrl: deleted ? null : row.mediaUrl,
    author: deleted ? null : row.author,
  };
}

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
  const deleted = Boolean(row.deletedAt);
  const safeContent = publicPostContent(row);
  return {
    id: row.id,
    body: safeContent.body,
    mediaUrl: safeContent.mediaUrl,
    parentPostId: row.parentPostId,
    deletedAt: row.deletedAt,
    deleted,
    createdAt: row.createdAt,
    author: safeContent.author,
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

function rejectUnsafePostValue(res, value, inspectValue, rejectionCode) {
  const result = inspectValue(value);
  if (result?.allowed === true) return false;
  res.set('Cache-Control', 'no-store');
  res.status(422).json({ error: rejectionCode });
  return true;
}

export function createCreatePostHandler({
  db = prisma,
  shape = shapePost,
  inspectContent = inspectPostContentSafety,
  inspectMedia = inspectPostMediaSafety,
} = {}) {
  return async function createPost(req, res) {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'bad_input', details: parsed.error.issues });
    }
    if (rejectUnsafePostValue(
      res,
      parsed.data.body,
      inspectContent,
      POST_CONTENT_SAFETY_REJECTION_CODE,
    )) return res;
    if (rejectUnsafePostValue(
      res,
      parsed.data.mediaUrl,
      inspectMedia,
      POST_MEDIA_SAFETY_REJECTION_CODE,
    )) return res;

    const user = await db.user.findUnique({ where: { privyDid: req.user.privyDid } });
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    if (parsed.data.parentPostId) {
      const parent = await db.post.findUnique({ where: { id: parsed.data.parentPostId } });
      if (!parent) return res.status(404).json({ error: 'parent_not_found' });
    }

    const created = await db.post.create({
      data: {
        authorId: user.id,
        body: parsed.data.body,
        parentPostId: parsed.data.parentPostId ?? null,
        mediaUrl: parsed.data.mediaUrl ?? null,
      },
      include: { author: { select: authorSummary } },
    });
    return res.status(201).json({ post: await shape(created, user.id) });
  };
}

postsRouter.post(
  '/',
  requireAuth,
  express4AsyncHandler(createCreatePostHandler()),
);

// --- PUT /posts/:id (edit own post) --------------------------------
const updateSchema = z.object({
  body: z.string().min(1).max(2000),
  mediaUrl: z.string().url().max(500).optional().nullable(),
});

export function createUpdatePostHandler({
  db = prisma,
  shape = shapePost,
  inspectContent = inspectPostContentSafety,
  inspectMedia = inspectPostMediaSafety,
} = {}) {
  return async function updatePost(req, res) {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'bad_input', details: parsed.error.issues });
    }
    if (rejectUnsafePostValue(
      res,
      parsed.data.body,
      inspectContent,
      POST_CONTENT_SAFETY_REJECTION_CODE,
    )) return res;
    if (rejectUnsafePostValue(
      res,
      parsed.data.mediaUrl,
      inspectMedia,
      POST_MEDIA_SAFETY_REJECTION_CODE,
    )) return res;

    const user = await db.user.findUnique({ where: { privyDid: req.user.privyDid } });
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    const outcome = await db.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0)) IS NULL AS "lockAcquired"',
        `post-report-target:${req.params.id}`,
      );
      const post = await tx.post.findUnique({ where: { id: req.params.id } });
      if (!post) return { error: 'not_found', status: 404 };
      if (post.authorId !== user.id) return { error: 'forbidden', status: 403 };

      const mutation = await tx.post.updateMany({
        where: {
          id: post.id,
          authorId: user.id,
          deletedAt: null,
          contentRevision: post.contentRevision,
        },
        data: {
          body: parsed.data.body,
          ...(Object.prototype.hasOwnProperty.call(parsed.data, 'mediaUrl')
            ? { mediaUrl: parsed.data.mediaUrl ?? null }
            : {}),
          contentRevision: { increment: 1 },
        },
      });
      if (mutation.count !== 1) {
        return { error: 'post_changed', status: 409 };
      }
      const updated = await tx.post.findUnique({
        where: { id: post.id },
        include: { author: { select: authorSummary } },
      });
      return { updated };
    });
    if (outcome.error) return res.status(outcome.status).json({ error: outcome.error });
    return res.json({ post: await shape(outcome.updated, user.id) });
  };
}

postsRouter.put(
  '/:id',
  requireAuth,
  express4AsyncHandler(createUpdatePostHandler()),
);

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
  pendingReportsPerPostMax = PENDING_REPORTS_PER_POST_MAX,
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
      // Share a post-scoped lock with the moderation decision path. This
      // prevents a new report from being inserted while the same post is
      // atomically redacted and all of its pending reports are resolved.
      await tx.$queryRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0)) IS NULL AS "lockAcquired"',
        `post-report-target:${req.params.id}`,
      );

      const post = await tx.post.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          authorId: true,
          deletedAt: true,
          contentRevision: true,
        },
      });
      if (!post || post.deletedAt || !post.authorId) {
        return { body: { error: 'post_not_reportable' }, status: 404 };
      }
      if (post.authorId === reporter.id) {
        return { body: { error: 'cannot_report_own_post' }, status: 409 };
      }

      const currentIdentity = {
        postId: post.id,
        reporterId: reporter.id,
        postRevision: post.contentRevision,
      };
      const existing = await tx.postReport.findFirst({
        where: currentIdentity,
        select: { id: true },
      });
      if (existing) {
        return { body: { reported: true, duplicate: true }, status: 200 };
      }

      const pendingForPost = await tx.postReport.count({
        where: {
          postId: post.id,
          status: { in: ['OPEN', 'REVIEWING'] },
        },
      });
      if (pendingForPost >= pendingReportsPerPostMax) {
        // The allegation is already represented by a bounded active queue for
        // this post. Keep the public response indistinguishable from an exact
        // duplicate and avoid creating an unbounded Sybil-controlled fan-out.
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

      // Do not catch a Prisma P2002 inside this transaction: PostgreSQL marks
      // the transaction aborted after a unique violation. A target-free
      // ON CONFLICT keeps both the expand-phase legacy unique index and the
      // revision-scoped unique index non-throwing. Once the separately
      // approved contract migration removes the legacy index, later revisions
      // begin inserting without another application release.
      const inserted = await tx.$queryRawUnsafe(
        `INSERT INTO "PostReport" (
          "id", "postId", "reporterId", "reason", "postRevision", "updatedAt"
        ) VALUES ($1, $2, $3, $4::"PostReportReason", $5, $6)
        ON CONFLICT DO NOTHING
        RETURNING "id"`,
        randomUUID(),
        post.id,
        reporter.id,
        parsed.data.reason,
        post.contentRevision,
        currentTime,
      );
      const created = Array.isArray(inserted) && inserted.length === 1;
      return {
        body: { reported: true, duplicate: !created },
        status: created ? 201 : 200,
      };
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
