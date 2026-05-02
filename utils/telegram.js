// utils/telegram.js
// Telegram Bot integration — primary growth + auth channel for Korean users.
// Phase 1 boundary:
//   - Login: Privy social provider handles Telegram OAuth → backend /auth/sync syncs telegramId.
//   - Notifications: backend handles fanout (TG bot has the token, not the client).
//   - Client never holds botToken.
// See backend/src/lib/telegram.js, backend/src/routes/telegram.js, EASYGO_BUILD_PLAN.md §8.

// ---------------------------------------------------------------------------
// Bot config (client-visible bits only — token stays on server)
// ---------------------------------------------------------------------------
export const TELEGRAM_CONFIG = {
  botUsername: process.env.EXPO_PUBLIC_TG_BOT_USERNAME || '', // e.g. easygo_bot
  webAppUrl: process.env.EXPO_PUBLIC_TG_WEBAPP_URL || '',     // deep-link target
  // botToken is intentionally absent — server-side only (TG_BOT_TOKEN in .env)
};

// ---------------------------------------------------------------------------
// Login URL — deep-link to bot for Telegram auth flow.
// In production, prefer Privy's Telegram social provider (handles OAuth + ID surface).
// This helper remains for direct bot deep-links (e.g. "Open in Telegram" CTA on web).
// ---------------------------------------------------------------------------
export function getTelegramLoginUrl({ redirectUrl } = {}) {
  if (!TELEGRAM_CONFIG.botUsername) return null;
  const base = `https://t.me/${TELEGRAM_CONFIG.botUsername}`;
  if (!redirectUrl) return base;
  // start parameter: bot will receive ?start=<encoded redirect> on /start
  return `${base}?start=${encodeURIComponent(redirectUrl)}`;
}

// ---------------------------------------------------------------------------
// Notifications — Phase 1: backend-driven, this is a no-op stub.
// Backend reacts to domain events (orange earned, swap completed, reply received)
// and calls bot.sendMessage with the appropriate category.
// Kept here so existing screens that import notifyTelegram don't break.
// ---------------------------------------------------------------------------
export async function notifyTelegram(_args) {
  // Intentional no-op in Phase 1 — see backend/src/lib/telegram.js for fanout.
  return null;
}

// Inbox categories must match EasyGo notification spec (Figma: All / Replies / Activity / Rewards / Notices)
export const TG_CATEGORIES = ['replies', 'activity', 'reward', 'system'];
