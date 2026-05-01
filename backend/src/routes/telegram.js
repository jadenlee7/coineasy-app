/**
 * /telegram routes — webhook receiver.
 *
 * Telegram POSTs updates to /telegram/webhook/<secret-path>.
 * The secret-path component prevents random hits from triggering the bot.
 */

import { Router } from 'express';
import { processUpdate } from '../lib/telegram.js';

export const telegramRouter = Router();

const SECRET_PATH = process.env.TELEGRAM_WEBHOOK_SECRET || 'unset';

telegramRouter.post(`/webhook/${SECRET_PATH}`, async (req, res) => {
  try {
    await processUpdate(req.body);
    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }, 'telegram webhook failed');
    res.status(500).json({ error: 'webhook_failed' });
  }
});

// Health probe for the bot subsystem.
telegramRouter.get('/health', (_req, res) => {
  res.json({ ok: true, configured: SECRET_PATH !== 'unset' });
});
