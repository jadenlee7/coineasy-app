const MODERATION_RATE_LIMIT_MIGRATION = '20260827193000_moderation_rate_limit_gcra';
const DATABASE_TRANSACTION_MAX_WAIT_MS = 200;
const DATABASE_TRANSACTION_TIMEOUT_MS = 1_400;
const DATABASE_STATEMENT_TIMEOUT_MS = 1_000;
const DATABASE_LOCK_TIMEOUT_MS = 250;

export const MODERATION_RATE_LIMIT_DATABASE_TIMEOUTS_SQL = `
WITH "configured" AS MATERIALIZED (
  SELECT
    set_config('lock_timeout', '${DATABASE_LOCK_TIMEOUT_MS}ms', true),
    set_config('statement_timeout', '${DATABASE_STATEMENT_TIMEOUT_MS}ms', true),
    set_config(
      'idle_in_transaction_session_timeout',
      '${DATABASE_TRANSACTION_TIMEOUT_MS}ms',
      true
    )
)
SELECT
  (EXTRACT(EPOCH FROM current_setting('lock_timeout')::interval) * 1000)::integer
    AS "lockTimeoutMs",
  (EXTRACT(EPOCH FROM current_setting('statement_timeout')::interval) * 1000)::integer
    AS "statementTimeoutMs",
  (
    EXTRACT(EPOCH FROM current_setting(
      'idle_in_transaction_session_timeout'
    )::interval) * 1000
  )::integer AS "idleTimeoutMs"
FROM "configured"
`;

