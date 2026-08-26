import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PENDING_REPORTS_PER_POST_MAX } from './moderation-limits.js';

const REPORT_STATUSES = ['OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED'];
const TERMINAL_STATUSES = new Set(['ACTIONED', 'DISMISSED']);
const DECISIONS = ['REMOVE_POST', 'DISMISS'];
const POST_LOCK_SQL = (
  'SELECT pg_advisory_xact_lock(hashtextextended($1, 0)) IS NULL AS "lockAcquired"'
);
const POST_ROW_LOCK_SQL = 'SELECT "id" FROM "Post" WHERE "id" = $1 FOR UPDATE';
const TRANSITION_PENDING_REPORTS_SQL = `
  WITH pending AS (
    SELECT
      "id",
      "status" AS "fromStatus",
      "version" AS "fromVersion",
      "postRevision" AS "fromPostRevision"
    FROM "PostReport"
    WHERE "postId" = $1
      AND "status" IN ('OPEN'::"PostReportStatus", 'REVIEWING'::"PostReportStatus")
    FOR UPDATE
  ), updated AS (
    UPDATE "PostReport" AS report
    SET
      "status" = 'ACTIONED'::"PostReportStatus",
      "reviewerKeyId" = $2,
      "claimedAt" = COALESCE(report."claimedAt", $3),
      "reviewedAt" = $3,
      "resolution" = $6::"PostReportResolution",
      "version" = report."version" + 1,
      "updatedAt" = $3
    FROM pending
    WHERE report."id" = pending."id"
      AND report."status" = pending."fromStatus"
      AND report."version" = pending."fromVersion"
    RETURNING report."id", report."version" AS "toVersion"
  ), audited AS (
    INSERT INTO "PostReportAudit" (
      "reportId",
      "reviewerKeyId",
      "policyVersion",
      "action",
      "fromStatus",
      "toStatus",
      "fromVersion",
      "toVersion",
      "operationId",
      "fromPostRevision",
      "toPostRevision",
      "createdAt"
    )
    SELECT
      updated."id",
      $2,
      $4,
      $7::"PostReportAuditAction",
      pending."fromStatus",
      'ACTIONED'::"PostReportStatus",
      pending."fromVersion",
      updated."toVersion",
      $5::uuid,
      pending."fromPostRevision",
      $9,
      $3
    FROM updated
    JOIN pending ON pending."id" = updated."id"
    RETURNING "reportId"
  )
  SELECT
    (SELECT COUNT(*)::integer FROM pending) AS "pendingCount",
    (SELECT COUNT(*)::integer FROM updated) AS "updatedCount",
    (SELECT COUNT(*)::integer FROM audited) AS "auditCount",
    EXISTS(SELECT 1 FROM updated WHERE "id" = $8) AS "currentUpdated",
    (SELECT "toVersion" FROM updated WHERE "id" = $8) AS "currentToVersion"
`;

const reportIdSchema = z.string().min(1).max(100);
const expectedVersionSchema = z.object({
  expectedVersion: z.number().int().min(0).max(2_147_483_647),
}).strict();
const decisionSchema = expectedVersionSchema.extend({
  decision: z.enum(DECISIONS),
  expectedPostRevision: z.number().int().min(0).max(2_147_483_647),
}).strict();
const listLimitSchema = z.preprocess((value) => {
  if (typeof value === 'string' && /^\d+$/u.test(value)) return Number(value);
  return value;
}, z.number().int().min(1).max(50));
const listSchema = z.object({
  status: z.enum(REPORT_STATUSES).optional().default('OPEN'),
  cursor: z.string().min(1).max(1_000).regex(/^[A-Za-z0-9_-]+$/u).optional(),
  limit: listLimitSchema.optional().default(20),
}).strict();

const AUDIT_RECEIPT_SELECT = {
  reportId: true,
  operationId: true,
  policyVersion: true,
  action: true,
  fromStatus: true,
  toStatus: true,
  fromVersion: true,
  toVersion: true,
  fromPostRevision: true,
  toPostRevision: true,
  createdAt: true,
};

