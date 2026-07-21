import { getAddress } from 'viem';
import { consentView, getCurrentConsentVersion } from './consent.js';
import { createSegmentSources, normalizeBaseActivity } from './segment-sources.js';
import {
  evaluateSegmentRule,
  membershipExpiry,
  parseSegmentRule,
} from './segment-rules.js';
import { logger as defaultLogger } from './logger.js';

const ADVISORY_LOCK_ID = 720_260_721;

function configuredInteger(value, fallback, { min, max, name }) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

export function getSegmentWorkerConfig(env = process.env) {
  return {
    intervalMs: configuredInteger(env.SEGMENT_WORKER_INTERVAL_MS, 300_000, {
      min: 60_000,
      max: 86_400_000,
      name: 'SEGMENT_WORKER_INTERVAL_MS',
    }),
    batchSize: configuredInteger(env.SEGMENT_WORKER_BATCH_SIZE, 100, {
      min: 1,
      max: 500,
      name: 'SEGMENT_WORKER_BATCH_SIZE',
    }),
    concurrency: configuredInteger(env.SEGMENT_WORKER_CONCURRENCY, 2, {
      min: 1,
      max: 10,
      name: 'SEGMENT_WORKER_CONCURRENCY',
    }),
  };
}

export function hasCurrentSegmentConsent(user, currentVersion) {
  return Boolean(
    user?.verifiedAddress
    && user?.siweChainId === 8453
    && consentView(user.consent, currentVersion).segmentingOptIn,
  );
}

