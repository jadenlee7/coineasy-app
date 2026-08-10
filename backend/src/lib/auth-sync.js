export const WELCOME_ORANGE = 100;
export const WELCOME_BONUS_REASON = 'WELCOME_BONUS';

export async function awardWelcomeBonusOnce(prisma, { userId }) {
  // `createMany(..., skipDuplicates: true)` compiles to conflict-free SQL on
  // PostgreSQL. Do not catch a P2002 from `create()` here: inside an
  // interactive transaction PostgreSQL would keep the transaction aborted
  // even after JavaScript catches the Prisma error.
  const result = await prisma.orangeLedger.createMany({
    data: [{
        userId,
        delta: WELCOME_ORANGE,
        reason: WELCOME_BONUS_REASON,
        refId: userId,
      }],
    skipDuplicates: true,
  });
  return result.count === 1;
}

export async function getOrangeBalance(prisma, userId) {
  const aggregate = await prisma.orangeLedger.aggregate({
    where: { userId },
    _sum: { delta: true },
  });
  return aggregate._sum.delta || 0;
}
