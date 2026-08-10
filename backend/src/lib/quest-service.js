import { createHash, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  hashQuizAnswer,
  parseQuestRequirements,
  publicQuestRequirements,
  quizSubmissionSchema,
  startQuestSchema,
  transactionSubmissionSchema,
} from './quest-requirements.js';
import { createQuestVerifier, QuestError } from './quest-verifier.js';

const ACTIVE_QUEST_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  type: true,
  rewardOrange: true,
  requirements: true,
  requiresWalletSharing: true,
  startsAt: true,
  endsAt: true,
};

function availabilityWhere(now) {
  return {
    status: 'ACTIVE',
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    ],
  };
}

function completionView(completion) {
  if (!completion) return null;
  return {
    status: completion.status,
    walletSharingOptIn: completion.walletSharingOptIn,
    startedAt: completion.createdAt,
    submittedAt: completion.submittedAt,
    verifiedAt: completion.verifiedAt,
  };
}

function validateQuestConfiguration(quest) {
  if (
    !Number.isSafeInteger(quest.rewardOrange)
    || quest.rewardOrange < 0
    || quest.rewardOrange > 1_000_000
  ) {
    throw new Error('quest reward is outside the supported range');
  }
  return parseQuestRequirements(quest);
}

function questView(quest, completion = null) {
  validateQuestConfiguration(quest);
  return {
    id: quest.id,
    slug: quest.slug,
    title: quest.title,
    description: quest.description,
    type: quest.type,
    rewardOrange: quest.rewardOrange,
    requirements: publicQuestRequirements(quest),
    requiresWalletSharing: quest.requiresWalletSharing,
    startsAt: quest.startsAt,
    endsAt: quest.endsAt,
    completion: completionView(completion),
  };
}

function digestsEqual(left, right) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function proofLockId(proofReference) {
  return createHash('sha256').update(proofReference).digest().readBigInt64BE(0);
}

async function orangeBalance(db, userId) {
  const aggregate = await db.orangeLedger.aggregate({
    where: { userId },
    _sum: { delta: true },
  });
  return aggregate._sum.delta || 0;
}

function inputError(error) {
  if (error instanceof z.ZodError) {
    return new QuestError('bad_input', { status: 400, cause: error });
  }
  return error;
}

