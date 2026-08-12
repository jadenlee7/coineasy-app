const DEFAULT_CAMPAIGN_ID = 'squid_ama_2026_08_05';
const DEFAULT_ROOM_URL = 'https://t.me/squid_kor';

function clean(value) {
  const result = String(value ?? '').trim();
  return result || undefined;
}

function integer(value, fallback, { minimum = 0, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) return fallback;
  return parsed;
}

function isoDate(value) {
  const raw = clean(value);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function telegramIds(value) {
  return [...new Set(
    String(value || '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => /^-?\d+$/.test(id)),
  )];
}

export function amaCampaignEnabled(env = process.env) {
  return String(env.AMA_CAMPAIGN_ENABLED || '').trim().toLowerCase() === 'true';
}

export function buildAmaConfig(env = process.env) {
  const enabled = amaCampaignEnabled(env);
  const startAt = isoDate(env.AMA_START_AT);
  const endAt = isoDate(env.AMA_END_AT);
  const restoreAt = isoDate(env.AMA_FAILSAFE_RESTORE_AT)
    || (endAt ? new Date(endAt.getTime() + 5 * 60 * 1000) : undefined);

  const config = {
    enabled,
    campaignId: clean(env.AMA_CAMPAIGN_ID) || DEFAULT_CAMPAIGN_ID,
    chatId: clean(env.AMA_CHAT_ID),
    chatUsername: clean(env.AMA_CHAT_USERNAME) || 'squid_kor',
    roomUrl: clean(env.AMA_ROOM_URL) || DEFAULT_ROOM_URL,
    speakerTelegramId: clean(env.AMA_SPEAKER_TELEGRAM_ID),
    operatorTelegramIds: telegramIds(env.AMA_OPERATOR_TELEGRAM_IDS),
    dmExcludedTelegramIds: telegramIds(env.AMA_DM_EXCLUDED_TELEGRAM_IDS),
    dmDelayMs: integer(env.AMA_DM_DELAY_MS, 50, { minimum: 34, maximum: 10_000 }),
    botUsername: clean(env.AMA_BOT_USERNAME),
    startAt,
    endAt,
    restoreAt,
    questionLimit: integer(env.AMA_QUESTION_LIMIT, 3, { minimum: 1, maximum: 10 }),
    preparedQuestionCount: integer(
      env.AMA_PREPARED_QUESTION_COUNT,
      5,
      { minimum: 1, maximum: 20 },
    ),
    lightningQuestionCount: integer(
      env.AMA_LIGHTNING_QUESTION_COUNT,
      5,
      { minimum: 0, maximum: 10 },
    ),
    questionXp: integer(env.AMA_XP_QUESTION, 20, { minimum: 0, maximum: 10_000 }),
    liveCheckinXp: integer(env.AMA_XP_LIVE_CHECKIN, 15, { minimum: 0, maximum: 10_000 }),
    qualifiedReferralXp: integer(
      env.AMA_XP_QUALIFIED_REFERRAL,
      30,
      { minimum: 0, maximum: 10_000 },
    ),
    qualifiedReferralLimit: integer(
      env.AMA_QUALIFIED_REFERRAL_LIMIT,
      10,
      { minimum: 0, maximum: 100 },
    ),
    translationApiKey: clean(env.OPENAI_API_KEY),
    translationModel: clean(env.AMA_TRANSLATION_MODEL),
  };

  const errors = [];
  if (enabled) {
    if (!config.chatId || !/^-?\d+$/.test(config.chatId)) {
      errors.push('AMA_CHAT_ID must be a numeric Telegram chat ID.');
    }
    if (!config.speakerTelegramId || !/^\d+$/.test(config.speakerTelegramId)) {
      errors.push('AMA_SPEAKER_TELEGRAM_ID must be Fig’s numeric Telegram user ID.');
    }
    if (config.operatorTelegramIds.length === 0) {
      errors.push('AMA_OPERATOR_TELEGRAM_IDS must include at least one numeric operator ID.');
    }
    if (!startAt || !endAt || startAt >= endAt) {
      errors.push('AMA_START_AT and AMA_END_AT must be valid ISO timestamps in chronological order.');
    }
    if (!config.translationApiKey) {
      errors.push('OPENAI_API_KEY is required for live Korean translation.');
    }
    if (!config.translationModel) {
      errors.push('AMA_TRANSLATION_MODEL is required for live Korean translation.');
    }
  }

  return {
    ...config,
    valid: errors.length === 0,
    errors,
  };
}

export function isAmaOperator(config, telegramId) {
  return config.operatorTelegramIds.includes(String(telegramId ?? ''));
}

export function isWithinAmaWindow(config, now = new Date()) {
  if (!config.startAt || !config.endAt) return false;
  return now >= config.startAt && now <= config.endAt;
}