const REPORT_SELECT = {
  id: true,
  postId: true,
  reason: true,
  postRevision: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  claimedAt: true,
  reviewedAt: true,
  reviewerKeyId: true,
  version: true,
  resolution: true,
};

const REPORT_DETAIL_SELECT = {
  ...REPORT_SELECT,
  reporterId: true,
  post: {
    select: {
      body: true,
      mediaUrl: true,
      deletedAt: true,
      updatedAt: true,
      authorId: true,
      contentRevision: true,
    },
  },
};

export class ModerationError extends Error {
  constructor(code, { status = 400, cause } = {}) {
    super(code, cause ? { cause } : undefined);
    this.name = 'ModerationError';
    this.code = code;
    this.status = status;
  }
}

function parse(schema, value, code = 'bad_input') {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ModerationError(code, { status: 400, cause: error });
    }
    throw error;
  }
}

function encodeCursor(report) {
  return Buffer.from(
    JSON.stringify([report.createdAt.toISOString(), report.id]),
    'utf8',
  ).toString('base64url');
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!Array.isArray(decoded) || decoded.length !== 2) throw new Error('shape');
    const [createdAtValue, idValue] = decoded;
    const createdAt = new Date(createdAtValue);
    if (
      typeof createdAtValue !== 'string'
      || !Number.isFinite(createdAt.getTime())
      || createdAt.toISOString() !== createdAtValue
      || !reportIdSchema.safeParse(idValue).success
    ) throw new Error('value');
    return { createdAt, id: idValue };
  } catch (error) {
    throw new ModerationError('invalid_cursor', { status: 400, cause: error });
  }
}

function auditReceipt(audit) {
  if (!audit) {
    throw new ModerationError('audit_receipt_missing', { status: 500 });
  }
  return {
    operationId: audit.operationId,
    reportId: audit.reportId,
    policyVersion: audit.policyVersion,
    action: audit.action,
    fromStatus: audit.fromStatus,
    toStatus: audit.toStatus,
    fromVersion: audit.fromVersion,
    toVersion: audit.toVersion,
    fromPostRevision: audit.fromPostRevision,
    toPostRevision: audit.toPostRevision,
    serverTimestamp: audit.createdAt,
  };
}

function slaFields(report, now, responseSlaHours) {
  const dueAt = new Date(
    report.createdAt.getTime() + responseSlaHours * 60 * 60 * 1_000,
  );
  return {
    dueAt,
    overdue: !TERMINAL_STATUSES.has(report.status) && now > dueAt,
  };
}

function visibleContent(report, moderatorKeyId) {
  if (
    report.status !== 'REVIEWING'
    || report.reviewerKeyId !== moderatorKeyId
    || !report.post
    || report.post.deletedAt
    || report.postRevision !== report.post.contentRevision
  ) {
    return null;
  }
  return {
    body: report.post.body,
    mediaUrl: report.post.mediaUrl,
    revision: report.post.contentRevision,
  };
}

function publicReport(report, moderatorKeyId, now, responseSlaHours) {
  const assignedReview = (
    report.status === 'REVIEWING'
    && report.reviewerKeyId === moderatorKeyId
    && report.post
    && !report.post.deletedAt
    && report.postRevision === report.post.contentRevision
  );
  return {
    id: report.id,
    // Post IDs are public feed locators. Revealing one before claim would let
    // a moderator bypass ownership/audit by opening the unauthenticated post
    // route directly, so it is disclosed only with assigned review content.
    postId: assignedReview ? report.postId : null,
    reason: report.reason,
    status: report.status,
    resolution: report.resolution,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    claimedAt: report.claimedAt,
    reviewedAt: report.reviewedAt,
    version: report.version,
    assignedToMe: report.reviewerKeyId === moderatorKeyId,
    reviewerAssigned: Boolean(report.reviewerKeyId),
    ...slaFields(report, now, responseSlaHours),
    content: visibleContent(report, moderatorKeyId),
  };
}

