/**
 * Telegram bot wrapper.
 *
 * Two modes are supported:
 *   - Long polling (dev/local): startTelegramBot() spins up a polling client.
 *   - Webhook (prod): src/routes/telegram.js receives POSTs from Telegram
 *     and feeds them into processUpdate().
 *
 * Phase 1 commands:
 *   /start    - greeting + 🍊 Orange welcome bonus (handled in routes/orange.js)
 *   /balance  - 🍊 Orange balance lookup
 *   /invite   - referral link
 *
 * The bot module deliberately keeps business logic OUT of here —
 * it just routes commands to handlers.
 */

import TelegramBot from 'node-telegram-bot-api';
import { logger } from './logger.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;

let _bot = null;

export function getBot() {
  if (_bot) return _bot;
  if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not set');
  // Polling=false here — we choose mode at start time.
  _bot = new TelegramBot(TOKEN, { polling: false });
  return _bot;
}

/**
 * Long-poll mode (dev). For prod, prefer webhooks.
 */
export async function startTelegramBot() {
  if (!TOKEN) {
    logger.warn('TELEGRAM_BOT_TOKEN missing — bot not started');
    return;
  }
  const bot = new TelegramBot(TOKEN, { polling: true });
  _bot = bot;
  registerHandlers(bot);
  logger.info('telegram bot started (long-poll)');
}

/**
 * Webhook mode entry — called from routes/telegram.js.
 */
export async function processUpdate(update) {
  const bot = getBot();
  if (WEBHOOK_URL) {
    // ensure webhook is set (idempotent on Telegram side)
    try {
      await bot.setWebHook(WEBHOOK_URL);
    } catch (err) {
      logger.error({ err }, 'setWebHook failed');
    }
  }
  // node-telegram-bot-api exposes processUpdate for webhook mode
  bot.processUpdate(update);
}

function registerHandlers(bot) {
  bot.onText(/^\/start(?:@\w+)?$/, async (msg) => {
    await bot.sendMessage(
      msg.chat.id,
      '안녕하세요! EasyGo입니다 🍊\n앱을 통해 가입하시면 환영 🍊 Orange 100개를 드려요.',
    );
  });

  bot.onText(/^\/balance$/, async (msg) => {
    // TODO: fetch from /orange/:telegramId
    await bot.sendMessage(msg.chat.id, '잔액 조회는 곧 지원됩니다.');
  });

  bot.onText(/^\/invite$/, async (msg) => {
    // TODO: generate referral code from DB
    await bot.sendMessage(msg.chat.id, '초대 링크 기능 준비 중입니다.');
  });

  bot.on('polling_error', (err) => logger.error({ err }, 'telegram polling error'));
}
