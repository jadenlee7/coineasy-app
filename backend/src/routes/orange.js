/**
 * /orange routes — 🍊 Orange ledger.
 *
 * Phase 1 (Path C): Orange is a backend-DB point system, NOT a token.
 *   - Append-only OrangeLedger rows; balance = sum(delta).
 *   - Phase 2 (PHASE.ORANGE_TOKENIZED) may mirror to chain.
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/db.js';
import { PHASE } from '../../utils/easygo.js';

export const orangeRouter = Router();

const DAILY_ACTIVITY_TARGETS = { posts: 1, comments: 2, likes: 10 };
const COURSE_SECTION_IDS = new Set([
  ...Array.from({ length: 11 }, (_, index) => `1-${index + 1}`),
  ...Array.from({ length: 4 }, (_, index) => `2-${index + 1}`),
  ...Array.from({ length: 4 }, (_, index) => `3-${index + 1}`),
  ...Array.from({ length: 7 }, (_, index) => `${index + 4}-1`),
]);

function utcDayWindow(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end, dateKey: start.toISOString().slice(0, 10) };
}

function adSlot(now = new Date()) {
  const hour = now.getUTCHours();
  const nextAvailable = new Date(now);
  let slot;

  if (hour < 8) {
    slot = '00-08';
    nextAvailable.setUTCHours(8, 0, 0, 0);
  } else if (hour < 16) {
    slot = '08-16';
    nextAvailable.setUTCHours(16, 0, 0, 0);
  } else {
    slot = '16-24';
    nextAvailable.setUTCDate(nextAvailable.getUTCDate() + 1);
    nextAvailable.setUTCHours(0, 0, 0, 0);
  }

  return { slot, nextAvailable };
}

async function currentUser(req) {
  return prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
}

async function orangeBalance(userId) {
  const aggregate = await prisma.orangeLedger.aggregate({
    where: { userId },
    _sum: { delta: true },
  });
  return aggregate._sum.delta || 0;
}

async function activityProgress(userId, start) {
  const [posts, comments, likes] = await Promise.all([
    prisma.post.count({
      where: { authorId: userId, parentPostId: null, createdAt: { gte: start } },
    }),
    prisma.post.count({
      where: { authorId: userId, parentPostId: { not: null }, createdAt: { gte: start } },
    }),
    prisma.like.count({ where: { userId, createdAt: { gte: start } } }),
  ]);
  return { posts, comments, likes };
}

async function claimOnce({ userId, delta, reason, refId }) {
  const existing = await prisma.orangeLedger.findUnique({
    where: { reason_refId: { reason, refId } },
  });
  await prisma.orangeLedger.upsert({
    where: { reason_refId: { reason, refId } },
    create: { userId, delta, reason, refId },
    update: {},
  });
  return { claimed: !existing, balance: await orangeBalance(userId) };
}

orangeRouter.get('/balance', requireAuth, async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ balance: await orangeBalance(user.id) });
});

orangeRouter.get('/history', requireAuth, async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows = await prisma.orangeLedger.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json({ rows });
});

orangeRouter.get('/rewards/status', requireAuth, async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(404).json({ error: 'not_found' });

  const now = new Date();
  const { start, end, dateKey } = utcDayWindow(now);
  const { slot, nextAvailable: nextAdSlot } = adSlot(now);
  const refs = {
    dailyCheckin: `${user.id}:${dateKey}`,
    dailyActivity: `${user.id}:${dateKey}`,
    adReward: `${user.id}:${dateKey}:${slot}`,
  };
  const [progress, claimedRows, balance] = await Promise.all([
    activityProgress(user.id, start),
    prisma.orangeLedger.findMany({
      where: {
        OR: [
          { reason: 'DAILY_CHECKIN', refId: refs.dailyCheckin },
          { reason: 'DAILY_ACTIVITY', refId: refs.dailyActivity },
          { reason: 'AD_REWARD', refId: refs.adReward },
        ],
      },
      select: { reason: true },
    }),
    orangeBalance(user.id),
  ]);
  const claimed = new Set(claimedRows.map((row) => row.reason));

  res.json({
    balance,
    todayActivities: { date: dateKey, ...progress },
    targets: DAILY_ACTIVITY_TARGETS,
    dailyCheckin: {
      claimed: claimed.has('DAILY_CHECKIN'),
      nextAvailable: claimed.has('DAILY_CHECKIN') ? end.toISOString() : null,
    },
    dailyActivity: {
      claimed: claimed.has('DAILY_ACTIVITY'),
      nextAvailable: claimed.has('DAILY_ACTIVITY') ? end.toISOString() : null,
    },
    adReward: {
      claimed: claimed.has('AD_REWARD'),
      currentSlot: slot,
      nextAvailable: claimed.has('AD_REWARD') ? nextAdSlot.toISOString() : null,
    },
  });
});

orangeRouter.post('/claims/first-reward', requireAuth, async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json(await claimOnce({
    userId: user.id,
    delta: 50,
    reason: 'FIRST_REWARD',
    refId: user.id,
  }));
});

orangeRouter.post('/claims/daily-checkin', requireAuth, async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const { end, dateKey } = utcDayWindow();
  const result = await claimOnce({
    userId: user.id,
    delta: 20,
    reason: 'DAILY_CHECKIN',
    refId: `${user.id}:${dateKey}`,
  });
  res.json({ ...result, nextAvailable: end.toISOString() });
});

orangeRouter.post('/claims/daily-activity', requireAuth, async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const { start, end, dateKey } = utcDayWindow();
  const progress = await activityProgress(user.id, start);
  const complete = Object.entries(DAILY_ACTIVITY_TARGETS)
    .every(([key, target]) => progress[key] >= target);
  if (!complete) {
    return res.status(409).json({
      error: 'reward_requirements_not_met',
      progress,
      targets: DAILY_ACTIVITY_TARGETS,
    });
  }
  const result = await claimOnce({
    userId: user.id,
    delta: 30,
    reason: 'DAILY_ACTIVITY',
    refId: `${user.id}:${dateKey}`,
  });
  res.json({ ...result, progress, nextAvailable: end.toISOString() });
});

orangeRouter.post('/claims/ad-reward', requireAuth, async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const { dateKey } = utcDayWindow();
  const { slot, nextAvailable } = adSlot();
  const result = await claimOnce({
    userId: user.id,
    delta: 10,
    reason: 'AD_REWARD',
    refId: `${user.id}:${dateKey}:${slot}`,
  });
  res.json({ ...result, slot, nextAvailable: nextAvailable.toISOString() });
});

const courseClaimSchema = z.object({
  courseId: z.coerce.string().min(1).max(16),
  sectionId: z.string().min(1).max(32),
});

orangeRouter.post('/claims/course-quiz', requireAuth, async (req, res) => {
  if (PHASE.QUESTS_ENABLED) {
    return res.status(410).json({ error: 'quest_api_required' });
  }
  const user = await currentUser(req);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const parsed = courseClaimSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'bad_input', details: parsed.error.issues });
  }
  const { courseId, sectionId } = parsed.data;
  if (!COURSE_SECTION_IDS.has(sectionId) || !sectionId.startsWith(`${courseId}-`)) {
    return res.status(400).json({ error: 'unknown_course_section' });
  }
  res.json(await claimOnce({
    userId: user.id,
    delta: 60,
    reason: 'COURSE_QUIZ',
    refId: `${user.id}:${sectionId}`,
  }));
});

const earnSchema = z.object({
  privyDid: z.string(),
  delta: z.number().int().positive(),
  reason: z.string().max(64),
  refId: z.string().max(128).optional(),
});

orangeRouter.post('/earn', async (req, res) => {
  const adminSecret = req.headers['x-admin-secret'];
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'forbidden' });
  }
  const parsed = earnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'bad_input', details: parsed.error.issues });
  const user = await prisma.user.findUnique({ where: { privyDid: parsed.data.privyDid } });
  if (!user) return res.status(404).json({ error: 'user_not_found' });
  const row = await prisma.orangeLedger.create({
    data: {
      userId: user.id,
      delta: parsed.data.delta,
      reason: parsed.data.reason,
      refId: parsed.data.refId,
    },
  });
  res.json({ row });
});