async function lockAndReadReport(tx, reportId) {
  const location = await tx.postReport.findUnique({
    where: { id: reportId },
    select: { postId: true },
  });
  if (!location) throw new ModerationError('report_not_found', { status: 404 });

  await tx.$queryRawUnsafe(POST_LOCK_SQL, `post-report-target:${location.postId}`);
  await tx.$queryRawUnsafe(POST_ROW_LOCK_SQL, location.postId);
  const report = await tx.postReport.findUnique({
    where: { id: reportId },
    select: REPORT_DETAIL_SELECT,
  });
  if (!report) throw new ModerationError('report_not_found', { status: 404 });
  return report;
}

async function createAudit(tx, {
  reportId,
  moderatorKeyId,
  policyVersion,
  action,
  fromStatus,
  toStatus,
  fromVersion,
  operationId,
  fromPostRevision,
  toPostRevision = fromPostRevision,
}) {
  const audit = await tx.postReportAudit.create({
    data: {
      reportId,
      reviewerKeyId: moderatorKeyId,
      policyVersion,
      action,
      fromStatus,
      toStatus,
      fromVersion,
      toVersion: fromVersion + 1,
      operationId,
      fromPostRevision,
      toPostRevision,
    },
    select: AUDIT_RECEIPT_SELECT,
  });
  return auditReceipt(audit);
}

