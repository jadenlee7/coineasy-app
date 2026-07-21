import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSegmentMetricResolver,
  hasCurrentSegmentConsent,
  runSegmentCycle,
} from '../src/lib/segment-worker.js';

const CURRENT_VERSION = '2026-07-21';
const NOW = new Date('2026-07-21T12:00:00.000Z');
const USER = {
  id: 'user_1',
  verifiedAddress: '0x0000000000000000000000000000000000000001',
  siweChainId: 8453,
  consent: {
    consentVersion: CURRENT_VERSION,
    termsAcceptedAt: NOW,
    privacyAcceptedAt: NOW,
    segmentingOptIn: true,
    marketingOptIn: false,
  },
};

test('segment eligibility requires current complete consent and a Base verification', () => {
  assert.equal(hasCurrentSegmentConsent(USER, CURRENT_VERSION), true);
  assert.equal(hasCurrentSegmentConsent({ ...USER, siweChainId: 1 }, CURRENT_VERSION), false);
  assert.equal(hasCurrentSegmentConsent({
    ...USER,
    consent: { ...USER.consent, consentVersion: 'stale' },
  }, CURRENT_VERSION), false);
  assert.equal(hasCurrentSegmentConsent({
    ...USER,
    consent: { ...USER.consent, segmentingOptIn: false },
  }, CURRENT_VERSION), false);
});

test('metric resolver memoizes provider reads without retaining evidence', async () => {
  const calls = { history: 0, efp: 0 };
  const sources = {
    nativeBalance: async () => 1n,
    erc20Balance: async () => 2n,
    transactionCount: async () => 3,
    baseHistory: async () => {
      calls.history += 1;
      return { normal: [{ hash: '0x1', timeStamp: '1784635200' }], erc20: [] };
    },
    efpStats: async () => {
      calls.efp += 1;
      return { followers: 4, following: 5 };
    },
    swapCount: async () => 6,
  };
  const resolve = createSegmentMetricResolver({ sources, user: USER, now: NOW });

  assert.equal(await resolve({ metric: 'base.activity_count', windowDays: 30 }), 1);
  assert.equal(await resolve({ metric: 'base.active_days', windowDays: 30 }), 1);
  assert.equal(await resolve({ metric: 'efp.followers' }), 4);
  assert.equal(await resolve({ metric: 'efp.following' }), 5);
  assert.equal(calls.history, 1);
  assert.equal(calls.efp, 1);
});

test('truncated provider history becomes unknown when it cannot prove a minimum', async () => {
  const resolve = createSegmentMetricResolver({
    user: USER,
    now: NOW,
    sources: {
      baseHistory: async () => ({
        normal: Array.from({ length: 1_000 }, (_, index) => ({
          hash: `0x${index}`,
          timeStamp: '1784635200',
        })),
        erc20: [],
      }),
    },
  });

  await assert.rejects(
    () => resolve({ metric: 'base.active_days', minimum: 2, windowDays: 30 }),
    (error) => error.code === 'activity_history_truncated',
  );
});

test('a successful cycle writes only membership metadata', async () => {
  const writes = [];
  const tx = {
    $queryRawUnsafe: async () => [{ locked: true }],
    userSegment: {
      findMany: async () => [],
      findUnique: async () => null,
      upsert: async (query) => { writes.push(query); return query.create; },
      deleteMany: async () => ({ count: 0 }),
    },
    user: { findMany: async () => [USER] },
  };
  const db = {
    segment: {
      findMany: async () => [{
        id: 'segment_1',
        slug: 'base-user',
        ruleVersion: 3,
        rule: {
          schemaVersion: 1,
          match: 'all',
          membershipTtlHours: 24,
          conditions: [{ metric: 'base.transaction_count', minimum: 1 }],
        },
      }],
    },
    user: { findMany: async () => [USER] },
    $transaction: async (callback) => callback(tx),
  };
  const result = await runSegmentCycle({
    db,
    env: { EASYGO_CONSENT_VERSION: CURRENT_VERSION },
    now: NOW,
    sources: {
      transactionCount: async () => 2,
    },
    logger: { error() {}, warn() {} },
  });

  assert.equal(result.usersEvaluated, 1);
  assert.equal(result.matched, 1);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].create, {
    userId: 'user_1',
    segmentId: 'segment_1',
    source: 'INDEXER',
    ruleVersion: 3,
    matchedAt: NOW,
    expiresAt: new Date('2026-07-22T12:00:00.000Z'),
  });
  assert.equal('evidence' in writes[0].create, false);
});

test('source failures preserve a prior membership until its expiry', async () => {
  let upserts = 0;
  let deletes = 0;
  const tx = {
    $queryRawUnsafe: async () => [{ locked: true }],
    userSegment: {
      findMany: async () => [{
        userId: USER.id,
        segmentId: 'segment_1',
        expiresAt: new Date('2026-07-22T12:00:00.000Z'),
        segment: { status: 'ACTIVE' },
        user: USER,
      }],
      findUnique: async () => null,
      upsert: async () => { upserts += 1; },
      deleteMany: async () => { deletes += 1; return { count: 1 }; },
    },
    user: { findMany: async () => [USER] },
  };
  const db = {
    segment: { findMany: async () => [{
      id: 'segment_1',
      slug: 'base-user',
      ruleVersion: 1,
      rule: {
        schemaVersion: 1,
        match: 'all',
        membershipTtlHours: 24,
        conditions: [{ metric: 'base.transaction_count', minimum: 1 }],
      },
    }] },
    user: { findMany: async () => [USER] },
    $transaction: async (callback) => callback(tx),
  };
  const result = await runSegmentCycle({
    db,
    env: { EASYGO_CONSENT_VERSION: CURRENT_VERSION },
    now: NOW,
    sources: { transactionCount: async () => { throw new Error('provider down'); } },
    logger: { error() {}, warn() {} },
  });

  assert.equal(result.outcomes, 1);
  assert.equal(upserts, 0);
  assert.equal(deletes, 0);
});
