import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hashQuizAnswer,
  parseQuestRequirements,
  publicQuestRequirements,
  transactionRequirementsSchema,
} from '../src/lib/quest-requirements.js';

const QUIZ = {
  type: 'QUIZ',
  slug: 'course-1-1',
  requirements: {
    schemaVersion: 1,
    kind: 'quiz',
    question: 'What is Base?',
    options: [
      { id: '0', label: 'A database' },
      { id: '1', label: 'An Ethereum L2' },
    ],
    correctAnswerSha256: hashQuizAnswer('course-1-1', '1'),
  },
};

test('quiz requirements are strict and public views omit answer verifier data', () => {
  assert.equal(parseQuestRequirements(QUIZ).kind, 'quiz');
  const publicRequirements = publicQuestRequirements(QUIZ);
  assert.equal(publicRequirements.question, 'What is Base?');
  assert.equal('correctAnswerSha256' in publicRequirements, false);

  assert.throws(() => parseQuestRequirements({
    ...QUIZ,
    requirements: { ...QUIZ.requirements, unexpected: true },
  }));
  assert.throws(() => parseQuestRequirements({
    ...QUIZ,
    requirements: {
      ...QUIZ.requirements,
      options: [{ id: 'same', label: 'A' }, { id: 'same', label: 'B' }],
    },
  }));
});

test('quiz hashes are normalized and scoped to a quest slug', () => {
  assert.equal(hashQuizAnswer('quiz-a', ' １ '), hashQuizAnswer('quiz-a', '1'));
  assert.notEqual(hashQuizAnswer('quiz-a', '1'), hashQuizAnswer('quiz-b', '1'));
});

test('transaction requirements stay on Base and require an explicit predicate', () => {
  assert.throws(() => transactionRequirementsSchema.parse({
    schemaVersion: 1,
    kind: 'base_transaction',
    chainId: 8453,
  }));
  assert.throws(() => transactionRequirementsSchema.parse({
    schemaVersion: 1,
    kind: 'base_transaction',
    chainId: 1,
    minimumValueWei: '1',
  }));

  const parsed = transactionRequirementsSchema.parse({
    schemaVersion: 1,
    kind: 'base_transaction',
    chainId: 8453,
    functionSelector: '0xA9059CBB',
  });
  assert.equal(parsed.minimumConfirmations, 3);
  assert.equal(parsed.functionSelector, '0xa9059cbb');
});