export function createModerationService({
  prisma,
  now = () => new Date(),
  responseSlaHours = 24,
  policyVersion = 'unapproved',
  newOperationId = randomUUID,
} = {}) {
  if (!prisma) throw new Error('prisma is required');
  if (!Number.isInteger(responseSlaHours) || responseSlaHours < 1 || responseSlaHours > 168) {
    throw new Error('responseSlaHours must be an integer from 1 to 168');
  }
  if (
    typeof policyVersion !== 'string'
    || !/^[A-Za-z0-9._:-]{1,64}$/u.test(policyVersion)
  ) {
    throw new Error('policyVersion must be 1 to 64 safe characters');
  }
  if (typeof newOperationId !== 'function') {
    throw new Error('newOperationId must be a function');
  }

  function createOperationId() {
    const operationId = newOperationId();
    if (!z.string().uuid().safeParse(operationId).success) {
      throw new Error('newOperationId must return a UUID');
    }
    return operationId;
  }

  async function transitionPendingReports(tx, {
    report,
    moderatorKeyId,
    currentTime,
    operationId,
    resolution,
    action,
    toPostRevision,
  }) {
    const fanoutProbe = await tx.postReport.findMany({
      where: {
        postId: report.postId,
        status: { in: ['OPEN', 'REVIEWING'] },
      },
      orderBy: [{ id: 'asc' }],
      take: PENDING_REPORTS_PER_POST_MAX + 1,
      select: { id: true },
    });
    if (fanoutProbe.length > PENDING_REPORTS_PER_POST_MAX) {
      throw new ModerationError('report_fanout_exceeded', { status: 503 });
    }
    const [fanout] = await tx.$queryRawUnsafe(
      TRANSITION_PENDING_REPORTS_SQL,
      report.postId,
      moderatorKeyId,
      currentTime,
      policyVersion,
      operationId,
      resolution,
      action,
      report.id,
      toPostRevision,
    );
    if (
      !fanout?.currentUpdated
      || fanout.pendingCount < 1
      || fanout.updatedCount !== fanout.pendingCount
      || fanout.auditCount !== fanout.pendingCount
      || !Number.isInteger(fanout.currentToVersion)
    ) {
      throw new ModerationError('report_state_conflict', { status: 409 });
    }

    const audit = await tx.postReportAudit.findUnique({
      where: {
        reportId_toVersion: {
          reportId: report.id,
          toVersion: fanout.currentToVersion,
        },
      },
      select: AUDIT_RECEIPT_SELECT,
    });
    if (audit?.operationId !== operationId || audit?.action !== action) {
      throw new ModerationError('audit_receipt_missing', { status: 500 });
    }
    return {
      affectedReportCount: fanout.updatedCount,
      audit: auditReceipt(audit),
    };
  }

  async function terminalizeUnreviewable(tx, {
    report,
    moderatorKeyId,
    currentTime,
    operationId,
  }) {
    if (!report.post) {
      throw new ModerationError('report_post_missing', { status: 409 });
    }
    if (report.post.deletedAt) {
      if (
        report.post.authorId !== null
        || report.post.body !== ''
        || report.post.mediaUrl !== null
      ) {
        const repaired = await tx.post.updateMany({
          where: {
            id: report.postId,
            deletedAt: report.post.deletedAt,
            contentRevision: report.post.contentRevision,
          },
          data: {
            authorId: null,
            body: '',
            mediaUrl: null,
            contentRevision: { increment: 1 },
            updatedAt: currentTime,
          },
        });
        if (repaired.count !== 1) {
          throw new ModerationError('post_redaction_conflict', { status: 409 });
        }
        report.post.authorId = null;
        report.post.body = '';
        report.post.mediaUrl = null;
        report.post.contentRevision += 1;
        report.post.updatedAt = currentTime;
      }
      return transitionPendingReports(tx, {
        report,
        moderatorKeyId,
        currentTime,
        operationId,
        resolution: 'CONTENT_UNAVAILABLE',
        action: 'CLOSE_UNAVAILABLE',
        toPostRevision: report.post.contentRevision,
      });
    }
    return null;
  }

  async function findLinkedRevisionReport(tx, report, postRevision) {
    if (!report.reporterId) return null;
    return tx.postReport.findFirst({
      where: {
        postId: report.postId,
        reporterId: report.reporterId,
        postRevision,
      },
      select: { id: true, status: true },
    });
  }

  async function closeSupersededReport(tx, {
    report,
    moderatorKeyId,
    currentTime,
    operationId,
    replacementRevision,
  }) {
    const updated = await tx.postReport.updateMany({
      where: {
        id: report.id,
        status: report.status,
        version: report.version,
        postRevision: report.postRevision,
      },
      data: {
        status: 'ACTIONED',
        reviewerKeyId: moderatorKeyId,
        claimedAt: report.claimedAt || currentTime,
        reviewedAt: currentTime,
        resolution: 'CONTENT_SUPERSEDED',
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ModerationError('stale_report_version', { status: 409 });
    }
    const audit = await createAudit(tx, {
      reportId: report.id,
      moderatorKeyId,
      policyVersion,
      action: 'CLOSE_SUPERSEDED',
      fromStatus: report.status,
      toStatus: 'ACTIONED',
      fromVersion: report.version,
      operationId,
      fromPostRevision: report.postRevision,
      toPostRevision: replacementRevision,
    });
    const actioned = await tx.postReport.findUnique({
      where: { id: report.id },
      select: REPORT_DETAIL_SELECT,
    });
    return {
      report: actioned,
      audit,
      contentChanged: false,
      reviewRequired: true,
    };
  }

  async function list(moderatorKeyId, input = {}) {
    const query = parse(listSchema, input, 'invalid_query');
    const cursor = decodeCursor(query.cursor);
    const reports = await prisma.postReport.findMany({
      where: {
        status: query.status,
        ...(cursor ? {
          OR: [
            { createdAt: { gt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { gt: cursor.id } },
          ],
        } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      select: REPORT_SELECT,
    });

    const hasNextPage = reports.length > query.limit;
    const page = hasNextPage ? reports.slice(0, query.limit) : reports;
    const assignedPostIds = [...new Set(page
      .filter((report) => (
        report.status === 'REVIEWING' && report.reviewerKeyId === moderatorKeyId
      ))
      .map((report) => report.postId))];
    const assignedPosts = assignedPostIds.length
      ? await prisma.post.findMany({
          where: { id: { in: assignedPostIds } },
          select: {
            id: true,
            body: true,
            mediaUrl: true,
            deletedAt: true,
            updatedAt: true,
            authorId: true,
            contentRevision: true,
          },
        })
      : [];
    const postById = new Map(assignedPosts.map((post) => [post.id, post]));
    const currentTime = now();
    const hydrated = page.map((report) => ({
      ...report,
      post: postById.get(report.postId) || null,
    }));

    return {
      reports: hydrated.map((report) => (
        publicReport(report, moderatorKeyId, currentTime, responseSlaHours)
      )),
      nextCursor: hasNextPage ? encodeCursor(page.at(-1)) : null,
    };
  }

  async function claim(moderatorKeyId, reportIdInput, input) {
    const reportId = parse(reportIdSchema, reportIdInput, 'invalid_report_id');
    const { expectedVersion } = parse(expectedVersionSchema, input);
    const currentTime = now();
    const operationId = createOperationId();

    const result = await prisma.$transaction(async (tx) => {
      const report = await lockAndReadReport(tx, reportId);
      if (report.status !== 'OPEN') {
        throw new ModerationError('report_not_open', { status: 409 });
      }
      if (report.version !== expectedVersion) {
        throw new ModerationError('stale_report_version', { status: 409 });
      }

      const terminalTransition = await terminalizeUnreviewable(tx, {
        report,
        moderatorKeyId,
        currentTime,
        operationId,
      });
      if (terminalTransition) {
        const actioned = await tx.postReport.findUnique({
          where: { id: report.id },
          select: REPORT_DETAIL_SELECT,
        });
        return {
          report: actioned,
          contentChanged: false,
          ...terminalTransition,
        };
      }

      const currentPostRevision = report.post.contentRevision;
      if (report.postRevision !== currentPostRevision) {
        const linked = await findLinkedRevisionReport(tx, report, currentPostRevision);
        if (linked) {
          return closeSupersededReport(tx, {
            report,
            moderatorKeyId,
            currentTime,
            operationId,
            replacementRevision: currentPostRevision,
          });
        }
      }

      const updated = await tx.postReport.updateMany({
        where: {
          id: report.id,
          status: 'OPEN',
          reviewerKeyId: null,
          version: expectedVersion,
          postRevision: report.postRevision,
        },
        data: {
          status: 'REVIEWING',
          reviewerKeyId: moderatorKeyId,
          claimedAt: currentTime,
          postRevision: currentPostRevision,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ModerationError('stale_report_version', { status: 409 });
      }
      const audit = await createAudit(tx, {
        reportId: report.id,
        moderatorKeyId,
        policyVersion,
        action: 'CLAIM',
        fromStatus: 'OPEN',
        toStatus: 'REVIEWING',
        fromVersion: report.version,
        operationId,
        fromPostRevision: report.postRevision,
        toPostRevision: currentPostRevision,
      });
      const claimed = await tx.postReport.findUnique({
        where: { id: report.id },
        select: REPORT_DETAIL_SELECT,
      });
      return { report: claimed, audit };
    });

    return {
      ...result,
      report: publicReport(result.report, moderatorKeyId, currentTime, responseSlaHours),
    };
  }

  async function decide(moderatorKeyId, reportIdInput, input) {
    const reportId = parse(reportIdSchema, reportIdInput, 'invalid_report_id');
    const { expectedVersion, decision, expectedPostRevision } = parse(decisionSchema, input);
    const currentTime = now();
    const operationId = createOperationId();

    return prisma.$transaction(async (tx) => {
      const report = await lockAndReadReport(tx, reportId);
      if (report.status !== 'REVIEWING') {
        throw new ModerationError('report_not_reviewing', { status: 409 });
      }
      if (report.reviewerKeyId !== moderatorKeyId) {
        throw new ModerationError('report_assigned_elsewhere', { status: 403 });
      }
      if (report.version !== expectedVersion) {
        throw new ModerationError('stale_report_version', { status: 409 });
      }

      const terminalTransition = await terminalizeUnreviewable(tx, {
        report,
        moderatorKeyId,
        currentTime,
        operationId,
      });
      if (terminalTransition) {
        const actioned = await tx.postReport.findUnique({
          where: { id: report.id },
          select: REPORT_DETAIL_SELECT,
        });
        return {
          report: publicReport(actioned, moderatorKeyId, currentTime, responseSlaHours),
          contentChanged: false,
          ...terminalTransition,
        };
      }
      if (report.postRevision !== report.post.contentRevision) {
        const linked = await findLinkedRevisionReport(
          tx,
          report,
          report.post.contentRevision,
        );
        if (linked) {
          const superseded = await closeSupersededReport(tx, {
            report,
            moderatorKeyId,
            currentTime,
            operationId,
            replacementRevision: report.post.contentRevision,
          });
          return {
            ...superseded,
            report: publicReport(
              superseded.report,
              moderatorKeyId,
              currentTime,
              responseSlaHours,
            ),
          };
        }

        const rebased = await tx.postReport.updateMany({
          where: {
            id: report.id,
            status: 'REVIEWING',
            reviewerKeyId: moderatorKeyId,
            version: expectedVersion,
            postRevision: report.postRevision,
          },
          data: {
            postRevision: report.post.contentRevision,
            version: { increment: 1 },
          },
        });
        if (rebased.count !== 1) {
          throw new ModerationError('stale_report_version', { status: 409 });
        }
        const audit = await createAudit(tx, {
          reportId: report.id,
          moderatorKeyId,
          policyVersion,
          action: 'REBASE_REVISION',
          fromStatus: 'REVIEWING',
          toStatus: 'REVIEWING',
          fromVersion: report.version,
          operationId,
          fromPostRevision: report.postRevision,
          toPostRevision: report.post.contentRevision,
        });
        const current = await tx.postReport.findUnique({
          where: { id: report.id },
          select: REPORT_DETAIL_SELECT,
        });
        return {
          report: publicReport(current, moderatorKeyId, currentTime, responseSlaHours),
          contentChanged: false,
          reviewRequired: true,
          audit,
        };
      }
      if (report.post.contentRevision !== expectedPostRevision) {
        throw new ModerationError('stale_post_revision', { status: 409 });
      }

      if (decision === 'DISMISS') {
        const updated = await tx.postReport.updateMany({
          where: {
            id: report.id,
            status: 'REVIEWING',
            reviewerKeyId: moderatorKeyId,
            version: expectedVersion,
            postRevision: expectedPostRevision,
          },
          data: {
            status: 'DISMISSED',
            reviewedAt: currentTime,
            resolution: 'NO_VIOLATION',
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ModerationError('report_state_conflict', { status: 409 });
        }
        const audit = await createAudit(tx, {
          reportId: report.id,
          moderatorKeyId,
          policyVersion,
          action: 'DISMISS',
          fromStatus: 'REVIEWING',
          toStatus: 'DISMISSED',
          fromVersion: report.version,
          operationId,
          fromPostRevision: report.postRevision,
          toPostRevision: report.postRevision,
        });
        const dismissed = await tx.postReport.findUnique({
          where: { id: report.id },
          select: REPORT_DETAIL_SELECT,
        });
        return {
          report: publicReport(dismissed, moderatorKeyId, currentTime, responseSlaHours),
          contentChanged: false,
          affectedReportCount: 1,
          audit,
        };
      }

      const redacted = await tx.post.updateMany({
        where: {
          id: report.postId,
          deletedAt: null,
          contentRevision: expectedPostRevision,
        },
        data: {
          authorId: null,
          body: '',
          mediaUrl: null,
          deletedAt: currentTime,
          contentRevision: { increment: 1 },
        },
      });
      if (redacted.count !== 1) {
        throw new ModerationError('post_not_actionable', { status: 409 });
      }
      const transition = await transitionPendingReports(tx, {
        report,
        moderatorKeyId,
        currentTime,
        operationId,
        resolution: 'CONTENT_REMOVED',
        action: 'REMOVE_POST',
        toPostRevision: expectedPostRevision + 1,
      });

      const actioned = await tx.postReport.findUnique({
        where: { id: report.id },
        select: REPORT_DETAIL_SELECT,
      });
      return {
        report: publicReport(actioned, moderatorKeyId, currentTime, responseSlaHours),
        contentChanged: true,
        ...transition,
      };
    });
  }

  return { claim, decide, list };
}

export const MODERATION_REPORT_STATUSES = Object.freeze([...REPORT_STATUSES]);
export const MODERATION_DECISIONS = Object.freeze([...DECISIONS]);
