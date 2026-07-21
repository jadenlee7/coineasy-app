/** EasyGo web process entry point. */
import 'dotenv/config';
import { createApp } from './app.js';
import { prisma } from './lib/db.js';
import { createShutdown, registerProcessHandlers } from './lib/lifecycle.js';
import { logger } from './lib/logger.js';
import { createTelemetry } from './lib/telemetry.js';
import {
  configureTelegramWebhook,
  startTelegramBot,
  stopTelegramBot,
  telegramStartupMode,
} from './lib/telegram.js';

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const telemetry = createTelemetry({ env: process.env, appLogger: logger });
const app = createApp({ db: prisma, env: process.env, appLogger: logger, telemetry });

const server = app.listen(port, () => {
  logger.info(
    { port, sentryEnabled: telemetry.enabled },
    'easygo-backend listening',
  );
});

const shutdown = createShutdown({
  server,
  db: prisma,
  telemetry,
  stopBot: stopTelegramBot,
  appLogger: logger,
  timeoutMs: process.env.SHUTDOWN_TIMEOUT_MS,
});
registerProcessHandlers({ shutdown });

const telegramMode = telegramStartupMode(process.env);
if (telegramMode !== 'disabled') {
  const startTelegram = telegramMode === 'webhook'
    ? configureTelegramWebhook
    : startTelegramBot;
  startTelegram().catch((error) => {
    telemetry.captureException(error, { tags: { subsystem: 'telegram' } });
    logger.error({ errorType: error?.name || 'Error' }, 'telegram bot failed');
  });
}