export const MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL = `
SELECT COALESCE(
  EXISTS (
    SELECT 1
    FROM "_prisma_migrations"
    WHERE migration_name = '${MODERATION_RATE_LIMIT_MIGRATION}'
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  )
  AND (
    SELECT COUNT(*) = 6
      AND COUNT(*) FILTER (WHERE
        (column_name = 'actorId'
          AND data_type = 'character varying'
          AND character_maximum_length = 64
          AND is_nullable = 'NO'
          AND column_default IS NULL)
        OR (column_name = 'scope'
          AND data_type = 'character varying'
          AND character_maximum_length = 32
          AND is_nullable = 'NO'
          AND column_default IS NULL)
        OR (column_name = 'policyVersion'
          AND data_type = 'character varying'
          AND character_maximum_length = 64
          AND is_nullable = 'NO'
          AND column_default IS NULL)
        OR (column_name = 'policyFingerprint'
          AND data_type = 'character'
          AND character_maximum_length = 64
          AND is_nullable = 'NO'
          AND column_default IS NULL)
        OR (column_name = 'theoreticalArrivalAt'
          AND data_type = 'timestamp with time zone'
          AND datetime_precision = 6
          AND is_nullable = 'NO'
          AND column_default IS NULL)
        OR (column_name = 'updatedAt'
          AND data_type = 'timestamp with time zone'
          AND datetime_precision = 6
          AND is_nullable = 'NO'
          AND column_default IS NULL)
      ) = 6
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'ModerationRateLimitBucket'
  )
  AND COALESCE((
    SELECT COUNT(*) = 5
      AND BOOL_AND(
        constraint_row.contype = 'c'
        AND constraint_row.convalidated
        AND regexp_replace(
          pg_get_constraintdef(constraint_row.oid, true),
          '[[:space:]]+',
          '',
          'g'
        ) = CASE constraint_row.conname
          WHEN 'ModerationRateLimitBucket_actor_format_check'
            THEN 'CHECK("actorId"::text~''^wf_[A-Za-z0-9_-]{22,60}$''::text)'
          WHEN 'ModerationRateLimitBucket_scope_check'
            THEN 'CHECK(scope::text=ANY(ARRAY[''queue.read''::charactervarying,''report.claim''::charactervarying,''report.decide''::charactervarying,''content.remove''::charactervarying]::text[]))'
          WHEN 'ModerationRateLimitBucket_policy_version_check'
            THEN 'CHECK("policyVersion"::text~''^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$''::text)'
          WHEN 'ModerationRateLimitBucket_policy_fingerprint_check'
            THEN 'CHECK("policyFingerprint"~''^[0-9a-f]{64}$''::text)'
          WHEN 'ModerationRateLimitBucket_time_order_check'
            THEN 'CHECK("theoreticalArrivalAt">="updatedAt")'
          ELSE ''
        END
      )
    FROM pg_constraint constraint_row
    JOIN pg_class relation ON relation.oid = constraint_row.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = current_schema()
      AND relation.relname = 'ModerationRateLimitBucket'
      AND constraint_row.conname IN (
        'ModerationRateLimitBucket_actor_format_check',
        'ModerationRateLimitBucket_scope_check',
        'ModerationRateLimitBucket_policy_version_check',
        'ModerationRateLimitBucket_policy_fingerprint_check',
        'ModerationRateLimitBucket_time_order_check'
      )
  ), false)
  AND (
    SELECT COUNT(*) = 6
      AND COUNT(*) FILTER (
        WHERE constraint_row.conname IN (
          'ModerationRateLimitBucket_pkey',
          'ModerationRateLimitBucket_actor_format_check',
          'ModerationRateLimitBucket_scope_check',
          'ModerationRateLimitBucket_policy_version_check',
          'ModerationRateLimitBucket_policy_fingerprint_check',
          'ModerationRateLimitBucket_time_order_check'
        )
      ) = 6
    FROM pg_constraint constraint_row
    JOIN pg_class relation ON relation.oid = constraint_row.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = current_schema()
      AND relation.relname = 'ModerationRateLimitBucket'
  )
  AND (
    SELECT COUNT(*) = 2
      AND COUNT(*) FILTER (
        WHERE index_relation.relname IN (
          'ModerationRateLimitBucket_pkey',
          'idx_moderation_rate_bucket_cleanup'
        )
      ) = 2
    FROM pg_index index_row
    JOIN pg_class relation ON relation.oid = index_row.indrelid
    JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = current_schema()
      AND relation.relname = 'ModerationRateLimitBucket'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_index index_row
    JOIN pg_class relation ON relation.oid = index_row.indrelid
    JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
    JOIN pg_am access_method ON access_method.oid = index_relation.relam
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN LATERAL (
      SELECT array_agg(attribute.attname ORDER BY key_column.ordinality) AS names
      FROM unnest(index_row.indkey) WITH ORDINALITY AS key_column(attnum, ordinality)
      JOIN pg_attribute attribute
        ON attribute.attrelid = relation.oid
       AND attribute.attnum = key_column.attnum
    ) key_columns ON true
    WHERE namespace.nspname = current_schema()
      AND relation.relname = 'ModerationRateLimitBucket'
      AND index_relation.relname = 'ModerationRateLimitBucket_pkey'
      AND index_row.indisprimary
      AND index_row.indisunique
      AND index_row.indisvalid
      AND index_row.indisready
      AND index_row.indnkeyatts = 2
      AND index_row.indnatts = 2
      AND index_row.indpred IS NULL
      AND index_row.indexprs IS NULL
      AND access_method.amname = 'btree'
      AND key_columns.names = ARRAY['actorId', 'scope']::name[]
  )
  AND EXISTS (
    SELECT 1
    FROM pg_index index_row
    JOIN pg_class relation ON relation.oid = index_row.indrelid
    JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
    JOIN pg_am access_method ON access_method.oid = index_relation.relam
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN LATERAL (
      SELECT array_agg(attribute.attname ORDER BY key_column.ordinality) AS names
      FROM unnest(index_row.indkey) WITH ORDINALITY AS key_column(attnum, ordinality)
      JOIN pg_attribute attribute
        ON attribute.attrelid = relation.oid
       AND attribute.attnum = key_column.attnum
    ) key_columns ON true
    WHERE namespace.nspname = current_schema()
      AND relation.relname = 'ModerationRateLimitBucket'
      AND index_relation.relname = 'idx_moderation_rate_bucket_cleanup'
      AND NOT index_row.indisunique
      AND index_row.indisvalid
      AND index_row.indisready
      AND index_row.indnkeyatts = 4
      AND index_row.indnatts = 4
      AND index_row.indpred IS NULL
      AND index_row.indexprs IS NULL
      AND access_method.amname = 'btree'
      AND key_columns.names = ARRAY[
        'updatedAt',
        'theoreticalArrivalAt',
        'actorId',
        'scope'
      ]::name[]
  )
  AND COALESCE(has_schema_privilege(
    current_user,
    current_schema(),
    'USAGE'
  ), false)
  AND COALESCE(has_table_privilege(
    current_user,
    to_regclass(format('%I.%I', current_schema(), 'ModerationRateLimitBucket')),
    'SELECT'
  ), false)
  AND COALESCE(has_table_privilege(
    current_user,
    to_regclass(format('%I.%I', current_schema(), 'ModerationRateLimitBucket')),
    'INSERT'
  ), false)
  AND COALESCE(has_table_privilege(
    current_user,
    to_regclass(format('%I.%I', current_schema(), 'ModerationRateLimitBucket')),
    'UPDATE'
  ), false)
  AND COALESCE(has_table_privilege(
    current_user,
    to_regclass(format('%I.%I', current_schema(), 'ModerationRateLimitBucket')),
    'DELETE'
  ), false)
  AND NOT EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    CROSS JOIN LATERAL aclexplode(
      COALESCE(relation.relacl, acldefault('r', relation.relowner))
    ) privilege
    WHERE namespace.nspname = current_schema()
      AND relation.relname = 'ModerationRateLimitBucket'
      AND privilege.grantee = 0
  ),
  false
) AS "contractReady"
`;

