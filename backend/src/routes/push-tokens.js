/** Account-bound Expo push-token registration. Delivery remains a separate concern. */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { express4AsyncHandler } from '../lib/express-async.js';
import { pushTokenRegistrationEnabled } from '../lib/push-token-gates.js';
import { requireAuth } from '../middleware/auth.js';

const expoPushTokenPattern = /^(?:Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/u;
const tokenSchema = z.string().trim().min(20).max(255).regex(expoPushTokenPattern);
const registerSchema = z.object({
  platform: z.enum(['ios', 'android']),
  token: tokenSchema,
}).strict();
const unregisterSchema = z.object({ token: tokenSchema }).strict();

function invalidInput(res, parsed) {
  return res.status(400).json({ error: 'bad_input', details: parsed.error.issues });
}

export function createRegisterPushTokenHandler({
  db = prisma,
  env = process.env,
  now = () => new Date(),
  registrationEnabled = pushTokenRegistrationEnabled,
} = {}) {
  return async function registerPushToken(req, res) {
    res.set('Cache-Control', 'no-store');
    if (!registrationEnabled(env)) {
      return res.status(503).json({ error: 'push_token_registration_disabled' });
    }
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return invalidInput(res, parsed);

    const user = await db.user.findUnique({
      where: { privyDid: req.user.privyDid },
      select: { id: true },
    });
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    const lastSeenAt = now();
    const registration = await db.expoPushToken.upsert({
      where: { token: parsed.data.token },
      update: {
        userId: user.id,
        platform: parsed.data.platform,
        lastSeenAt,
      },
      create: {
        userId: user.id,
        token: parsed.data.token,
        platform: parsed.data.platform,
        lastSeenAt,
      },
      select: { platform: true, lastSeenAt: true },
    });

    return res.json({
      registration: {
        registered: true,
        platform: registration.platform,
        lastSeenAt: registration.lastSeenAt,
      },
    });
  };
}

export function createUnregisterPushTokenHandler({ db = prisma } = {}) {
  return async function unregisterPushToken(req, res) {
    res.set('Cache-Control', 'no-store');
    const parsed = unregisterSchema.safeParse(req.body);
    if (!parsed.success) return invalidInput(res, parsed);

    const user = await db.user.findUnique({
      where: { privyDid: req.user.privyDid },
      select: { id: true },
    });
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    await db.expoPushToken.deleteMany({
      where: { userId: user.id, token: parsed.data.token },
    });
    return res.json({ registration: { registered: false } });
  };
}

export const pushTokensRouter = Router();
pushTokensRouter.put(
  '/',
  requireAuth,
  express4AsyncHandler(createRegisterPushTokenHandler()),
);
pushTokensRouter.delete(
  '/',
  requireAuth,
  express4AsyncHandler(createUnregisterPushTokenHandler()),
);
