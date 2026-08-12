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
 *   /wallet   - linked wallet address
 *   /help     - command guide
 *
 * The bot module deliberately keeps business logic OUT of here —
 * it just routes commands to handlers.
 */

import TelegramBot from 'node-telegram-bot-api';
import { buildAmaConfig } from './ama-config.js';
import { createAmaService } from './ama-service.js';
import { createAmaTranslator } from './ama-translation.js';
import { prisma } from './db.js';
import { logger } from './logger.js';
import { createTelegramAmaController } from './telegram-ama.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;
const DEFAULT_BASE_EXPLORER_URL = 'https://basescan.org';

function getTelegramBotUsername(env = process.env) {
  return String(
    env.TELEGRAM_BOT_USERNAME || env.EXPO_PUBLIC_TG_BOT_USERNAME || '',
  ).trim();
}

let _bot = null;
let _amaController = null;

export async function getTelegramBalanceById(db, telegramId) {
  const normalized = String(telegramId || '').trim();
  if (!normalized) return null;
  const user = await db.user.findUnique({
    where: { telegramId: normalized },
  });
  if (!user) return null;

  const aggregate = await db.orangeLedger.aggregate({
    where: { userId: user.id },
    _sum: { delta: true },
  });

  return {
    userId: user.id,
    balance: aggregate._sum.delta || 0,
  };
}

export async function getTelegramWalletById(db, telegramId) {
  const normalized = String(telegramId || '').trim();
  if (!normalized) return null;
  const user = await db.user.findUnique({
    where: { telegramId: normalized },
    select: { id: true, walletAddress: true },
  });
  if (!user) return null;

  return {
    userId: user.id,
    walletAddress: user.walletAddress || null,
  };
}

function buildTelegramInviteLink(env = process.env) {
  const botUsername = getTelegramBotUsername(env);
  if (!botUsername) return null;
  return `https://t.me/${botUsername}?start=invite`;
}

function formatBalance(balance) {
  return `${Intl.NumberFormat('en-US').format(balance)} Orange`;
}

function buildWalletExplorerUrl(walletAddress, env = process.env) {
  const baseUrl = String(
    env.BASESCAN_URL ||
      env.EXPO_PUBLIC_BASESCAN_URL ||
      env.EXPO_PUBLIC_BASE_EXPLORER_URL ||
      DEFAULT_BASE_EXPLORER_URL,
  ).replace(/\/+$/, '');
  return `${baseUrl}/address/${walletAddress}`;
}

function buildTelegramHelpText(amaEnabled) {
  const lines = [
    'EasyGo Bot 명령어',
    '/start - 앱 연동/웰컴 안내',
    '/balance - 🍊 Orange 보유량 조회',
    '/wallet - 연동 지갑 주소 조회',
    '/invite - 추천 링크 생성',
  ];

  if (amaEnabled) {
    lines.push('/ama - AMA 운영자 안내(운영 중에만 노출)');
  }

  return lines.join('\n');
}

export function telegramStartupMode(env = process.env) {
  if (!String(env.TELEGRAM_BOT_TOKEN || '').trim()) return 'disabled';
  return String(env.TELEGRAM_WEBHOOK_URL || '').trim() ? 'webhook' : 'polling';
}

export function getBot() {
  if (_bot) return _bot;
  if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not set');
  // Polling=false here — we choose mode at start time.
  _bot = new TelegramBot(TOKEN, { polling: false });
  registerHandlers(_bot);
  return _bot;
}

/**
 * Long-poll mode (dev). For prod, prefer webhooks.
 */
export async function startTelegramBot() {
  if (!TOKEN) {
    logger.warn('TELEGRAM_BOT_TOKEN missing — bot not started');
    return null;
  }
  const bot = new TelegramBot(TOKEN, { polling: true });
  _bot = bot;
  registerHandlers(bot);
  logger.info('telegram bot started (long-poll)');
  return bot;
}

export async function configureTelegramWebhook() {
  if (!TOKEN) {
    logger.warn('TELEGRAM_BOT_TOKEN missing — webhook not configured');
    return null;
  }
  if (!WEBHOOK_URL) throw new Error('TELEGRAM_WEBHOOK_URL not set');
  const bot = getBot();
  await bot.setWebHook(WEBHOOK_URL);
  logger.info('telegram bot configured (webhook)');
  return bot;
}

export async function stopTelegramBot() {
  const bot = _bot;
  _bot = null;
  _amaController?.dispose();
  _amaController = null;
  if (!bot) return;
  await bot.stopPolling({ cancel: true, reason: 'EasyGo shutdown' });
  logger.info('telegram bot client stopped');
}

/**
 * Webhook mode entry — called from routes/telegram.js.
 */
export async function processUpdate(update) {
  const bot = getBot();
  // node-telegram-bot-api exposes processUpdate for webhook mode
  bot.processUpdate(update);
}

