import { z } from 'zod';

const campaignSlug = z.string().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const campaignName = z.string().trim().min(2).max(200);
const nullableDate = z.string().datetime({ offset: true }).transform((value) => new Date(value)).nullable();
const nullableId = z.string().min(1).max(100).nullable();

export const createCampaignSchema = z.object({
  slug: campaignSlug,
  name: campaignName,
  targetSegmentId: nullableId.optional().default(null),
  startsAt: nullableDate.optional().default(null),
  endsAt: nullableDate.optional().default(null),
}).strict();

export const updateCampaignSchema = z.object({
  name: campaignName.optional(),
  targetSegmentId: nullableId.optional(),
  startsAt: nullableDate.optional(),
  endsAt: nullableDate.optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'at least one field is required');

const CAMPAIGN_INCLUDE = {
  targetSegment: {
    select: { id: true, slug: true, name: true, description: true, status: true },
  },
  _count: { select: { quests: true } },
};

const COMPLETION_STATUSES = ['STARTED', 'SUBMITTED', 'VERIFIED', 'REJECTED'];
const STATUS_TRANSITIONS = {
  DRAFT: new Set(['ACTIVE', 'ARCHIVED']),
  ACTIVE: new Set(['PAUSED', 'COMPLETED', 'ARCHIVED']),
  PAUSED: new Set(['ACTIVE', 'COMPLETED', 'ARCHIVED']),
  COMPLETED: new Set(['ARCHIVED']),
  ARCHIVED: new Set(),
};

export class AdminError extends Error {
  constructor(code, { status = 400, cause } = {}) {
    super(code, cause ? { cause } : undefined);
    this.name = 'AdminError';
    this.code = code;
    this.status = status;
  }
}

function publicCampaign(campaign) {
  return {
    id: campaign.id,
    slug: campaign.slug,
    name: campaign.name,
    status: campaign.status,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    targetSegment: campaign.targetSegment,
    questCount: campaign._count?.quests ?? 0,
  };
}

function parseInput(schema, input) {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AdminError('bad_input', { status: 400, cause: error });
    }
    throw error;
  }
}

function assertDateWindow(startsAt, endsAt, now, activating = false) {
  if (startsAt && endsAt && startsAt >= endsAt) {
    throw new AdminError('invalid_campaign_window', { status: 409 });
  }
  if (activating && endsAt && endsAt <= now) {
    throw new AdminError('campaign_window_ended', { status: 409 });
  }
}

function emptyCompletionCounts() {
  return Object.fromEntries(COMPLETION_STATUSES.map((status) => [status, 0]));
}

function suppressedMetric(value, minimumCohortSize) {
  const suppressed = value < minimumCohortSize;
  return {
    suppressed,
    value: suppressed ? null : value,
    minimumCohortSize,
  };
}

