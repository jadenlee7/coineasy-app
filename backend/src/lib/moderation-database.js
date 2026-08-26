const MODERATION_MIGRATION = '20260826144000_moderation_queue';

export const MODERATION_DATABASE_CONTRACT_SQL = `
SELECT COALESCE(
  EXISTS (
    SELECT 1
    FROM "_prisma_migrations"
    WHERE migration_name = '${MODERATION_MIGRATION}'
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Post'
      AND column_name = 'contentRevision'
      AND data_type = 'integer'
      AND column_default LIKE '0%'
  )
  AND (
    SELECT COUNT(*) = 6
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'PostReport'
      AND column_name IN (
        'reporterId',
        'postRevision',
        'reviewerKeyId',
        'claimedAt',
        'version',
        'resolution'
      )
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'PostReport'
      AND column_name = 'reporterId'
      AND is_nullable = 'YES'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'PostReport'
      AND column_name = 'postRevision'
      AND data_type = 'integer'
      AND column_default LIKE '0%'
  )
  AND (
    SELECT COUNT(*) = 12
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'PostReportAudit'
      AND column_name IN (
        'reportId',
        'reviewerKeyId',
        'policyVersion',
        'action',
        'fromStatus',
        'toStatus',
        'fromVersion',
        'toVersion',
        'operationId',
        'fromPostRevision',
        'toPostRevision',
        'createdAt'
      )
  )
  AND COALESCE((
    SELECT array_agg(enum_value.enumlabel::text ORDER BY enum_value.enumsortorder)
      = ARRAY[
        'CONTENT_REMOVED',
        'CONTENT_UNAVAILABLE',
        'CONTENT_SUPERSEDED',
        'NO_VIOLATION'
      ]::text[]
    FROM pg_type enum_type
    JOIN pg_enum enum_value ON enum_value.enumtypid = enum_type.oid
    JOIN pg_namespace namespace ON namespace.oid = enum_type.typnamespace
    WHERE namespace.nspname = current_schema()
      AND enum_type.typname = 'PostReportResolution'
  ), false)
  AND COALESCE((
    SELECT array_agg(enum_value.enumlabel::text ORDER BY enum_value.enumsortorder)
      = ARRAY[
        'CLAIM',
        'REMOVE_POST',
        'CLOSE_UNAVAILABLE',
        'CLOSE_SUPERSEDED',
        'REBASE_REVISION',
        'DISMISS'
      ]::text[]
    FROM pg_type enum_type
    JOIN pg_enum enum_value ON enum_value.enumtypid = enum_type.oid
    JOIN pg_namespace namespace ON namespace.oid = enum_type.typnamespace
    WHERE namespace.nspname = current_schema()
      AND enum_type.typname = 'PostReportAuditAction'
  ), false)
  AND (
    SELECT COUNT(*) = 9
    FROM pg_constraint constraint_row
    JOIN pg_class relation ON relation.oid = constraint_row.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = current_schema()
      AND constraint_row.conname IN (
        'Post_content_revision_nonnegative_check',
        'PostReport_version_nonnegative_check',
        'PostReport_post_revision_nonnegative_check',
        'PostReport_state_consistency_check',
        'PostReport_reporterId_fkey',
        'PostReportAudit_pkey',
        'PostReportAudit_version_transition_check',
        'PostReportAudit_post_revision_nonnegative_check',
        'PostReportAudit_reportId_fkey'
      )
  )
  AND EXISTS (
    SELECT 1
    FROM pg_constraint constraint_row
    JOIN pg_class relation ON relation.oid = constraint_row.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = current_schema()
      AND relation.relname = 'PostReport'
      AND constraint_row.conname = 'PostReport_reporterId_fkey'
      AND constraint_row.contype = 'f'
      AND constraint_row.confdeltype = 'n'
      AND constraint_row.confupdtype = 'c'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_constraint constraint_row
    JOIN pg_class relation ON relation.oid = constraint_row.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = current_schema()
      AND relation.relname = 'PostReportAudit'
      AND constraint_row.conname = 'PostReportAudit_reportId_fkey'
      AND constraint_row.contype = 'f'
      AND constraint_row.confdeltype = 'c'
      AND constraint_row.confupdtype = 'c'
  )
  AND COALESCE((
    SELECT COUNT(*) = 10
      AND BOOL_AND(index_row.indisvalid)
      AND BOOL_AND(index_row.indisready)
      AND COUNT(*) FILTER (
        WHERE index_relation.relname IN (
          'uniq_post_report_reporter',
          'uniq_post_report_reporter_revision'
        )
          AND index_row.indisunique
      ) = 2
    FROM pg_index index_row
    JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
    JOIN pg_namespace namespace ON namespace.oid = index_relation.relnamespace
    WHERE namespace.nspname = current_schema()
      AND index_relation.relname IN (
        'uniq_post_report_reporter',
        'uniq_post_report_reporter_revision',
        'idx_post_report_queue_v2',
        'idx_post_report_revision_state',
        'idx_post_report_pending',
        'idx_post_report_reporter',
        'PostReportAudit_pkey',
        'idx_post_report_audit_report',
        'idx_post_report_audit_reviewer',
        'idx_post_report_audit_operation'
      )
  ), false),
  false
) AS "contractReady"
`;

export class ModerationDatabaseContractError extends Error {
  constructor() {
    super('moderation database contract is unavailable');
    this.name = 'ModerationDatabaseContractError';
  }
}

export async function verifyModerationDatabaseContract(db) {
  const result = await db.$queryRawUnsafe(MODERATION_DATABASE_CONTRACT_SQL);
  if (!Array.isArray(result) || result.length !== 1 || result[0]?.contractReady !== true) {
    throw new ModerationDatabaseContractError();
  }
  return true;
}