function daysAgo(now, days) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function createSegmentMetricResolver({ sources, user, now = new Date() }) {
  const cache = new Map();
  const address = getAddress(user.verifiedAddress);

  function cached(key, loader) {
    if (!cache.has(key)) cache.set(key, Promise.resolve().then(loader));
    return cache.get(key);
  }

  return async (condition) => {
    switch (condition.metric) {
      case 'base.native_balance':
        return cached('base.native_balance', () => sources.nativeBalance(address));
      case 'base.erc20_balance': {
        const contract = getAddress(condition.contractAddress);
        return cached(
          `base.erc20_balance:${contract.toLowerCase()}`,
          () => sources.erc20Balance(address, contract),
        );
      }
      case 'base.transaction_count':
        return cached('base.transaction_count', () => sources.transactionCount(address));
      case 'base.activity_count':
      case 'base.active_days': {
        const history = await cached('base.history', () => sources.baseHistory(address));
        const activity = normalizeBaseActivity(history, daysAgo(now, condition.windowDays));
        const value = condition.metric === 'base.activity_count'
          ? activity.activityCount
          : activity.activeDays;
        if (activity.historyTruncated && value < condition.minimum) {
          const error = new Error('Base activity history is truncated before the threshold');
          error.code = 'activity_history_truncated';
          throw error;
        }
        return value;
      }
      case 'efp.followers':
      case 'efp.following': {
        const stats = await cached('efp.stats', () => sources.efpStats(address));
        return condition.metric === 'efp.followers' ? stats.followers : stats.following;
      }
      case 'easygo.swap_count':
        return cached(
          `easygo.swap_count:${condition.windowDays}`,
          () => sources.swapCount(user.id, daysAgo(now, condition.windowDays)),
        );
      default:
        throw new Error(`unsupported segment metric: ${condition.metric}`);
    }
  };
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function next() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

async function collectEligibleUsers(db, currentVersion, batchSize) {
  const users = [];
  let cursor;

  do {
    const rows = await db.user.findMany({
      where: {
        verifiedAddress: { not: null },
        siweChainId: 8453,
        consent: {
          is: {
            consentVersion: currentVersion,
            termsAcceptedAt: { not: null },
            privacyAcceptedAt: { not: null },
            segmentingOptIn: true,
          },
        },
      },
      select: {
        id: true,
        verifiedAddress: true,
        siweChainId: true,
        consent: true,
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    users.push(...rows);
    cursor = rows.length === batchSize ? rows.at(-1).id : undefined;
  } while (cursor);

  return users;
}

function indexerMembershipIsStale(membership, currentVersion) {
  return !hasCurrentSegmentConsent(membership.user, currentVersion);
}

async function applyOutcomes(db, {
  outcomes,
  invalidSegmentIds,
  currentVersion,
  now,
}) {
  return db.$transaction(async (tx) => {
    const lockRows = typeof tx.$queryRawUnsafe === 'function'
      ? await tx.$queryRawUnsafe(
          'SELECT pg_try_advisory_xact_lock($1) AS locked',
          ADVISORY_LOCK_ID,
        )
      : [{ locked: true }];
    if (!lockRows?.[0]?.locked) return { skipped: true, matched: 0, removed: 0 };

    let matched = 0;
    let removed = 0;

    const indexed = await tx.userSegment.findMany({
      where: { source: 'INDEXER' },
      select: {
        userId: true,
        segmentId: true,
        expiresAt: true,
        segment: { select: { status: true } },
        user: { select: { verifiedAddress: true, siweChainId: true, consent: true } },
      },
    });

    const stalePairs = indexed
      .filter((membership) => (
        indexerMembershipIsStale(membership, currentVersion)
        || membership.segment.status !== 'ACTIVE'
        || (membership.expiresAt && membership.expiresAt <= now)
        || invalidSegmentIds.includes(membership.segmentId)
      ))
      .map(({ userId, segmentId }) => ({ userId, segmentId }));

    if (stalePairs.length) {
      const result = await tx.userSegment.deleteMany({ where: { OR: stalePairs } });
      removed += result.count;
    }

    const candidateIds = [...new Set(outcomes.map((outcome) => outcome.userId))];
    const currentUsers = candidateIds.length
      ? await tx.user.findMany({
          where: { id: { in: candidateIds } },
          select: { id: true, verifiedAddress: true, siweChainId: true, consent: true },
        })
      : [];
    const eligibleIds = new Set(
      currentUsers
        .filter((user) => hasCurrentSegmentConsent(user, currentVersion))
        .map((user) => user.id),
    );

    for (const outcome of outcomes) {
      if (outcome.result === 'unknown') continue;

      if (outcome.result === 'match' && eligibleIds.has(outcome.userId)) {
        const existing = await tx.userSegment.findUnique({
          where: {
            userId_segmentId: {
              userId: outcome.userId,
              segmentId: outcome.segmentId,
            },
          },
          select: { source: true },
        });
        if (existing?.source === 'MANUAL') continue;

        await tx.userSegment.upsert({
          where: {
            userId_segmentId: {
              userId: outcome.userId,
              segmentId: outcome.segmentId,
            },
          },
          update: {
            source: 'INDEXER',
            ruleVersion: outcome.ruleVersion,
            matchedAt: now,
            expiresAt: outcome.expiresAt,
          },
          create: {
            userId: outcome.userId,
            segmentId: outcome.segmentId,
            source: 'INDEXER',
            ruleVersion: outcome.ruleVersion,
            matchedAt: now,
            expiresAt: outcome.expiresAt,
          },
        });
        matched += 1;
        continue;
      }

      const result = await tx.userSegment.deleteMany({
        where: {
          userId: outcome.userId,
          segmentId: outcome.segmentId,
          source: 'INDEXER',
        },
      });
      removed += result.count;
    }

    return { skipped: false, matched, removed };
  }, { maxWait: 5_000, timeout: 30_000 });
}

export async function runSegmentCycle({
  db,
  env = process.env,
  sources,
  logger = defaultLogger,
  now = new Date(),
} = {}) {
  if (!db) throw new Error('segment worker requires a database client');

  const currentVersion = getCurrentConsentVersion(env);
  const config = getSegmentWorkerConfig(env);
  const sourceAdapters = sources || createSegmentSources({ db, env });
  const segments = await db.segment.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      slug: true,
      ruleVersion: true,
      rule: true,
    },
    orderBy: { id: 'asc' },
  });

  const validSegments = [];
  const invalidSegmentIds = [];
  for (const segment of segments) {
    try {
      validSegments.push({ ...segment, parsedRule: parseSegmentRule(segment.rule) });
    } catch (error) {
      invalidSegmentIds.push(segment.id);
      logger.error(
        { errorName: error?.name || 'Error', segmentId: segment.id, slug: segment.slug },
        'segment rule invalid',
      );
    }
  }

  const users = await collectEligibleUsers(db, currentVersion, config.batchSize);
  const userResults = await mapWithConcurrency(users, config.concurrency, async (user) => {
    const resolveMetric = createSegmentMetricResolver({ sources: sourceAdapters, user, now });
    const outcomes = [];

    for (const segment of validSegments) {
      try {
        const matched = await evaluateSegmentRule(segment.parsedRule, resolveMetric);
        outcomes.push({
          userId: user.id,
          segmentId: segment.id,
          ruleVersion: segment.ruleVersion,
          result: matched ? 'match' : 'no_match',
          expiresAt: matched ? membershipExpiry(segment.parsedRule, now) : null,
        });
      } catch (error) {
        logger.warn(
          {
            errorCode: error?.code || null,
            errorName: error?.name || 'Error',
            userId: user.id,
            segmentId: segment.id,
          },
          'segment source unavailable; preserving prior membership until expiry',
        );
        outcomes.push({
          userId: user.id,
          segmentId: segment.id,
          ruleVersion: segment.ruleVersion,
          result: 'unknown',
          expiresAt: null,
        });
      }
    }
    return outcomes;
  });

  const outcomes = userResults.flat();
  const applied = await applyOutcomes(db, {
    outcomes,
    invalidSegmentIds,
    currentVersion,
    now,
  });

  return {
    consentVersion: currentVersion,
    usersEvaluated: users.length,
    activeSegments: segments.length,
    validSegments: validSegments.length,
    invalidSegments: invalidSegmentIds.length,
    outcomes: outcomes.length,
    ...applied,
  };
}

export async function runSegmentWorkerLoop({
  db,
  env = process.env,
  logger = defaultLogger,
  signal,
  once = false,
  runCycle = runSegmentCycle,
} = {}) {
  const { intervalMs } = getSegmentWorkerConfig(env);

  while (!signal?.aborted) {
    const startedAt = Date.now();
    try {
      const result = await runCycle({ db, env, logger });
      logger.info({ ...result, durationMs: Date.now() - startedAt }, 'segment cycle complete');
    } catch (error) {
      logger.error({ err: error, durationMs: Date.now() - startedAt }, 'segment cycle failed');
      if (once) throw error;
    }

    if (once || signal?.aborted) break;
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, intervalMs);
      signal?.addEventListener('abort', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
  }
}
