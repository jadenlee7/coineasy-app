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
  consent: true,
  consentAudits: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  ledger: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  swaps: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  posts: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  likes: { orderBy: [{ createdAt: 'asc' }, { postId: 'asc' }] },
  following: { orderBy: [{ createdAt: 'asc' }, { followeeId: 'asc' }] },
  followers: { orderBy: [{ createdAt: 'asc' }, { followerId: 'asc' }] },
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

const publicSocialUserSelect = {
  id: true,
  username: true,
  displayName: true,
  pfp: true,
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
    },
  };
}

export async function deleteLocalUserData(prisma, privyDid) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { privyDid },
      select: { id: true },
    });
    if (!user) return null;

    const ownedPosts = await tx.post.findMany({
      where: { authorId: user.id },
      select: { id: true },
    });
    const ownedPostIds = ownedPosts.map((post) => post.id);

    // Preserve the legacy account-deletion behavior: dependent thread replies
    // are removed before the author's posts cascade with the User row.
    const replies = ownedPostIds.length
      ? await tx.post.deleteMany({ where: { parentPostId: { in: ownedPostIds } } })
      : { count: 0 };
    await tx.user.delete({ where: { id: user.id } });

    return { deletedUserId: user.id, deletedDependentReplies: replies.count };
  });
}
