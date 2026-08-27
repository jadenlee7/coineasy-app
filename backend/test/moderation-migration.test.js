import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL(
    '../prisma/migrations/20260826144000_moderation_queue/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

test('moderation schema has a deterministic queue, optimistic version, and identity-safe audit', () => {
  assert.match(schema, /enum PostReportResolution \{[\s\S]*?CONTENT_REMOVED[\s\S]*?CONTENT_UNAVAILABLE[\s\S]*?CONTENT_SUPERSEDED[\s\S]*?NO_VIOLATION[\s\S]*?\}/);
  assert.match(schema, /enum PostReportAuditAction \{[\s\S]*?CLAIM[\s\S]*?REMOVE_POST[\s\S]*?CLOSE_UNAVAILABLE[\s\S]*?CLOSE_SUPERSEDED[\s\S]*?REBASE_REVISION[\s\S]*?DISMISS[\s\S]*?\}/);
  assert.match(schema, /reviewerKeyId\s+String\?[\s\S]*?@db\.VarChar\(64\)/);
  assert.match(schema, /version\s+Int\s+@default\(0\)/);
  assert.match(schema, /@@index\(\[status, createdAt, id\], map: "idx_post_report_queue_v2"\)/);
  assert.match(schema, /model PostReportAudit \{[\s\S]*?policyVersion\s+String[\s\S]*?fromVersion\s+Int[\s\S]*?toVersion\s+Int/);
  assert.match(schema, /@@id\(\[reportId, toVersion\], map: "PostReportAudit_pkey"\)/);
  assert.match(schema, /operationId\s+String\s+@db\.Uuid/);
  assert.match(schema, /fromPostRevision\s+Int/);
  assert.match(schema, /toPostRevision\s+Int/);
  assert.match(schema, /@@index\(\[postId, postRevision, status, id\], map: "idx_post_report_revision_state"\)/);
  assert.match(schema, /reporterId\s+String\?/);
  assert.doesNotMatch(schema, /model PostReportAudit \{[^}]*?requestId/);
  assert.doesNotMatch(schema, /model PostReportAudit \{[^}]*?reporterId/);
  assert.doesNotMatch(schema, /model PostReportAudit \{[^}]*?(body|mediaUrl|walletAddress|privyDid)/);
});

test('moderation migration is additive and enforces every report state', () => {
  assert.equal((migration.match(/\bBEGIN;/gu) || []).length, 1);
  assert.equal((migration.match(/\bCOMMIT;/gu) || []).length, 1);
  assert.ok(migration.indexOf('BEGIN;') < migration.indexOf('DO $$'));
  assert.ok(
    migration.indexOf('LOCK TABLE "Post", "PostReport" IN ACCESS EXCLUSIVE MODE;')
      < migration.indexOf('DO $$'),
  );
  assert.doesNotMatch(migration, /LOCK TABLE "PostReport"[^,]*$/mu);
  assert.match(migration, /SET LOCAL lock_timeout = '10s';/u);
  assert.match(migration, /SET LOCAL statement_timeout = '30s';/u);
  assert.ok(migration.lastIndexOf('COMMIT;') > migration.lastIndexOf('ALTER TABLE'));
  assert.match(migration, /COMMIT;\s*$/u);
  assert.match(migration, /easygo_moderation_expand_requires_open_unreviewed_reports/);
  assert.match(migration, /easygo_moderation_expand_pending_fanout_exceeds_250/);
  assert.ok(
    migration.indexOf('easygo_moderation_expand_requires_open_unreviewed_reports')
      < migration.indexOf('CREATE TYPE "PostReportResolution"'),
  );
  assert.match(migration, /ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /PostReport_version_nonnegative_check/);
  assert.match(migration, /PostReport_state_consistency_check/);
  assert.match(migration, /"status" = 'ACTIONED'[\s\S]*?"resolution" IS NOT NULL[\s\S]*?"resolution" IN/);
  assert.match(migration, /"status" = 'DISMISSED'[\s\S]*?"resolution" IS NOT NULL[\s\S]*?"resolution" = 'NO_VIOLATION'/);
  for (const status of ['OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED']) {
    assert.match(migration, new RegExp(`"status" = '${status}'`));
  }
  assert.match(migration, /PostReportAudit_version_transition_check/);
  assert.match(migration, /PRIMARY KEY \("reportId", "toVersion"\)/);
  assert.match(migration, /"operationId" UUID NOT NULL/);
  assert.match(migration, /"fromPostRevision" INTEGER NOT NULL/);
  assert.match(migration, /"toPostRevision" INTEGER NOT NULL/);
  assert.match(migration, /"contentRevision" INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /"postRevision" INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /CONTENT_UNAVAILABLE/);
  assert.match(migration, /CLOSE_UNAVAILABLE/);
  assert.match(migration, /CONTENT_SUPERSEDED/);
  assert.match(migration, /REBASE_REVISION/);
  assert.match(migration, /"toVersion" = "fromVersion" \+ 1/);
  assert.match(migration, /ON DELETE CASCADE ON UPDATE CASCADE/);
  assert.ok(
    migration.indexOf('CREATE INDEX "idx_post_report_queue_v2"')
      < migration.indexOf('DROP INDEX IF EXISTS "idx_post_report_queue"'),
  );
  assert.match(migration, /CREATE UNIQUE INDEX "uniq_post_report_reporter_revision"/);
  assert.match(migration, /CREATE INDEX "idx_post_report_pending"/);
  assert.match(schema, /@@index\(\[postId, status, id\], map: "idx_post_report_pending"\)/);
  assert.doesNotMatch(migration, /DROP INDEX IF EXISTS "uniq_post_report_reporter"/);
  assert.match(migration, /ALTER COLUMN "reporterId" DROP NOT NULL/);
  assert.match(migration, /ON DELETE SET NULL ON UPDATE CASCADE/);

  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE)\b/i);
  assert.doesNotMatch(migration, /\b(TRUNCATE|DELETE\s+FROM)\b/i);
  assert.doesNotMatch(migration, /"privyDid"|"walletAddress"/);
  const auditTable = migration.match(/CREATE TABLE "PostReportAudit" \([\s\S]*?\n\);/u)?.[0];
  assert.ok(auditTable);
  assert.doesNotMatch(auditTable, /"reporterId"|"body"|"mediaUrl"/);
});
