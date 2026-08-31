export const BLOCKED_USER_PUBLIC_SELECT = Object.freeze({
  id: true,
  username: true,
  displayName: true,
  pfp: true,
});

// A complete client synchronization is therefore at most five 100-row pages.
// The bound is enforced under an actor-scoped transaction lock so concurrent
// block requests cannot overrun it.
export const USER_BLOCKS_PER_ACCOUNT_MAX = 500;

export function userPairLockKey(leftUserId, rightUserId) {
  return `user-pair:${[leftUserId, rightUserId].sort().join(':')}`;
}

export async function lockUserPair(tx, leftUserId, rightUserId) {
  await tx.$queryRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0)) IS NULL AS "lockAcquired"',
    userPairLockKey(leftUserId, rightUserId),
  );
}

export async function lockBlockActor(tx, blockerId) {
  await tx.$queryRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0)) IS NULL AS "lockAcquired"',
    `user-block-actor:${blockerId}`,
  );
}

export async function isUserPairBlocked(db, leftUserId, rightUserId) {
  if (!leftUserId || !rightUserId || leftUserId === rightUserId) return false;
  const row = await db.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: leftUserId, blockedId: rightUserId },
        { blockerId: rightUserId, blockedId: leftUserId },
      ],
    },
    select: { blockerId: true },
  });
  return Boolean(row);
}

/** Prisma relation predicate equivalent to a bidirectional NOT EXISTS pair. */
export function userVisibleToViewerWhere(viewerUserId) {
  if (!viewerUserId) return {};
  return {
    blocksMade: { none: { blockedId: viewerUserId } },
    blocksTaken: { none: { blockerId: viewerUserId } },
  };
}

export async function createUserBlock(db, {
  blockerId,
  blockedId,
  maxBlocks = USER_BLOCKS_PER_ACCOUNT_MAX,
}) {
  return db.$transaction(async (tx) => {
    await lockBlockActor(tx, blockerId);
    await lockUserPair(tx, blockerId, blockedId);
    const target = await tx.user.findUnique({
      where: { id: blockedId },
      select: { id: true },
    });
    if (!target) return { error: 'target_not_found', status: 404 };
    const key = { blockerId_blockedId: { blockerId, blockedId } };
    const existing = await tx.userBlock.findUnique({
      where: key,
      select: { blockerId: true },
    });
    if (!existing) {
      const blockCount = await tx.userBlock.count({ where: { blockerId } });
      if (blockCount >= maxBlocks) {
        return { error: 'block_limit_reached', status: 409 };
      }
      await tx.userBlock.create({ data: { blockerId, blockedId } });
    }
    await tx.follow.deleteMany({
      where: {
        OR: [
          { followerId: blockerId, followeeId: blockedId },
          { followerId: blockedId, followeeId: blockerId },
        ],
      },
    });
    return { blocked: true, changed: !existing };
  });
}

export async function deleteUserBlock(db, { blockerId, blockedId }) {
  return db.$transaction(async (tx) => {
    await lockBlockActor(tx, blockerId);
    await lockUserPair(tx, blockerId, blockedId);
    const deleted = await tx.userBlock.deleteMany({
      where: { blockerId, blockedId },
    });
    return { blocked: false, changed: deleted.count > 0 };
  });
}

export async function listUserBlocks(db, { blockerId, cursor, limit }) {
  const rows = await db.userBlock.findMany({
    where: { blockerId },
    orderBy: [{ createdAt: 'desc' }, { blockedId: 'desc' }],
    take: limit + 1,
    ...(cursor ? {
      cursor: { blockerId_blockedId: { blockerId, blockedId: cursor } },
      skip: 1,
    } : {}),
    include: { blocked: { select: BLOCKED_USER_PUBLIC_SELECT } },
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    rows: page.map((row) => ({
      ...row.blocked,
      blockedAt: row.createdAt,
    })),
    nextCursor: hasMore ? page.at(-1).blockedId : null,
  };
}
