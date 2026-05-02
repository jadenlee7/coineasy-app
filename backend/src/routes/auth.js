/**
 * /auth routes.
 *
 * POST /auth/sync   - upsert User row from a verified Privy session.
 *                     Awards 100 🍊 Orange welcome bonus on first creation.
 * GET  /auth/me     - return profile for the bearer token holder.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getUser, extractProfile } from '../lib/privy.js';
import { prisma } from '../lib/db.js';

export const authRouter = Router();

const WELCOME_ORANGE = 100;

authRouter.post('/sync', requireAuth, async (req, res) => {
  const privyUser = await getUser(req.user.privyDid);
  const profile = extractProfile(privyUser);

  const existing = await prisma.user.findUnique({ where: { privyDid: profile.privyDid } });

  const user = await prisma.user.upsert({
    where: { privyDid: profile.privyDid },
    update: {
      telegramId: profile.telegramId,
      telegramUsername: profile.telegramUsername,
      kakaoId: profile.kakaoId,
      walletAddress: profile.walletAddress,
    },
    create: { ...profile },
  });

  // First-time welcome bonus.
  if (!existing) {
    await prisma.orangeLedger.create({
      data: {
        userId: user.id,
        delta: WELCOME_ORANGE,
        reason: 'WELCOME_BONUS',
      },
    });
  }

  res.json({ user, isNew: !existing });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ user });
});
