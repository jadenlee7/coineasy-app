import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateSegmentRule,
  membershipExpiry,
  parseSegmentRule,
} from '../src/lib/segment-rules.js';

const RULE = {
  schemaVersion: 1,
  match: 'all',
  membershipTtlHours: 24,
  conditions: [
    { metric: 'base.erc20_balance', contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', minimumBaseUnits: '100000000' },
    { metric: 'base.active_days', minimum: 3, windowDays: 30 },
  ],
};

test('v1 rules combine typed Base predicates without floating-point token math', async () => {
  const seen = [];
  const matched = await evaluateSegmentRule(RULE, async (condition) => {
    seen.push(condition.metric);
    return condition.metric === 'base.erc20_balance' ? 100_000_000n : 4;
  });

  assert.equal(matched, true);
  assert.deepEqual(seen, ['base.erc20_balance', 'base.active_days']);

  const notMatched = await evaluateSegmentRule(RULE, async (condition) => (
    condition.metric === 'base.erc20_balance' ? 99_999_999n : 30
  ));
  assert.equal(notMatched, false);
});

test('rules are strict, bounded, and reject impossible active-day thresholds', () => {
  assert.throws(() => parseSegmentRule({ ...RULE, unexpected: true }));
  assert.throws(() => parseSegmentRule({
    ...RULE,
    conditions: [{ metric: 'base.activity_count', minimum: 1_000, windowDays: 30 }],
  }));
  assert.throws(() => parseSegmentRule({
    ...RULE,
    conditions: [{ metric: 'base.active_days', minimum: 31, windowDays: 30 }],
  }));
});

test('any rules short-circuit and memberships receive a bounded expiry', async () => {
  let calls = 0;
  const rule = {
    schemaVersion: 1,
    match: 'any',
    membershipTtlHours: 2,
    conditions: [
      { metric: 'efp.followers', minimum: 1 },
      { metric: 'easygo.swap_count', minimum: 1, windowDays: 7 },
    ],
  };
  assert.equal(await evaluateSegmentRule(rule, async () => {
    calls += 1;
    return 5;
  }), true);
  assert.equal(calls, 1);

  const now = new Date('2026-07-21T12:00:00.000Z');
  assert.equal(membershipExpiry(rule, now).toISOString(), '2026-07-21T14:00:00.000Z');
});
