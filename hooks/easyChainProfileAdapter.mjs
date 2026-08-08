export function adaptEasyGoProfileResponse(response) {
  const user = response?.user ?? response;
  if (!user || typeof user !== 'object' || Array.isArray(user)) return null;

  return Object.freeze({
    address: user.verifiedAddress ?? user.walletAddress ?? null,
    handle: user.displayName ?? user.username ?? null,
    avatarUri: user.pfp ?? null,
    socials: Object.freeze({
      telegram: user.telegramUsername ?? user.telegramId ?? null,
      kakao: user.kakaoId ?? null,
      twitter: null,
    }),
    joinedAt: user.createdAt ?? null,
  });
}
