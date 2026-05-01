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

export const orangeRouter = Router();

orangeRouter.get('/balance', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!user) return res.status(404).json({ error: 'not_found' });
  const agg = await prisma.orangeLedger.aggregate({
    where: { userId: user.id },
    _sum: { delta: true },
  });
  res.json({ balance: agg._sum.delta || 0 });
});

orangeRouter.get('/history', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!user) return res.status(404).json({ error: 'not_found' });
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows = await prisma.orangeLedger.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json({ rows });
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
