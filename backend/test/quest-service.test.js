import assert from 'node:assert/strict';
import test from 'node:test';
import { createQuestService } from '../src/lib/quest-service.js';
import { hashQuizAnswer } from '../src/lib/quest-requirements.js';
import { QuestError } from '../src/lib/quest-verifier.js';

const NOW = new Date('2026-07-21T12:00:00.000Z');
const USER = {
  id: 'user_1',
  privyDid: 'did:privy:user-1',
  verifiedAddress: '0x1111111111111111111111111111111111111111',
  siweChainId: 8453,
  siweVerifiedAt: NOW,
};

function quizQuest(overrides = {}) {
  const slug = overrides.slug || 'course-1-1';
  return {
    id: 'quest_1',
    slug,
    title: 'Course quiz',
    description: 'Choose the correct answer.',
    type: 'QUIZ',
    status: 'ACTIVE',
    rewardOrange: 60,
    requiresWalletSharing: false,
    startsAt: null,
    endsAt: null,
    requirements: {
      schemaVersion: 1,
      kind: 'quiz',
      question: 'What is Base?',
      options: [{ id: '0', label: 'L1' }, { id: '1', label: 'Ethereum L2' }],
      correctAnswerSha256: hashQuizAnswer(slug, '1'),
    },
    ...overrides,
  };
}

function transactionQuest(overrides = {}) {
  return {
    id: 'quest_tx',
    slug: 'base-transaction',
    title: 'Base action',
    description: 'Complete a Base action.',
    type: 'TRANSACTION',
    status: 'ACTIVE',
    rewardOrange: 25,
    requiresWalletSharing: false,
    startsAt: null,
    endsAt: null,
    requirements: {
      schemaVersion: 1,
      kind: 'base_transaction',
      chainId: 8453,
      minimumConfirmations: 3,
      toAddress: '0x2222222222222222222222222222222222222222',
    },
    ...overrides,
  };
}

function mockPrisma({ quest = quizQuest(), user = USER } = {}) {
  const state = { completion: null, ledger: [] };
  const db = {
    user: {
      findUnique: async () => user,
    },
    quest: {
      findFirst: async () => quest,
      findMany: async () => [{ ...quest, completions: state.completion ? [state.completion] : [] }],
    },
    questCompletion: {
      findUnique: async ({ where }) => {
        if (where.id && state.completion?.id !== where.id) return null;
        return state.completion;
      },
      findFirst: async () => null,
      create: async ({ data }) => {
        state.completion = {
          id: 'completion_1',
          verifyProof: null,
          walletSharingOptIn: false,
          walletSharingConsentedAt: null,
          submittedAt: null,
          verifiedAt: null,
          createdAt: NOW,
          updatedAt: NOW,
          ...data,
        };
        return state.completion;
      },
      update: async ({ data }) => {
        state.completion = { ...state.completion, ...data, updatedAt: NOW };
        return state.completion;
      },
      updateMany: async ({ where, data }) => {
        if (!state.completion || state.completion.id !== where.id) return { count: 0 };
        if (where.status?.not && state.completion.status === where.status.not) return { count: 0 };
        state.completion = { ...state.completion, ...data, updatedAt: NOW };
        return { count: 1 };
      },
    },
    orangeLedger: {
      upsert: async ({ where, create }) => {
        const found = state.ledger.find((row) => (
          row.reason === where.reason_refId.reason && row.refId === where.reason_refId.refId
        ));
        if (found) return found;
        state.ledger.push(create);
        return create;
      },
      aggregate: async () => ({
        _sum: { delta: state.ledger.reduce((sum, row) => sum + row.delta, 0) || null },
      }),
    },
    $queryRawUnsafe: async () => [{ locked: true }],
  };
  db.$transaction = async (callback) => callback(db);
  return { db, state };
}

test('verified quiz completion and Orange reward are atomic and idempotent', async () => {
  const { db, state } = mockPrisma();
  const service = createQuestService({ prisma: db, now: () => NOW });

  const first = await service.complete(USER.privyDid, 'course-1-1', { answer: '1' });
  assert.equal(first.reward.awarded, true);
  assert.equal(first.reward.amount, 60);
  assert.equal(first.reward.balance, 60);
  assert.equal(state.completion.status, 'VERIFIED');
  assert.deepEqual(state.completion.verifyProof, {
    schemaVersion: 1,
    kind: 'quiz',
    verified: true,
  });
  assert.equal('answer' in state.completion.verifyProof, false);
  assert.equal(state.ledger.length, 1);
  assert.equal(state.ledger[0].reason, 'QUEST_REWARD');

  const retry = await service.complete(USER.privyDid, 'course-1-1', { answer: '1' });
  assert.equal(retry.reward.awarded, false);
  assert.equal(retry.reward.balance, 60);
  assert.equal(state.ledger.length, 1);
});

test('an incorrect quiz answer is rejected without creating a reward', async () => {
  const { db, state } = mockPrisma();
  const service = createQuestService({ prisma: db, now: () => NOW });

  await assert.rejects(
    () => service.complete(USER.privyDid, 'course-1-1', { answer: '0' }),
    (error) => error.code === 'incorrect_quiz_answer' && error.status === 422,
  );
  assert.equal(state.completion.status, 'REJECTED');
  assert.equal(state.ledger.length, 0);
});

test('an invalid negative quest reward fails closed before completion', async () => {
  const { db, state } = mockPrisma({ quest: quizQuest({ rewardOrange: -60 }) });
  const service = createQuestService({ prisma: db, now: () => NOW });

  await assert.rejects(
    () => service.complete(USER.privyDid, 'course-1-1', { answer: '1' }),
    (error) => error.code === 'quest_configuration_invalid' && error.status === 500,
  );
  assert.equal(state.completion, null);
  assert.equal(state.ledger.length, 0);
});

test('wallet-sharing consent is recorded only for quests that require it', async () => {
  const quest = quizQuest({ requiresWalletSharing: true });
  const { db, state } = mockPrisma({ quest });
  const service = createQuestService({ prisma: db, now: () => NOW });

  await assert.rejects(
    () => service.start(USER.privyDid, quest.id, { walletSharingOptIn: false }),
    (error) => error.code === 'wallet_sharing_consent_required',
  );
  await service.start(USER.privyDid, quest.id, { walletSharingOptIn: true });
  assert.equal(state.completion.walletSharingOptIn, true);
  assert.equal(state.completion.walletSharingConsentedAt, NOW);
});

test('retryable Base verification errors preserve a started completion', async () => {
  const quest = transactionQuest();
  const { db, state } = mockPrisma({ quest });
  const verifier = {
    verifyBaseTransaction: async () => {
      throw new QuestError('transaction_underconfirmed', { status: 409, retryable: true });
    },
  };
  const service = createQuestService({ prisma: db, verifier, now: () => NOW });
  await service.start(USER.privyDid, quest.id, {});

  await assert.rejects(
    () => service.complete(USER.privyDid, quest.id, { txHash: `0x${'a'.repeat(64)}` }),
    (error) => error.code === 'transaction_underconfirmed' && error.retryable === true,
  );
  assert.equal(state.completion.status, 'STARTED');
  assert.equal(state.ledger.length, 0);
});
