-- Add a fail-closed reviewer workflow to the existing post-report queue.
-- Reviewer keys are represented only by stable, opaque key identifiers; raw
-- credentials and reporter identity are intentionally absent from the audit.

-- Legacy moderation statuses did not capture an actor, claim, or resolution.
-- Do not invent that evidence during migration. Refuse the expand migration
-- until the operator has proved the existing queue is entirely truthful OPEN
-- state (or obtained a separately approved remediation contract).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PostReport"
    WHERE "status" <> 'OPEN' OR "reviewedAt" IS NOT NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'easygo_moderation_expand_requires_open_unreviewed_reports',
      HINT = 'Stop deployment and follow the approved legacy report remediation runbook.';
  END IF;

  IF EXISTS (
    SELECT "postId"
    FROM "PostReport"
    WHERE "status" IN ('OPEN', 'REVIEWING')
    GROUP BY "postId"
    HAVING COUNT(*) > 250
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'easygo_moderation_expand_pending_fanout_exceeds_250',
      HINT = 'Stop deployment and follow the approved legacy report remediation runbook.';
  END IF;
END
$$;

-- CreateEnum
CREATE TYPE "PostReportResolution" AS ENUM (
  'CONTENT_REMOVED',
  'CONTENT_UNAVAILABLE',
  'CONTENT_SUPERSEDED',
  'NO_VIOLATION'
);

-- CreateEnum
CREATE TYPE "PostReportAuditAction" AS ENUM (
  'CLAIM',
  'REMOVE_POST',
  'CLOSE_UNAVAILABLE',
  'CLOSE_SUPERSEDED',
  'REBASE_REVISION',
  'DISMISS'
);

-- AlterTable
ALTER TABLE "Post"
  ADD COLUMN "contentRevision" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "Post_content_revision_nonnegative_check"
    CHECK ("contentRevision" >= 0);

-- AlterTable
ALTER TABLE "PostReport"
  ADD COLUMN "postRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reviewerKeyId" VARCHAR(64),
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "resolution" "PostReportResolution";

ALTER TABLE "PostReport"
  ALTER COLUMN "reporterId" DROP NOT NULL,
  DROP CONSTRAINT "PostReport_reporterId_fkey",
  ADD CONSTRAINT "PostReport_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing rows are OPEN reports. This state-machine constraint also prevents
-- a terminal status from being stored without a matching resolution and
-- reviewer claim.
ALTER TABLE "PostReport"
  ADD CONSTRAINT "PostReport_version_nonnegative_check"
    CHECK ("version" >= 0),
  ADD CONSTRAINT "PostReport_post_revision_nonnegative_check"
    CHECK ("postRevision" >= 0),
  ADD CONSTRAINT "PostReport_state_consistency_check"
    CHECK (
      (
        "status" = 'OPEN'
        AND "reviewerKeyId" IS NULL
        AND "claimedAt" IS NULL
        AND "reviewedAt" IS NULL
        AND "resolution" IS NULL
      )
      OR (
        "status" = 'REVIEWING'
        AND "reviewerKeyId" IS NOT NULL
        AND "claimedAt" IS NOT NULL
        AND "reviewedAt" IS NULL
        AND "resolution" IS NULL
      )
      OR (
        "status" = 'ACTIONED'
        AND "reviewerKeyId" IS NOT NULL
        AND "claimedAt" IS NOT NULL
        AND "reviewedAt" IS NOT NULL
        AND "resolution" IS NOT NULL
        AND "resolution" IN (
          'CONTENT_REMOVED',
          'CONTENT_UNAVAILABLE',
          'CONTENT_SUPERSEDED'
        )
      )
      OR (
        "status" = 'DISMISSED'
        AND "reviewerKeyId" IS NOT NULL
        AND "claimedAt" IS NOT NULL
        AND "reviewedAt" IS NOT NULL
        AND "resolution" IS NOT NULL
        AND "resolution" = 'NO_VIOLATION'
      )
    );

-- CreateTable
CREATE TABLE "PostReportAudit" (
  "reportId" TEXT NOT NULL,
  "reviewerKeyId" VARCHAR(64) NOT NULL,
  "policyVersion" VARCHAR(64) NOT NULL,
  "action" "PostReportAuditAction" NOT NULL,
  "fromStatus" "PostReportStatus" NOT NULL,
  "toStatus" "PostReportStatus" NOT NULL,
  "fromVersion" INTEGER NOT NULL,
  "toVersion" INTEGER NOT NULL,
  "operationId" UUID NOT NULL,
  "fromPostRevision" INTEGER NOT NULL,
  "toPostRevision" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PostReportAudit_pkey" PRIMARY KEY ("reportId", "toVersion"),
  CONSTRAINT "PostReportAudit_version_transition_check"
    CHECK ("fromVersion" >= 0 AND "toVersion" = "fromVersion" + 1),
  CONSTRAINT "PostReportAudit_post_revision_nonnegative_check"
    CHECK ("fromPostRevision" >= 0 AND "toPostRevision" >= 0)
);

-- A reporter can report each immutable content revision once. A later author
-- edit increments Post.contentRevision and creates a fresh reportable unit.
CREATE UNIQUE INDEX "uniq_post_report_reporter_revision"
  ON "PostReport"("postId", "reporterId", "postRevision");

-- Expand phase only: retain the legacy two-column unique index so the current
-- release and a rollback release can still execute ON CONFLICT safely. A
-- separately approved contract migration may drop it only after every old
-- instance has drained and the new release has been verified.

-- Build the deterministic pagination index before retiring the redundant
-- two-column index, so a partial/manual execution never leaves the queue with
-- less index coverage than it had before this migration.
CREATE INDEX "idx_post_report_queue_v2"
  ON "PostReport"("status", "createdAt", "id");
DROP INDEX IF EXISTS "idx_post_report_queue";

-- CreateIndex
CREATE INDEX "idx_post_report_audit_report"
  ON "PostReportAudit"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_post_report_audit_reviewer"
  ON "PostReportAudit"("reviewerKeyId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_post_report_audit_operation"
  ON "PostReportAudit"("operationId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_post_report_revision_state"
  ON "PostReport"("postId", "postRevision", "status", "id");

-- Bound the admission count and all-revision terminal fan-out probe.
CREATE INDEX "idx_post_report_pending"
  ON "PostReport"("postId", "status", "id");

-- AddForeignKey
ALTER TABLE "PostReportAudit"
  ADD CONSTRAINT "PostReportAudit_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "PostReport"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
