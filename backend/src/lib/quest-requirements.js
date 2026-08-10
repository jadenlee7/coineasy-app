import { createHash } from 'node:crypto';
import { isAddress } from 'viem';
import { z } from 'zod';

export const QUEST_REQUIREMENTS_SCHEMA_VERSION = 1;
export const BASE_CHAIN_ID = 8453;

const optionId = z.string().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/);
const hexDigest = z.string().regex(/^[a-f0-9]{64}$/);
const evmAddress = z.string().refine(isAddress, 'must be an EVM address');
const functionSelector = z.string().regex(/^0x[a-fA-F0-9]{8}$/).transform((value) => value.toLowerCase());
const topic = z.string().regex(/^0x[a-fA-F0-9]{64}$/).transform((value) => value.toLowerCase());
const positiveBaseUnits = z.string().regex(/^[1-9]\d*$/, 'must be a positive base-unit integer');

export const quizRequirementsSchema = z.object({
  schemaVersion: z.literal(QUEST_REQUIREMENTS_SCHEMA_VERSION),
  kind: z.literal('quiz'),
  question: z.string().min(1).max(500),
  options: z.array(z.object({
    id: optionId,
    label: z.string().min(1).max(300),
  }).strict()).min(2).max(8),
  correctAnswerSha256: hexDigest,
}).strict().superRefine((value, ctx) => {
  const ids = new Set(value.options.map((option) => option.id));
  if (ids.size !== value.options.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: 'option ids must be unique',
    });
  }
});

export const transactionRequirementsSchema = z.object({
  schemaVersion: z.literal(QUEST_REQUIREMENTS_SCHEMA_VERSION),
  kind: z.literal('base_transaction'),
  chainId: z.literal(BASE_CHAIN_ID),
  minimumConfirmations: z.number().int().min(1).max(100).default(3),
  toAddress: evmAddress.optional(),
  functionSelector: functionSelector.optional(),
  minimumValueWei: positiveBaseUnits.optional(),
  requiredEvent: z.object({
    contractAddress: evmAddress,
    topic0: topic,
  }).strict().optional(),
}).strict().superRefine((value, ctx) => {
  if (
    !value.toAddress
    && !value.functionSelector
    && !value.minimumValueWei
    && !value.requiredEvent
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'a transaction quest requires at least one transaction predicate',
    });
  }
});

export const quizSubmissionSchema = z.object({
  answer: z.union([optionId, z.number().int().min(0).max(999)]).transform(String),
}).strict();

export const transactionSubmissionSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).transform((value) => value.toLowerCase()),
}).strict();

export const startQuestSchema = z.object({
  walletSharingOptIn: z.boolean().default(false),
}).strict();

export function normalizeQuizAnswer(answer) {
  return String(answer).normalize('NFKC').trim();
}

export function hashQuizAnswer(questSlug, answer) {
  return createHash('sha256')
    .update(`${questSlug}\0${normalizeQuizAnswer(answer)}`)
    .digest('hex');
}

export function parseQuestRequirements(quest) {
  if (quest.type === 'QUIZ') return quizRequirementsSchema.parse(quest.requirements);
  if (quest.type === 'TRANSACTION') {
    return transactionRequirementsSchema.parse(quest.requirements);
  }
  throw new Error(`unsupported quest type: ${quest.type}`);
}

export function publicQuestRequirements(quest) {
  const parsed = parseQuestRequirements(quest);
  if (parsed.kind === 'quiz') {
    const { correctAnswerSha256: _privateDigest, ...publicRequirements } = parsed;
    return publicRequirements;
  }
  return parsed;
}
