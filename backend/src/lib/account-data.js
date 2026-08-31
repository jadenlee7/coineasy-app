const publicSocialUserSelect = {
  id: true,
  username: true,
  displayName: true,
  pfp: true,
};

const userDataSelect = {
  id: true,
  privyDid: true,
  telegramId: true,
  telegramUsername: true,
  kakaoId: true,
  walletAddress: true,
  verifiedAddress: true,
  siweChainId: true,
  siweVerifiedAt: true,
  subname: true,
  subnameStatus: true,
  subnameAddress: true,
  subnameChainId: true,
  subnameRequestedAt: true,
  subnameIssuedAt: true,
  username: true,
  displayName: true,
  pfp: true,
  bio: true,
  createdAt: true,
  updatedAt: true,
  // Describe the server-verified identity namespaces attached to this user,
  // but never export the keyed digest or its key fingerprint. Those values
  // are deletion-guard material rather than portable account identifiers.
  stableProviderIdentities: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      provider: true,
      context: true,
      keyVersion: true,
      createdAt: true,
    },
  },
  // Delivery tokens are credential-like addresses. The full export describes
  // each registration without exposing the raw value that could be abused to
  // target the device outside EasyGo.
  expoPushTokens: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      platform: true,
      createdAt: true,
      updatedAt: true,
      lastSeenAt: true,
    },
  },
  consent: true,
  consentAudits: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  ledger: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  swaps: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  posts: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  postReports: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      postId: true,
      reason: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      reviewedAt: true,
    },
  },
  likes: { orderBy: [{ createdAt: 'asc' }, { postId: 'asc' }] },
  following: { orderBy: [{ createdAt: 'asc' }, { followeeId: 'asc' }] },
  followers: { orderBy: [{ createdAt: 'asc' }, { followerId: 'asc' }] },
  // Export only blocks chosen by this account. Inbound blocks belong to the
  // other account's safety state and must not be disclosed here.
  blocksMade: {
    orderBy: [{ createdAt: 'asc' }, { blockedId: 'asc' }],
    select: {
      createdAt: true,
      blocked: { select: publicSocialUserSelect },
    },
  },
  questCompletions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  segments: {
    orderBy: [{ matchedAt: 'asc' }, { segmentId: 'asc' }],
    include: {
      segment: {
        select: { id: true, slug: true, name: true, ruleVersion: true },
      },
    },
  },
};

const legacySocialDataSelect = {
  id: true,
  username: true,
  displayName: true,
  pfp: true,
  bio: true,
  createdAt: true,
  updatedAt: true,
  posts: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      body: true,
      mediaUrl: true,
      parentPostId: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  likes: {
    orderBy: [{ createdAt: 'asc' }, { postId: 'asc' }],
    select: { postId: true, createdAt: true },
  },
  following: {
    orderBy: [{ createdAt: 'asc' }, { followeeId: 'asc' }],
    select: {
      createdAt: true,
      followee: { select: publicSocialUserSelect },
    },
  },
  followers: {
    orderBy: [{ createdAt: 'asc' }, { followerId: 'asc' }],
    select: {
      createdAt: true,
      follower: { select: publicSocialUserSelect },
    },
  },
  blocksMade: {
    orderBy: [{ createdAt: 'asc' }, { blockedId: 'asc' }],
    select: {
      createdAt: true,
      blocked: { select: publicSocialUserSelect },
    },
  },
};

export async function exportLocalUserData(prisma, privyDid, now = new Date()) {
  const data = await prisma.user.findUnique({
    where: { privyDid },
    select: userDataSelect,
  });
  if (!data) return null;

  return {
    schemaVersion: 1,
    scope: 'easygo_local_database',
    exportedAt: now.toISOString(),
    data,
  };
}

export async function exportLegacySocialData(prisma, privyDid, now = new Date()) {
  const user = await prisma.user.findUnique({
    where: { privyDid },
    select: legacySocialDataSelect,
  });
  if (!user) return null;

  const {
    posts,
    likes,
    following,
    followers,
    blocksMade,
    ...profile
  } = user;
  return {
    schemaVersion: 1,
    scope: 'easygo_legacy_social',
    exportedAt: now.toISOString(),
    data: {
      profile,
      posts,
      likes,
      following: following.map((row) => ({ since: row.createdAt, user: row.followee })),
      followers: followers.map((row) => ({ since: row.createdAt, user: row.follower })),
      blockedAccounts: blocksMade.map((row) => ({
        since: row.createdAt,
        user: row.blocked,
      })),
    },
  };
}
