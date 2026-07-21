import { isAddress } from 'viem';
import { z } from 'zod';

export const SEGMENT_RULE_SCHEMA_VERSION = 1;

const minimumCount = z.number().int().min(1).max(1_000_000);
const windowDays = z.number().int().min(1).max(365);
const baseUnits = z.string().regex(/^\d+$/, 'must be an unsigned base-unit integer');
const contractAddress = z.string().refine(isAddress, 'must be an EVM address');

const conditionSchemas = [
  z.object({
    metric: z.literal('base.native_balance'),
    minimumWei: baseUnits,
  }).strict(),
  z.object({
    metric: z.literal('base.erc20_balance'),
    contractAddress,
    minimumBaseUnits: baseUnits,
  }).strict(),
  z.object({
    metric: z.literal('base.transaction_count'),
    minimum: minimumCount,
  }).strict(),
  z.object({
    metric: z.literal('base.activity_count'),
    minimum: minimumCount.max(999),
    windowDays,
  }).strict(),
  z.object({
    metric: z.literal('base.active_days'),
    minimum: z.number().int().min(1).max(365),
    windowDays,
  }).strict().superRefine((value, ctx) => {
    if (value.minimum > value.windowDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minimum'],
        message: 'cannot exceed windowDays',
      });
    }
  }),
  z.object({
    metric: z.literal('efp.followers'),
    minimum: minimumCount,
  }).strict(),
  z.object({
    metric: z.literal('efp.following'),
    minimum: minimumCount,
  }).strict(),
  z.object({
    metric: z.literal('easygo.swap_count'),
    minimum: minimumCount,
    windowDays,
  }).strict(),
];

export const segmentConditionSchema = z.union(conditionSchemas);

export const segmentRuleSchema = z.object({
  schemaVersion: z.literal(SEGMENT_RULE_SCHEMA_VERSION),
  match: z.enum(['all', 'any']).default('all'),
  membershipTtlHours: z.number().int().min(1).max(168).default(24),
  conditions: z.array(segmentConditionSchema).min(1).max(10),
}).strict();

export function parseSegmentRule(rule) {
  return segmentRuleSchema.parse(rule);
}

function matchesMinimum(condition, actual) {
  if (condition.metric === 'base.native_balance') {
    return BigInt(actual) >= BigInt(condition.minimumWei);
  }
  if (condition.metric === 'base.erc20_balance') {
    return BigInt(actual) >= BigInt(condition.minimumBaseUnits);
  }
  return Number(actual) >= condition.minimum;
}

export async function evaluateSegmentRule(rule, resolveMetric) {
  const parsed = parseSegmentRule(rule);

  if (parsed.match === 'all') {
    for (const condition of parsed.conditions) {
      const actual = await resolveMetric(condition);
      if (!matchesMinimum(condition, actual)) return false;
    }
    return true;
  }

  for (const condition of parsed.conditions) {
    const actual = await resolveMetric(condition);
    if (matchesMinimum(condition, actual)) return true;
  }
  return false;
}

export function membershipExpiry(rule, now = new Date()) {
  const parsed = parseSegmentRule(rule);
  return new Date(now.getTime() + parsed.membershipTtlHours * 60 * 60 * 1000);
}