// Cleanup is deliberately not scheduled by this foundation. A separately
// approved worker may run this statement with an approved retention and a
// bounded batch size. Active debt is never removed.
export const MODERATION_RATE_LIMIT_CLEANUP_SQL = `
WITH "dbClock" AS MATERIALIZED (
  SELECT clock_timestamp() AS "nowAt"
), "stale" AS MATERIALIZED (
  SELECT
    bucket."actorId",
    bucket."scope"
  FROM "ModerationRateLimitBucket" bucket
  CROSS JOIN "dbClock" clock
  WHERE bucket."updatedAt"
      < clock."nowAt" - ($1::bigint * INTERVAL '1 second')
    AND bucket."theoreticalArrivalAt" <= clock."nowAt"
  ORDER BY
    bucket."updatedAt",
    bucket."theoreticalArrivalAt",
    bucket."actorId",
    bucket."scope"
  FOR UPDATE OF bucket SKIP LOCKED
  LIMIT $2::integer
), "deleted" AS (
  DELETE FROM "ModerationRateLimitBucket" bucket
  USING "stale"
  WHERE bucket."actorId" = "stale"."actorId"
    AND bucket."scope" = "stale"."scope"
  RETURNING 1
)
SELECT COUNT(*)::integer AS "deletedCount" FROM "deleted"
`;

export class ModerationRateLimitDatabaseContractError extends Error {
  constructor() {
    super('moderation rate-limit database contract is unavailable');
    this.name = 'ModerationRateLimitDatabaseContractError';
  }
}

function validateTimeoutResult(value) {
  const descriptors = Array.isArray(value) && value.length === 1
    ? Object.getOwnPropertyDescriptors(value[0])
    : null;
  if (
    !descriptors
    || Reflect.ownKeys(descriptors).length !== 3
    || !Object.hasOwn(descriptors, 'lockTimeoutMs')
    || !Object.hasOwn(descriptors.lockTimeoutMs, 'value')
    || descriptors.lockTimeoutMs.value !== DATABASE_LOCK_TIMEOUT_MS
    || !Object.hasOwn(descriptors, 'statementTimeoutMs')
    || !Object.hasOwn(descriptors.statementTimeoutMs, 'value')
    || descriptors.statementTimeoutMs.value !== DATABASE_STATEMENT_TIMEOUT_MS
    || !Object.hasOwn(descriptors, 'idleTimeoutMs')
    || !Object.hasOwn(descriptors.idleTimeoutMs, 'value')
    || descriptors.idleTimeoutMs.value !== DATABASE_TRANSACTION_TIMEOUT_MS
  ) {
    throw new ModerationRateLimitDatabaseContractError();
  }
}

export async function verifyModerationRateLimitDatabaseContract(db) {
  try {
    if (!db || typeof db.$transaction !== 'function') {
      throw new ModerationRateLimitDatabaseContractError();
    }
    return await db.$transaction(async (tx) => {
      if (!tx || typeof tx.$queryRawUnsafe !== 'function') {
        throw new ModerationRateLimitDatabaseContractError();
      }
      validateTimeoutResult(await tx.$queryRawUnsafe(
        MODERATION_RATE_LIMIT_DATABASE_TIMEOUTS_SQL,
      ));
      const result = await tx.$queryRawUnsafe(MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL);
      const descriptors = Array.isArray(result) && result.length === 1
        ? Object.getOwnPropertyDescriptors(result[0])
        : null;
      if (
        !descriptors
        || Reflect.ownKeys(descriptors).length !== 1
        || !Object.hasOwn(descriptors, 'contractReady')
        || !Object.hasOwn(descriptors.contractReady, 'value')
        || descriptors.contractReady.value !== true
      ) {
        throw new ModerationRateLimitDatabaseContractError();
      }
      return true;
    }, {
      maxWait: DATABASE_TRANSACTION_MAX_WAIT_MS,
      timeout: DATABASE_TRANSACTION_TIMEOUT_MS,
    });
  } catch (error) {
    if (error instanceof ModerationRateLimitDatabaseContractError) throw error;
    throw new ModerationRateLimitDatabaseContractError();
  }
}