export function createQuestService({
  prisma,
  verifier = createQuestVerifier(),
  now = () => new Date(),
} = {}) {
  if (!prisma) throw new Error('prisma is required');

  async function currentUser(privyDid) {
    const user = await prisma.user.findUnique({
      where: { privyDid },
      select: {
        id: true,
        verifiedAddress: true,
        siweChainId: true,
        siweVerifiedAt: true,
      },
    });
    if (!user) throw new QuestError('not_found', { status: 404 });
    return user;
  }

  async function activeQuest(questId, at) {
    const quest = await prisma.quest.findFirst({
      where: {
        ...availabilityWhere(at),
        OR: [{ id: questId }, { slug: questId }],
      },
      select: ACTIVE_QUEST_SELECT,
    });
    if (!quest) throw new QuestError('quest_not_found', { status: 404 });
    try {
      validateQuestConfiguration(quest);
    } catch (error) {
      throw new QuestError('quest_configuration_invalid', { status: 500, cause: error });
    }
    return quest;
  }

  async function requireBaseWallet(user) {
    if (
      !user.verifiedAddress
      || user.siweChainId !== 8453
      || !user.siweVerifiedAt
    ) {
      throw new QuestError('base_wallet_verification_required', { status: 409 });
    }
  }

  async function list(privyDid) {
    const at = now();
    const user = await currentUser(privyDid);
    const quests = await prisma.quest.findMany({
      where: availabilityWhere(at),
      select: {
        ...ACTIVE_QUEST_SELECT,
        completions: {
          where: { userId: user.id },
          take: 1,
        },
      },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
    });
    try {
      return quests.map((quest) => questView(quest, quest.completions[0]));
    } catch (error) {
      throw new QuestError('quest_configuration_invalid', { status: 500, cause: error });
    }
  }

  async function start(privyDid, questId, input) {
    const at = now();
    const user = await currentUser(privyDid);
    const quest = await activeQuest(questId, at);
    let parsed;
    try {
      parsed = startQuestSchema.parse(input ?? {});
    } catch (error) {
      throw inputError(error);
    }
    if (quest.type === 'TRANSACTION') await requireBaseWallet(user);
    if (quest.requiresWalletSharing && !parsed.walletSharingOptIn) {
      throw new QuestError('wallet_sharing_consent_required', { status: 409 });
    }

    const existing = await prisma.questCompletion.findUnique({
      where: { questId_userId: { questId: quest.id, userId: user.id } },
    });
    let completion;
    if (existing && ['STARTED', 'SUBMITTED', 'VERIFIED'].includes(existing.status)) {
      completion = existing;
    } else if (existing) {
      completion = await prisma.questCompletion.update({
        where: { id: existing.id },
        data: {
          status: 'STARTED',
          verifyProof: Prisma.DbNull,
          walletSharingOptIn: quest.requiresWalletSharing,
          walletSharingConsentedAt: quest.requiresWalletSharing ? at : null,
          submittedAt: null,
          verifiedAt: null,
        },
      });
    } else {
      completion = await prisma.questCompletion.create({
        data: {
          questId: quest.id,
          userId: user.id,
          status: 'STARTED',
          walletSharingOptIn: quest.requiresWalletSharing,
          walletSharingConsentedAt: quest.requiresWalletSharing ? at : null,
        },
      });
    }
    return questView(quest, completion);
  }

  async function finishVerified({ quest, user, completion, proof }) {
    const rewardRef = `${quest.id}:${user.id}`;
    const proofReference = proof.kind === 'base_transaction' ? proof.txHash : null;

    return prisma.$transaction(async (tx) => {
      if (proofReference) {
        await tx.$queryRawUnsafe(
          'SELECT pg_advisory_xact_lock($1::bigint)',
          proofLockId(proofReference),
        );
        const reused = await tx.questCompletion.findFirst({
          where: {
            id: { not: completion.id },
            status: 'VERIFIED',
            verifyProof: { path: ['txHash'], equals: proofReference },
          },
          select: { id: true },
        });
        if (reused) throw new QuestError('transaction_proof_reused', { status: 409 });
      }

      const changed = await tx.questCompletion.updateMany({
        where: { id: completion.id, status: { not: 'VERIFIED' } },
        data: {
          status: 'VERIFIED',
          verifyProof: proof,
          submittedAt: now(),
          verifiedAt: now(),
        },
      });
      await tx.orangeLedger.upsert({
        where: { reason_refId: { reason: 'QUEST_REWARD', refId: rewardRef } },
        create: {
          userId: user.id,
          delta: quest.rewardOrange,
          reason: 'QUEST_REWARD',
          refId: rewardRef,
        },
        update: {},
      });
      const balance = await orangeBalance(tx, user.id);
      const latest = await tx.questCompletion.findUnique({ where: { id: completion.id } });
      return {
        quest: questView(quest, latest),
        reward: {
          awarded: changed.count === 1,
          amount: quest.rewardOrange,
          balance,
        },
      };
    }, { timeout: 30_000 });
  }

  async function complete(privyDid, questId, input) {
    const at = now();
    const user = await currentUser(privyDid);
    const quest = await activeQuest(questId, at);
    let completion = await prisma.questCompletion.findUnique({
      where: { questId_userId: { questId: quest.id, userId: user.id } },
    });

    if (completion?.status === 'VERIFIED') {
      return {
        quest: questView(quest, completion),
        reward: {
          awarded: false,
          amount: quest.rewardOrange,
          balance: await orangeBalance(prisma, user.id),
        },
      };
    }
    if (quest.requiresWalletSharing && !completion?.walletSharingOptIn) {
      throw new QuestError('wallet_sharing_consent_required', { status: 409 });
    }

    let proof;
    if (quest.type === 'QUIZ') {
      let submission;
      try {
        submission = quizSubmissionSchema.parse(input);
      } catch (error) {
        throw inputError(error);
      }
      if (!completion) {
        completion = await prisma.questCompletion.create({
          data: { questId: quest.id, userId: user.id, status: 'STARTED' },
        });
      }
      const requirements = parseQuestRequirements(quest);
      const submittedDigest = hashQuizAnswer(quest.slug, submission.answer);
      if (!digestsEqual(requirements.correctAnswerSha256, submittedDigest)) {
        await prisma.questCompletion.update({
          where: { id: completion.id },
          data: { status: 'REJECTED', verifyProof: Prisma.DbNull, submittedAt: at },
        });
        throw new QuestError('incorrect_quiz_answer', { status: 422 });
      }
      proof = { schemaVersion: 1, kind: 'quiz', verified: true };
    } else {
      await requireBaseWallet(user);
      if (!completion || completion.status !== 'STARTED') {
        throw new QuestError('quest_start_required', { status: 409 });
      }
      let submission;
      try {
        submission = transactionSubmissionSchema.parse(input);
      } catch (error) {
        throw inputError(error);
      }
      try {
        proof = await verifier.verifyBaseTransaction({
          requirements: parseQuestRequirements(quest),
          txHash: submission.txHash,
          verifiedAddress: user.verifiedAddress,
          startedAt: completion.updatedAt,
          now: at,
        });
      } catch (error) {
        if (error instanceof QuestError && !error.retryable) {
          await prisma.questCompletion.updateMany({
            where: { id: completion.id, status: { not: 'VERIFIED' } },
            data: { status: 'REJECTED', verifyProof: Prisma.DbNull, submittedAt: at },
          });
        }
        throw error;
      }
    }

    try {
      return await finishVerified({ quest, user, completion, proof });
    } catch (error) {
      if (error instanceof QuestError && !error.retryable) {
        await prisma.questCompletion.updateMany({
          where: { id: completion.id, status: { not: 'VERIFIED' } },
          data: { status: 'REJECTED', verifyProof: Prisma.DbNull, submittedAt: at },
        });
      }
      throw error;
    }
  }

  return { list, start, complete };
}
