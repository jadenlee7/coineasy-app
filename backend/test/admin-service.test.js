import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminService } from '../src/lib/admin-service.js';

const NOW = new Date('2026-07-21T12:00:00.000Z');
const SEGMENT = {
  id: 'segment_1',
  slug: 'base-starter',
  name: 'Base Starter',
  description: null,
  status: 'ACTIVE',
};
const CAMPAIGN = {
  id: 'campaign_1',
  advertiserId: 'advertiser_1',
  targetSegmentId: SEGMENT.id,
  slug: 'base-starter-campaign',
  name: 'Base Starter Campaign',
  status: 'DRAFT',
  startsAt: null,
  endsAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  targetSegment: SEGMENT,
  _count: { quests: 1 },
};

function reportDb({ eligibleUsers = 3, participantCount = 3, calls = {} } = {}) {
  const userIds = Array.from({ length: participantCount }, (_, index) => ({
    userId: `private_user_${index}`,
  }));
  return {
    campaign: { findFirst: async () => CAMPAIGN },
    userSegment: { count: async (query) => { calls.audience = query; return eligibleUsers; } },
    user: { count: async () => eligibleUsers },
    quest: {
      findMany: async () => [{
        id: 'quest_1',
        slug: 'quest-one',
        title: 'Quest One',
        status: 'ACTIVE',
        rewardOrange: 25,
      }],
    },
    questCompletion: {
      findMany: async (query) => { calls.participants = query; return userIds; },
      groupBy: async (query) => { calls.grouped = query; return [{
        questId: 'quest_1',
        status: 'VERIFIED',
        _count: { _all: participantCount },
      }]; },
    },
  };
}

test('campaign lookup is always scoped to the authenticated advertiser', async () => {
  let where;
  const db = {
    campaign: {
      findFirst: async (query) => { where = query.where; return CAMPAIGN; },
    },
  };
  const service = createAdminService({ prisma: db, now: () => NOW });
  const result = await service.get('advertiser_1', 'campaign_1');

  assert.equal(where.advertiserId, 'advertiser_1');
  assert.deepEqual(where.OR, [{ id: 'campaign_1' }, { slug: 'campaign_1' }]);
  assert.equal(result.id, 'campaign_1');
  assert.equal('advertiserId' in result, false);
});

test('new campaigns are draft-only and accept active segments', async () => {
  let createData;
  const db = {
    segment: { findFirst: async () => SEGMENT },
    campaign: {
      create: async ({ data }) => {
        createData = data;
        return { ...CAMPAIGN, ...data };
      },
    },
  };
  const service = createAdminService({ prisma: db, now: () => NOW });
  const campaign = await service.create('advertiser_1', {
    slug: 'new-campaign',
    name: 'New Campaign',
    targetSegmentId: 'segment_1',
  });

  assert.equal(createData.advertiserId, 'advertiser_1');
  assert.equal(createData.status, 'DRAFT');
  assert.equal(campaign.status, 'DRAFT');
});

test('activation requires at least one active campaign quest', async () => {
  const db = {
    campaign: { findFirst: async () => CAMPAIGN },
    segment: { findFirst: async () => SEGMENT },
    quest: { count: async () => 0 },
  };
  const service = createAdminService({ prisma: db, now: () => NOW });

  await assert.rejects(
    () => service.update('advertiser_1', CAMPAIGN.id, { status: 'ACTIVE' }),
    (error) => error.code === 'active_campaign_quest_required' && error.status === 409,
  );
});

test('small campaign reports suppress every user-derived number and expose no identities', async () => {
  const calls = {};
  const service = createAdminService({
    prisma: reportDb({ eligibleUsers: 9, participantCount: 3, calls }),
    now: () => NOW,
    consentVersion: '2026-07-21',
    minimumCohortSize: 10,
  });
  const report = await service.report('advertiser_1', CAMPAIGN.id);

  assert.deepEqual(report.audience, {
    suppressed: true,
    value: null,
    minimumCohortSize: 10,
  });
  assert.equal(report.completions.suppressed, true);
  assert.equal(report.completions.participants, null);
  assert.equal(report.completions.totals, null);
  assert.equal(report.completions.quests[0].counts, null);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes('private_user_'), false);
  assert.equal(serialized.includes('wallet'), false);
  assert.equal(serialized.includes('verifyProof'), false);
  assert.equal(serialized.includes('rule'), false);
  assert.equal(calls.audience.where.user.consent.is.marketingOptIn, true);
  assert.equal(calls.audience.where.user.consent.is.segmentingOptIn, true);
  assert.equal(calls.participants.where.user.consent.is.marketingOptIn, true);
  assert.equal(calls.grouped.where.user.consent.is.marketingOptIn, true);
});

test('large-enough reports return only aggregate completion status counts', async () => {
  const service = createAdminService({
    prisma: reportDb({ eligibleUsers: 20, participantCount: 12 }),
    now: () => NOW,
    consentVersion: '2026-07-21',
    minimumCohortSize: 10,
  });
  const report = await service.report('advertiser_1', CAMPAIGN.id);

  assert.equal(report.audience.value, 20);
  assert.equal(report.completions.participants, 12);
  assert.deepEqual(report.completions.totals, {
    STARTED: 0,
    SUBMITTED: 0,
    VERIFIED: 12,
    REJECTED: 0,
  });
});
