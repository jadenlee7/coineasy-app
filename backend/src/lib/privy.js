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

export class PrivyConfigurationError extends Error {
  constructor() {
    super('Privy server credentials are not configured');
    this.name = 'PrivyConfigurationError';
  }
}

export class PrivyIdentityError extends Error {
  constructor(code = 'privy_identity_invalid') {
    super(code);
    this.name = 'PrivyIdentityError';
    this.code = code;
  }
}

export function getPrivyClient() {
  if (_client) return _client;
  if (!APP_ID || !APP_SECRET) {
    throw new PrivyConfigurationError();
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
 * Extract the stable Apple provider subject from Privy's server-fetched user.
 *
 * The value is intentionally returned separately from the persisted EasyGo
 * profile. Callers must immediately derive a keyed deletion digest from it;
 * neither the subject nor Apple's relay email belongs in the local user row.
 */
export function extractAppleSubject(privyUser) {
  const linked = Array.isArray(privyUser?.linkedAccounts)
    ? privyUser.linkedAccounts
    : [];
  const appleAccounts = linked.filter((account) => account?.type === 'apple_oauth');
  if (appleAccounts.length === 0) return null;

  const subjects = appleAccounts.map((account) => {
    const subject = account?.subject;
    if (
      typeof subject !== 'string'
      || subject.length === 0
      || subject.length > 1024
      || subject !== subject.trim()
    ) {
      throw new PrivyIdentityError('privy_apple_subject_invalid');
    }
    return subject;
  });

  const distinct = new Set(subjects);
  if (distinct.size !== 1) {
    throw new PrivyIdentityError('privy_apple_subject_conflict');
  }
  return subjects[0];
}

export function isPrivyConfigurationFailure(error) {
  const upstreamStatus = Number(
    error?.status ?? error?.statusCode ?? error?.response?.status,
  );
  return error instanceof PrivyConfigurationError
    || upstreamStatus === 401
    || upstreamStatus === 403;
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