export function createAdminService({
  prisma,
  now = () => new Date(),
  consentVersion,
  minimumCohortSize = 10,
} = {}) {
  if (!prisma) throw new Error('prisma is required');
  if (!Number.isInteger(minimumCohortSize) || minimumCohortSize < 10 || minimumCohortSize > 10_000) {
    throw new Error('minimumCohortSize must be an integer from 10 to 10000');
  }

  async function ownedCampaign(advertiserId, campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { advertiserId, OR: [{ id: campaignId }, { slug: campaignId }] },
      include: CAMPAIGN_INCLUDE,
    });
    if (!campaign) throw new AdminError('campaign_not_found', { status: 404 });
    return campaign;
  }

  async function activeSegment(targetSegmentId) {
    if (!targetSegmentId) return null;
    const segment = await prisma.segment.findFirst({
      where: { id: targetSegmentId, status: 'ACTIVE' },
      select: { id: true, slug: true, name: true, description: true, status: true },
    });
    if (!segment) throw new AdminError('active_target_segment_required', { status: 409 });
    return segment;
  }

  async function list(advertiserId) {
    const campaigns = await prisma.campaign.findMany({
      where: { advertiserId },
      include: CAMPAIGN_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return campaigns.map(publicCampaign);
  }

  async function get(advertiserId, campaignId) {
    return publicCampaign(await ownedCampaign(advertiserId, campaignId));
  }

  async function create(advertiserId, input) {
    const data = parseInput(createCampaignSchema, input);
    assertDateWindow(data.startsAt, data.endsAt, now());
    await activeSegment(data.targetSegmentId);
    try {
      const campaign = await prisma.campaign.create({
        data: { advertiserId, ...data, status: 'DRAFT' },
        include: CAMPAIGN_INCLUDE,
      });
      return publicCampaign(campaign);
    } catch (error) {
      if (error?.code === 'P2002') {
        throw new AdminError('campaign_slug_taken', { status: 409, cause: error });
      }
      throw error;
    }
  }

  async function update(advertiserId, campaignId, input) {
    const data = parseInput(updateCampaignSchema, input);
    const current = await ownedCampaign(advertiserId, campaignId);
    if (current.status === 'ARCHIVED') {
      throw new AdminError('campaign_archived', { status: 409 });
    }

    const contentFields = ['name', 'targetSegmentId', 'startsAt', 'endsAt'];
    const changesContent = contentFields.some((field) => data[field] !== undefined);
    if (changesContent && !['DRAFT', 'PAUSED'].includes(current.status)) {
      throw new AdminError('campaign_content_locked', { status: 409 });
    }
    if (
      data.status
      && data.status !== current.status
      && !STATUS_TRANSITIONS[current.status].has(data.status)
    ) {
      throw new AdminError('invalid_campaign_status_transition', { status: 409 });
    }

    const proposed = {
      startsAt: data.startsAt !== undefined ? data.startsAt : current.startsAt,
      endsAt: data.endsAt !== undefined ? data.endsAt : current.endsAt,
      targetSegmentId: data.targetSegmentId !== undefined
        ? data.targetSegmentId
        : current.targetSegmentId,
      status: data.status || current.status,
    };
    const activating = proposed.status === 'ACTIVE' && current.status !== 'ACTIVE';
    assertDateWindow(proposed.startsAt, proposed.endsAt, now(), activating);
    if (data.targetSegmentId !== undefined || activating) {
      await activeSegment(proposed.targetSegmentId);
    }
    if (activating) {
      const activeQuestCount = await prisma.quest.count({
        where: { campaignId: current.id, status: 'ACTIVE' },
      });
      if (activeQuestCount < 1) {
        throw new AdminError('active_campaign_quest_required', { status: 409 });
      }
    }

    try {
      const campaign = await prisma.campaign.update({
        where: { id: current.id },
        data,
        include: CAMPAIGN_INCLUDE,
      });
      return publicCampaign(campaign);
    } catch (error) {
      if (error?.code === 'P2002') {
        throw new AdminError('campaign_slug_taken', { status: 409, cause: error });
      }
      throw error;
    }
  }

  async function report(advertiserId, campaignId) {
    if (!consentVersion) {
      throw new AdminError('consent_policy_unconfigured', { status: 503 });
    }
    const campaign = await ownedCampaign(advertiserId, campaignId);
    const currentMarketingConsent = {
      consentVersion,
      termsAcceptedAt: { not: null },
      privacyAcceptedAt: { not: null },
      marketingOptIn: true,
    };
    const audienceConsent = {
      is: {
        ...currentMarketingConsent,
        ...(campaign.targetSegmentId ? { segmentingOptIn: true } : {}),
      },
    };
    const completionUser = { consent: { is: currentMarketingConsent } };

    const audiencePromise = campaign.targetSegmentId
      ? prisma.userSegment.count({
          where: {
            segmentId: campaign.targetSegmentId,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }],
            user: { consent: audienceConsent },
          },
        })
      : prisma.user.count({ where: { consent: audienceConsent } });

    const [eligibleUsers, quests, participants, groupedCounts] = await Promise.all([
      audiencePromise,
      prisma.quest.findMany({
        where: { campaignId: campaign.id },
        select: { id: true, slug: true, title: true, status: true, rewardOrange: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.questCompletion.findMany({
        where: { quest: { campaignId: campaign.id }, user: completionUser },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.questCompletion.groupBy({
        by: ['questId', 'status'],
        where: { quest: { campaignId: campaign.id }, user: completionUser },
        _count: { _all: true },
      }),
    ]);

    const participantMetric = suppressedMetric(participants.length, minimumCohortSize);
    const countsByQuest = new Map();
    for (const row of groupedCounts) {
      const counts = countsByQuest.get(row.questId) || emptyCompletionCounts();
      counts[row.status] = row._count._all;
      countsByQuest.set(row.questId, counts);
    }
    const totals = emptyCompletionCounts();
    for (const counts of countsByQuest.values()) {
      for (const status of COMPLETION_STATUSES) totals[status] += counts[status];
    }

    return {
      campaign: publicCampaign(campaign),
      generatedAt: now(),
      audience: suppressedMetric(eligibleUsers, minimumCohortSize),
      completions: {
        suppressed: participantMetric.suppressed,
        participants: participantMetric.value,
        minimumCohortSize,
        totals: participantMetric.suppressed ? null : totals,
        quests: quests.map((quest) => ({
          ...quest,
          counts: participantMetric.suppressed
            ? null
            : (countsByQuest.get(quest.id) || emptyCompletionCounts()),
        })),
      },
    };
  }

  return { list, get, create, update, report };
}