export function registerHandlers(bot, {
  db = prisma,
  env = process.env,
  appLogger = logger,
} = {}) {
  const amaConfig = buildAmaConfig(env);
  let amaController = null;

  if (amaConfig.enabled && !amaConfig.valid) {
    appLogger.error(
      { errors: amaConfig.errors },
      'Squid Korea AMA is enabled but configuration is invalid',
    );
  } else if (amaConfig.enabled) {
    const service = createAmaService({ prisma: db, config: amaConfig });
    const translator = createAmaTranslator({ config: amaConfig });
    amaController = createTelegramAmaController({
      bot,
      service,
      translator,
      config: amaConfig,
      appLogger,
    });
    amaController.register();
    amaController.initialize().catch((error) => {
      appLogger.error(
        { errorType: error?.name || 'Error' },
        'Squid Korea AMA initialization failed',
      );
    });
    _amaController = amaController;
  }

  bot.onText(/^\/start(?:@\w+)?(?:\s+(\S+))?$/, async (msg, match) => {
    try {
      if (amaController) {
        await amaController.handleStart(msg, match?.[1]);
        return;
      }
      await bot.sendMessage(
        msg.chat.id,
        '안녕하세요! EasyGo입니다 🍊\n앱을 통해 가입하시면 환영 🍊 Orange 100개를 드려요.',
      );
    } catch (error) {
      appLogger.error(
        { errorType: error?.name || 'Error' },
        'telegram start command failed',
      );
      await bot.sendMessage(msg.chat.id, '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  });

  bot.onText(/^\/balance$/, async (msg) => {
    const telegramId = String(msg?.from?.id || '').trim();
    if (!telegramId) {
      await bot.sendMessage(msg.chat.id, '테레그램 사용자 정보가 없어 잔액을 조회할 수 없어요.');
      return;
    }
    const result = await getTelegramBalanceById(db, telegramId);
    if (!result) {
      await bot.sendMessage(msg.chat.id, 'EasyGo 연동 계정이 아직 없어서 잔액을 조회할 수 없어요. 앱에서 먼저 연동해주세요.');
      return;
    }
    await bot.sendMessage(msg.chat.id, `현재 보유 🍊 잔액: ${formatBalance(result.balance)}.`);
  });

  bot.onText(/^\/invite$/, async (msg) => {
    const telegramId = String(msg?.from?.id || '').trim();
    if (!telegramId) {
      await bot.sendMessage(msg.chat.id, '테레그램 사용자 정보가 없어 초대 링크를 만들 수 없어요.');
      return;
    }

    const result = await getTelegramBalanceById(db, telegramId);
    if (!result) {
      await bot.sendMessage(
        msg.chat.id,
        'EasyGo 연동 계정이 아직 없어서 초대 링크를 만들 수 없어요. 앱에서 먼저 연동해주세요.',
      );
      return;
    }

    const inviteUrl = buildTelegramInviteLink(env);
    if (!inviteUrl) {
      await bot.sendMessage(
        msg.chat.id,
        '초대 링크 설정이 아직 준비되지 않았어요. 나중에 다시 시도해 주세요.',
      );
      return;
    }

    await bot.sendMessage(msg.chat.id, `초대 링크가 준비되었어요.\n${inviteUrl}`);
  });

  bot.onText(/^\/help$/, async (msg) => {
    const amaEnabled = Boolean(amaConfig.enabled);
    await bot.sendMessage(msg.chat.id, buildTelegramHelpText(amaEnabled));
  });

  bot.onText(/^\/wallet$/, async (msg) => {
    const telegramId = String(msg?.from?.id || '').trim();
    if (!telegramId) {
      await bot.sendMessage(msg.chat.id, '테레그램 사용자 정보가 없어 지갑 주소를 조회할 수 없어요.');
      return;
    }

    const result = await getTelegramWalletById(db, telegramId);
    if (!result) {
      await bot.sendMessage(
        msg.chat.id,
        'EasyGo 연동 계정이 아직 없어서 지갑 주소를 조회할 수 없어요. 앱에서 먼저 연동해주세요.',
      );
      return;
    }

    if (!result.walletAddress) {
      await bot.sendMessage(
        msg.chat.id,
        '지갑이 아직 발급되지 않았어요. 앱에서 지갑 생성/연결을 완료한 뒤 다시 시도해 주세요.',
      );
      return;
    }

    const walletLink = buildWalletExplorerUrl(result.walletAddress, env);
    await bot.sendMessage(
      msg.chat.id,
      `연동된 지갑 주소: ${result.walletAddress}\nBase 체인에서 보기: ${walletLink}`,
    );
  });

  bot.on('polling_error', (err) => logger.error({ err }, 'telegram polling error'));
}
