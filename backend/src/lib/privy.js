/**
 * Privy server-side wrapper.
 *
 * Purpose:
 *   - Verify Privy access tokens issued to the RN client.
 *   - Resolve a stable user identity (Privy DID) + linked accounts
 *     (telegram, kakao, embedded wallet address on Base).
 *
 * Phase 1 (Path C) note:
 *   - Embedded wallet chainId = 8453 (Base).
 *   - Telegram + Kakao OAuth are configured at dashboard.privy.io;
 *     this module does not provision them, only consumes the result.
 */

import { PrivyClient } from '@privy-io/server-auth';

const APP_ID = process.env.PRIVY_APP_ID;
const APP_SECRET = process.env.PRIVY_APP_SECRET;

let _client = null;

export function getPrivyClient() {
  if (_client) return _client;
  if (!APP_ID || !APP_SECRET) {
    throw new Error('PRIVY_APP_ID / PRIVY_APP_SECRET not set');
  }
  _client = new PrivyClient(APP_ID, APP_SECRET);
  return _client;
}

/**
 * Verify a Privy access token (sent from the RN client as Bearer).
 * Returns { userId, claims } on success, throws on failure.
 */
export async function verifyAccessToken(token) {
  const client = getPrivyClient();
  const claims = await client.verifyAuthToken(token);
  return { userId: claims.userId, claims };
}

/**
 * Fetch a Privy user with their linked accounts.
 * Used to extract telegram/kakao IDs and the Base wallet address.
 */
export async function getUser(userId) {
  const client = getPrivyClient();
  return client.getUser(userId);
}

/**
 * Helper: pick a stable identity profile we want to persist in our DB.
 */
export function extractProfile(privyUser) {
  const linked = privyUser?.linkedAccounts || [];
  const telegram = linked.find((a) => a.type === 'telegram');
  const kakao = linked.find((a) => a.type === 'kakao' || a.type === 'oauth' && a.provider === 'kakao');
  const wallet = linked.find((a) => a.type === 'wallet' && a.chainType === 'ethereum');
  return {
    privyDid: privyUser?.id,
    telegramId: telegram?.telegramUserId || telegram?.subject || null,
    telegramUsername: telegram?.username || null,
    kakaoId: kakao?.subject || null,
    walletAddress: wallet?.address || null,
  };
}
