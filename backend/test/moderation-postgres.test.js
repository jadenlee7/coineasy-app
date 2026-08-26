import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';

import { createModerationService } from '../src/lib/moderation-service.js';
import { verifyModerationDatabaseContract } from '../src/lib/moderation-database.js';
import {
  createPostReportHandler,
  createUpdatePostHandler,
} from '../src/routes/posts.js';

const databaseUrl = process.env.TEST_DATABASE_URL;

function response() {
  return {
    body: null,
    headers: {},
    statusCode: 200,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

function postRequest({ postId, privyDid, body }) {
  return {
    body,
    params: { id: postId },
    user: { privyDid },
  };
}

test('CI supplies the disposable moderation PostgreSQL database', {
  skip: process.env.CI !== 'true',
}, () => {
  assert.ok(databaseUrl, 'TEST_DATABASE_URL is required in CI');
});

test('PostgreSQL enforces moderation fanout, privacy, rollout, and edit races', {
  skip: !databaseUrl,
  timeout: 30_000,
}, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const editPrisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = randomUUID();
  const now = new Date('2026-08-26T12:00:00.000Z');
  const authorId = `mod-pg-author-${suffix}`;
  const authorDid = `did:privy:${authorId}`;
  const compatReporterId = `mod-pg-compat-${suffix}`;
  const compatReporterDid = `did:privy:${compatReporterId}`;
  const retentionReporterId = `mod-pg-retention-${suffix}`;
  const reporterIds = Array.from(
    { length: 250 },
    (_, index) => `mod-pg-reporter-${index}-${suffix}`,
  );
  const userIds = [
    authorId,
    compatReporterId,
    retentionReporterId,
    ...reporterIds,
  ];
  const postIds = {
    claim: `mod-pg-claim-post-${suffix}`,
    action: `mod-pg-action-post-${suffix}`,
    unavailable: `mod-pg-unavailable-post-${suffix}`,
    dismiss: `mod-pg-dismiss-post-${suffix}`,
    stale: `mod-pg-stale-post-${suffix}`,
    race: `mod-pg-race-post-${suffix}`,
    compat: `mod-pg-compat-post-${suffix}`,
    retention: `mod-pg-retention-post-${suffix}`,
    constraint: `mod-pg-constraint-post-${suffix}`,
  };
  const reportIds = {
    claim: `mod-pg-claim-report-${suffix}`,
    action: `mod-pg-action-report-${suffix}`,
    unavailable: `mod-pg-unavailable-report-${suffix}`,
    dismiss: `mod-pg-dismiss-report-${suffix}`,
    dismissOpen: `mod-pg-dismiss-open-${suffix}`,
    dismissOther: `mod-pg-dismiss-other-${suffix}`,
    stale: `mod-pg-stale-report-${suffix}`,
    race: `mod-pg-race-report-${suffix}`,
    retention: `mod-pg-retention-report-${suffix}`,
  };

  try {
    await prisma.user.createMany({
      data: userIds.map((id) => ({ id, privyDid: `did:privy:${id}` })),
    });
    await prisma.post.createMany({
      data: [
        { id: postIds.claim, authorId, body: 'claim concurrency post' },
        {
          id: postIds.action,
          authorId,
          body: 'high fanout raw body',
          contentRevision: 2,
        },
        {
          id: postIds.unavailable,
          authorId: null,
          body: '',
          deletedAt: new Date(now.getTime() - 30_000),
          contentRevision: 2,
        },
        { id: postIds.dismiss, authorId, body: 'dismiss target body' },
        { id: postIds.stale, authorId, body: 'before author edit' },
        { id: postIds.race, authorId, body: 'must never resurrect' },
        { id: postIds.compat, authorId, body: 'expand revision zero' },
        { id: postIds.retention, authorId, body: 'retained audit body' },
        { id: postIds.constraint, authorId, body: 'constraint probe body' },
      ],
    });

    const dedupeIndexes = await prisma.$queryRawUnsafe(
      `SELECT indexname AS "indexName"
       FROM pg_indexes
       WHERE schemaname = current_schema()
         AND tablename = 'PostReport'
         AND indexname IN (
           'uniq_post_report_reporter',
           'uniq_post_report_reporter_revision'
         )
       ORDER BY indexname`,
    );
    assert.deepEqual(dedupeIndexes.map(({ indexName }) => indexName), [
      'uniq_post_report_reporter',
      'uniq_post_report_reporter_revision',
    ]);
    assert.equal(await verifyModerationDatabaseContract(prisma), true);
    await assert.rejects(
      () => prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('DROP INDEX "idx_post_report_queue_v2"');
        await verifyModerationDatabaseContract(tx);
      }),
      /moderation database contract is unavailable/u,
    );

    await assert.rejects(() => prisma.postReport.create({
      data: {
        id: `mod-pg-invalid-terminal-${suffix}`,
        postId: postIds.constraint,
        reporterId: reporterIds[249],
        reason: 'SPAM',
        postRevision: 0,
        status: 'ACTIONED',
        reviewerKeyId: 'primary-reviewer',
        claimedAt: now,
        reviewedAt: now,
        version: 1,
      },
    }));

    await prisma.postReport.create({
      data: {
        id: reportIds.claim,
        postId: postIds.claim,
        reporterId: reporterIds[0],
        reason: 'SPAM',
        postRevision: 0,
      },
    });
    await prisma.postReport.createMany({
      data: reporterIds.map((reporterId, index) => ({
        id: index === 0
          ? reportIds.action
          : `mod-pg-action-report-${index}-${suffix}`,
        postId: postIds.action,
        reporterId,
        reason: index % 2 ? 'SCAM_FRAUD' : 'SPAM',
        postRevision: index === 0 ? 2 : index % 3,
        ...(index === 0 ? {
          status: 'REVIEWING',
          reviewerKeyId: 'primary-reviewer',
          claimedAt: new Date(now.getTime() - 60_000),
          version: 1,
        } : {}),
      })),
    });
    await prisma.postReport.createMany({
      data: [0, 1, 2].map((postRevision, index) => ({
        id: index === 0
          ? reportIds.unavailable
          : `mod-pg-unavailable-report-${index}-${suffix}`,
        postId: postIds.unavailable,
        reporterId: reporterIds[240 + index],
        reason: 'SPAM',
        postRevision,
      })),
    });
    await prisma.postReport.createMany({
      data: [
        {
          id: reportIds.dismiss,
          postId: postIds.dismiss,
          reporterId: reporterIds[230],
          reason: 'SPAM',
          postRevision: 0,
          status: 'REVIEWING',
          reviewerKeyId: 'primary-reviewer',
          claimedAt: new Date(now.getTime() - 60_000),
          version: 1,
        },
        {
          id: reportIds.dismissOpen,
          postId: postIds.dismiss,
          reporterId: reporterIds[231],
          reason: 'SPAM',
          postRevision: 0,
        },
        {
          id: reportIds.dismissOther,
          postId: postIds.dismiss,
          reporterId: reporterIds[232],
          reason: 'SPAM',
          postRevision: 0,
          status: 'REVIEWING',
          reviewerKeyId: 'other-reviewer',
          claimedAt: new Date(now.getTime() - 60_000),
          version: 4,
        },
        {
          id: reportIds.stale,
          postId: postIds.stale,
          reporterId: reporterIds[233],
          reason: 'SCAM_FRAUD',
          postRevision: 0,
          status: 'REVIEWING',
          reviewerKeyId: 'primary-reviewer',
          claimedAt: new Date(now.getTime() - 60_000),
          version: 1,
        },
        {
          id: reportIds.race,
          postId: postIds.race,
          reporterId: reporterIds[234],
          reason: 'SCAM_FRAUD',
          postRevision: 0,
          status: 'REVIEWING',
          reviewerKeyId: 'primary-reviewer',
          claimedAt: new Date(now.getTime() - 60_000),
          version: 1,
        },
        {
          id: reportIds.retention,
          postId: postIds.retention,
          reporterId: retentionReporterId,
          reason: 'SPAM',
          postRevision: 0,
        },
      ],
    });

    const migrationSource = readFileSync(new URL(
      '../prisma/migrations/20260826144000_moderation_queue/migration.sql',
      import.meta.url,
    ), 'utf8');
    const legacyPrecondition = migrationSource.match(/DO \$\$[\s\S]*?\n\$\$;/u)?.[0];
    assert.ok(legacyPrecondition);
    const legacyProbePrecondition = legacyPrecondition.replaceAll(
      '"PostReport"',
      'pg_temp."LegacyPostReportProbe"',
    );
    const runLegacyProbe = (insertSql) => prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `CREATE TEMP TABLE "LegacyPostReportProbe" (
          "postId" TEXT NOT NULL DEFAULT 'probe-post',
          "status" TEXT NOT NULL,
          "reviewedAt" TIMESTAMP(3)
        ) ON COMMIT DROP`,
      );
      await tx.$executeRawUnsafe(insertSql);
      await tx.$executeRawUnsafe(legacyProbePrecondition);
    });

    await runLegacyProbe(
      `INSERT INTO "LegacyPostReportProbe" ("status", "reviewedAt")
       VALUES ('OPEN', NULL), ('OPEN', NULL)`,
    );
    await assert.rejects(
      () => runLegacyProbe(
        `INSERT INTO "LegacyPostReportProbe" ("status", "reviewedAt")
         VALUES ('OPEN', CURRENT_TIMESTAMP)`,
      ),
      /easygo_moderation_expand_requires_open_unreviewed_reports/u,
    );
    await assert.rejects(
      () => runLegacyProbe(
        `INSERT INTO "LegacyPostReportProbe" ("status", "reviewedAt")
         SELECT 'OPEN', NULL FROM generate_series(1, 251)`,
      ),
      /easygo_moderation_expand_pending_fanout_exceeds_250/u,
    );
    await assert.rejects(
      () => runLegacyProbe(
        `INSERT INTO "LegacyPostReportProbe" ("status", "reviewedAt")
         VALUES ('REVIEWING', NULL)`,
      ),
      /easygo_moderation_expand_requires_open_unreviewed_reports/u,
    );
    await assert.rejects(
      () => prisma.$executeRawUnsafe(legacyPrecondition),
      /easygo_moderation_expand_requires_open_unreviewed_reports/u,
    );

    const saturatedAdmission = response();
    await createPostReportHandler({
      db: prisma,
      now: () => new Date(now),
    })(postRequest({
      postId: postIds.action,
      privyDid: compatReporterDid,
      body: { reason: 'SPAM' },
    }), saturatedAdmission);
    assert.equal(saturatedAdmission.statusCode, 200);
    assert.deepEqual(saturatedAdmission.body, { reported: true, duplicate: true });
    assert.equal(await prisma.postReport.count({
      where: {
        postId: postIds.action,
        status: { in: ['OPEN', 'REVIEWING'] },
      },
    }), 250);

    const moderation = createModerationService({
      prisma,
      now: () => new Date(now),
      responseSlaHours: 24,
      policyVersion: 'moderation-pg-candidate-v1',
    });

    const claims = await Promise.allSettled([
      moderation.claim('reviewer-one', reportIds.claim, { expectedVersion: 0 }),
      moderation.claim('reviewer-two', reportIds.claim, { expectedVersion: 0 }),
    ]);
    assert.equal(claims.filter(({ status }) => status === 'fulfilled').length, 1);
    assert.equal(claims.filter(({ status }) => status === 'rejected').length, 1);
    assert.equal(
      claims.find(({ status }) => status === 'rejected').reason.code,
      'report_not_open',
    );

    const actioned = await moderation.decide(
      'primary-reviewer',
      reportIds.action,
      { expectedVersion: 1, decision: 'REMOVE_POST', expectedPostRevision: 2 },
    );
    assert.equal(actioned.contentChanged, true);
    assert.equal(actioned.affectedReportCount, 250);
    assert.equal(actioned.report.status, 'ACTIONED');
    assert.equal(actioned.audit.action, 'REMOVE_POST');
    assert.equal(actioned.audit.fromPostRevision, 2);
    assert.equal(actioned.audit.toPostRevision, 3);
    assert.match(actioned.audit.operationId, /^[0-9a-f-]{36}$/u);

    const [storedPost, actionedCount, actionAuditCount, revisionAuditCounts] = await Promise.all([
      prisma.post.findUnique({ where: { id: postIds.action } }),
      prisma.postReport.count({
        where: {
          postId: postIds.action,
          status: 'ACTIONED',
          resolution: 'CONTENT_REMOVED',
        },
      }),
      prisma.postReportAudit.count({
        where: { report: { postId: postIds.action }, action: 'REMOVE_POST' },
      }),
      prisma.postReportAudit.groupBy({
        by: ['fromPostRevision'],
        where: { report: { postId: postIds.action }, action: 'REMOVE_POST' },
        _count: { _all: true },
      }),
    ]);
    assert.equal(storedPost.authorId, null);
    assert.equal(storedPost.body, '');
    assert.equal(storedPost.mediaUrl, null);
    assert.deepEqual(storedPost.deletedAt, now);
    assert.equal(storedPost.contentRevision, 3);
    assert.equal(actionedCount, 250);
    assert.equal(actionAuditCount, 250);
    assert.deepEqual(
      revisionAuditCounts.map(({ fromPostRevision }) => fromPostRevision).sort(),
      [0, 1, 2],
    );

    const unavailable = await moderation.claim(
      'primary-reviewer',
      reportIds.unavailable,
      { expectedVersion: 0 },
    );
    assert.equal(unavailable.report.status, 'ACTIONED');
    assert.equal(unavailable.report.resolution, 'CONTENT_UNAVAILABLE');
    assert.equal(unavailable.affectedReportCount, 3);
    assert.equal(unavailable.audit.toPostRevision, 2);
    assert.equal(await prisma.postReport.count({
      where: {
        postId: postIds.unavailable,
        status: 'ACTIONED',
        resolution: 'CONTENT_UNAVAILABLE',
      },
    }), 3);

    const dismissed = await moderation.decide(
      'primary-reviewer',
      reportIds.dismiss,
      { expectedVersion: 1, decision: 'DISMISS', expectedPostRevision: 0 },
    );
    assert.equal(dismissed.affectedReportCount, 1);
    assert.equal(dismissed.report.status, 'DISMISSED');
    const dismissSiblings = await prisma.postReport.findMany({
      where: { id: { in: [reportIds.dismissOpen, reportIds.dismissOther] } },
      orderBy: { id: 'asc' },
    });
    assert.equal(dismissSiblings.find(({ id }) => id === reportIds.dismissOpen).status, 'OPEN');
    const otherReview = dismissSiblings.find(({ id }) => id === reportIds.dismissOther);
    assert.equal(otherReview.status, 'REVIEWING');
    assert.equal(otherReview.reviewerKeyId, 'other-reviewer');
    assert.equal(otherReview.version, 4);

    const update = createUpdatePostHandler({ db: prisma, shape: async (row) => row });
    const editResponse = response();
    await update(postRequest({
      postId: postIds.stale,
      privyDid: authorDid,
      body: { body: 'edited after claim' },
    }), editResponse);
    assert.equal(editResponse.statusCode, 200);
    const rebased = await moderation.decide(
      'primary-reviewer',
      reportIds.stale,
      { expectedVersion: 1, decision: 'DISMISS', expectedPostRevision: 0 },
    );
    assert.equal(rebased.reviewRequired, true);
    assert.equal(rebased.report.status, 'REVIEWING');
    assert.equal(rebased.report.version, 2);
    assert.equal(rebased.report.content.body, 'edited after claim');
    assert.equal(rebased.audit.action, 'REBASE_REVISION');

    let releaseModeration;
    const moderationHold = new Promise((resolve) => { releaseModeration = resolve; });
    let moderationLocked;
    const moderationLockedPromise = new Promise((resolve) => { moderationLocked = resolve; });
    let paused = false;
    const pausedPrisma = {
      $transaction: (callback) => prisma.$transaction(async (tx) => {
        const proxy = new Proxy(tx, {
          get(target, property, receiver) {
            if (property === '$queryRawUnsafe') {
              return async (sql, ...values) => {
                const result = await target.$queryRawUnsafe(sql, ...values);
                if (!paused && sql.includes('pg_advisory_xact_lock')) {
                  paused = true;
                  moderationLocked();
                  await moderationHold;
                }
                return result;
              };
            }
            const value = Reflect.get(target, property, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
        return callback(proxy);
      }),
    };
    const pausedModeration = createModerationService({
      prisma: pausedPrisma,
      now: () => new Date(now),
      responseSlaHours: 24,
      policyVersion: 'moderation-pg-candidate-v1',
    });
    let editQueryStarted;
    const editQueryStartedPromise = new Promise((resolve) => { editQueryStarted = resolve; });
    const editDb = {
      user: editPrisma.user,
      $transaction: (callback) => editPrisma.$transaction(async (tx) => {
        const proxy = new Proxy(tx, {
          get(target, property, receiver) {
            if (property === '$queryRawUnsafe') {
              return (sql, ...values) => {
                const pending = target.$queryRawUnsafe(sql, ...values);
                if (sql.includes('pg_advisory_xact_lock')) editQueryStarted();
                return pending;
              };
            }
            const value = Reflect.get(target, property, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
        return callback(proxy);
      }),
    };
    const raceRemove = pausedModeration.decide(
      'primary-reviewer',
      reportIds.race,
      { expectedVersion: 1, decision: 'REMOVE_POST', expectedPostRevision: 0 },
    );
    await moderationLockedPromise;
    const raceEditResponse = response();
    const raceEdit = createUpdatePostHandler({
      db: editDb,
      shape: async (row) => row,
    })(postRequest({
      postId: postIds.race,
      privyDid: authorDid,
      body: { body: 'attempted resurrection' },
    }), raceEditResponse);
    await editQueryStartedPromise;
    releaseModeration();
    const raceAction = await raceRemove;
    await raceEdit;
    assert.equal(raceAction.report.status, 'ACTIONED');
    assert.equal(raceEditResponse.statusCode, 403);
    assert.deepEqual(raceEditResponse.body, { error: 'forbidden' });
    const racePost = await prisma.post.findUnique({ where: { id: postIds.race } });
    assert.equal(racePost.authorId, null);
    assert.equal(racePost.body, '');
    assert.equal(racePost.mediaUrl, null);
    assert.equal(racePost.contentRevision, 1);

    const reportRoute = createPostReportHandler({ db: prisma, now: () => new Date(now) });
    const firstReportResponse = response();
    await reportRoute(postRequest({
      postId: postIds.compat,
      privyDid: compatReporterDid,
      body: { reason: 'SPAM' },
    }), firstReportResponse);
    assert.equal(firstReportResponse.statusCode, 201);
    await prisma.post.update({
      where: { id: postIds.compat },
      data: { body: 'expand revision one', contentRevision: { increment: 1 } },
    });
    const legacyConflictResponse = response();
    await reportRoute(postRequest({
      postId: postIds.compat,
      privyDid: compatReporterDid,
      body: { reason: 'SCAM_FRAUD' },
    }), legacyConflictResponse);
    assert.equal(legacyConflictResponse.statusCode, 200);
    assert.deepEqual(legacyConflictResponse.body, { reported: true, duplicate: true });

    const retentionClaim = await moderation.claim(
      'primary-reviewer',
      reportIds.retention,
      { expectedVersion: 0 },
    );
    await moderation.decide(
      'primary-reviewer',
      reportIds.retention,
      {
        expectedVersion: retentionClaim.report.version,
        decision: 'DISMISS',
        expectedPostRevision: 0,
      },
    );
    const retentionAuditCount = await prisma.postReportAudit.count({
      where: { reportId: reportIds.retention },
    });
    await prisma.user.delete({ where: { id: retentionReporterId } });
    const retainedReport = await prisma.postReport.findUnique({
      where: { id: reportIds.retention },
    });
    assert.ok(retainedReport);
    assert.equal(retainedReport.reporterId, null);
    assert.equal(await prisma.postReportAudit.count({
      where: { reportId: reportIds.retention },
    }), retentionAuditCount);
  } finally {
    await prisma.post.deleteMany({
      where: { id: { in: Object.values(postIds) } },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    }).catch(() => {});
    await Promise.all([prisma.$disconnect(), editPrisma.$disconnect()]);
  }
});
