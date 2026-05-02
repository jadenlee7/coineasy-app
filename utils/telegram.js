// utils/telegram.js
// Telegram Bot integration — primary growth + auth channel for Korean users.
// See EASYGO_BUILD_PLAN.md §8 (notifications) and §6 (Korean-first targeting).

// ---------------------------------------------------------------------------
// Bot config — bot manages: login link, push notifications, referral, support
// ---------------------------------------------------------------------------
export const TELEGRAM_CONFIG = {
  botUsername: process.env.EXPO_PUBLIC_TG_BOT_USERNAME || '',  // TODO: e.g. easygo_bot
  botToken: '', // SERVER-SIDE ONLY — never read in client
  webAppUrl: process.env.EXPO_PUBLIC_TG_WEBAPP_URL || '',      // TODO: deep-link target
};

// ---------------------------------------------------------------------------
// Login — Telegram Login Widget → Privy social login bridge
// ---------------------------------------------------------------------------
export function getTelegramLoginUrl({ redirectUrl }) {
  if (!TELEGRAM_CONFIG.botUsername) return null;
  // TODO(phase1): switch to Telegram Login Widget callback flow once Privy social provider config arrives
  return `https://oauth.telegram.org/auth?bot_id=${TELEGRAM_CONFIG.botUsername}&origin=${encodeURIComponent(redirectUrl)}`;
}

// ---------------------------------------------------------------------------
// Notifications — server-side fanout (per §8 inbox tabs: Replies/Activity/Reward/System)
// Client only triggers; actual sendMessage runs on backend with bot token
// ---------------------------------------------------------------------------
export async function notifyTelegram({ tgUserId, category, message }) {
  // TODO(phase1): POST /api/notify/telegram { tgUserId, category, message }
  console.warn('[telegram] notify not yet wired', { tgUserId, category, message });
  return null;
}

// Inbox categories must match EasyGo notification spec (Figma: All / Replies / Activity / Rewards / Notices)
export const TG_CATEGORIES = ['replies', 'activity', 'reward', 'system'];
