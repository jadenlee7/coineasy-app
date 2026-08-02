export const WELCOME_ORANGE = 100;
export const WELCOME_BONUS_REASON = 'WELCOME_BONUS';

export async function awardWelcomeBonusOnce(prisma, { userId }) {
  try {
    await prisma.orangeLedger.create({
      data: {
        userId,
        delta: WELCOME_ORANGE,
        reason: WELCOME_BONUS_REASON,
        refId: userId,
      },
    });
    return true;
  } catch (error) {
    // Concurrent first-sync requests share the same (reason, refId) key. The
    // winner creates the reward; the unique-conflict loser is an idempotent
    // success and must not fail authentication.
    if (error?.code === 'P2002') return false;
    throw error;
  }
}

export async function getOrangeBalance(prisma, userId) {
  const aggregate = await prisma.orangeLedger.aggregate({
    where: { userId },
    _sum: { delta: true },
  });
  return aggregate._sum.delta || 0;
}
