/**
 * EasyGo Phase 1 backend — entry point.
 *
 * Boots Express, mounts route modules, and (optionally) starts the
 * Telegram bot if TELEGRAM_BOT_TOKEN is provided.
 *
 * NOTE (Phase 1 / Path C):
 *   - Chain target: Base (chainId 8453). EasyChain is Phase 2-gated.
 *   - 🍊 Orange is a backend-DB ledger (NOT a token in Phase 1).
 *   - All external SDKs (Privy, Squid, Telegram) are wired through
 *     thin wrappers in src/lib/* so they can be swapped/mocked.
 */

import 'dotenv/config';
import express from 'express';
import pinoHttp from 'pino-http';
import { logger } from './lib/logger.js';
import { authRouter } from './routes/auth.js';
import { orangeRouter } from './routes/orange.js';
import { swapRouter } from './routes/swap.js';
import { telegramRouter } from './routes/telegram.js';
import { startTelegramBot } from './lib/telegram.js';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json({ limit: '1mb' }));
app.use(pinoHttp({ logger }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'easygo-backend', phase: 1 });
});

app.use('/auth', authRouter);
app.use('/orange', orangeRouter);
app.use('/swap', swapRouter);
app.use('/telegram', telegramRouter);

// Optional: long-poll Telegram bot (only if token present).
if (process.env.TELEGRAM_BOT_TOKEN) {
  startTelegramBot().catch((err) => logger.error({ err }, 'telegram bot failed'));
}

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'easygo-backend listening');
});
