import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { MODERATION_RATE_LIMIT_POSTGRES_SQL } from '../src/lib/moderation-rate-limit-postgres.js';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migration = readFileSync(new URL(
  '../prisma/migrations/20260827193000_moderation_rate_limit_gcra/migration.sql',
  import.meta.url,
), 'utf8');

test('GCRA schema is one bounded actor-scope row with no app clock or event ledger', () => {
  const model = schema.match(/model ModerationRateLimitBucket \{[\s\S]*?\n\}/u)?.[0];
  assert.ok(model);
  assert.match(model, /actorId\s+String\s+@db\.VarChar\(64\)/u);
  assert.match(model, /scope\s+String\s+@db\.VarChar\(32\)/u);
  assert.match(model, /policyVersion\s+String\s+@db\.VarChar\(64\)/u);
  assert.match(model, /policyFingerprint\s+String\s+@db\.Char\(64\)/u);
  assert.match(model, /theoreticalArrivalAt\s+DateTime\s+@db\.Timestamptz\(6\)/u);
  assert.match(model, /updatedAt\s+DateTime\s+@db\.Timestamptz\(6\)/u);
  assert.match(model, /@@id\(\[actorId, scope\]/u);
  assert.doesNotMatch(model, /@updatedAt|@default\(now\(\)\)/u);
  assert.doesNotMatch(model, /provider|subject|email|token|request|body|postId|reportId|ipAddress/iu);
});

test('GCRA migration is additive, transactional, constrained, and cleanup-indexed', () => {
  assert.equal((migration.match(/\bBEGIN;/gu) || []).length, 1);
  assert.equal((migration.match(/\bCOMMIT;/gu) || []).length, 1);
  assert.match(migration, /SET LOCAL lock_timeout = '10s';/u);
  assert.match(migration, /SET LOCAL statement_timeout = '30s';/u);
  assert.match(migration, /CREATE TABLE "ModerationRateLimitBucket"/u);
  assert.match(migration, /PRIMARY KEY \("actorId", "scope"\)/u);
  for (const scope of ['queue.read', 'report.claim', 'report.decide', 'content.remove']) {
    assert.equal(migration.includes(`'${scope}'`), true);
  }
  for (const name of [
    'actor_format_check',
    'scope_check',
    'policy_version_check',
    'policy_fingerprint_check',
    'time_order_check',
  ]) {
    assert.match(migration, new RegExp(`ModerationRateLimitBucket_${name}`));
  }
  assert.match(migration, /"theoreticalArrivalAt" >= "updatedAt"/u);
  assert.match(migration, /CREATE INDEX "idx_moderation_rate_bucket_cleanup"/u);
  assert.match(migration, /REVOKE ALL ON TABLE "ModerationRateLimitBucket" FROM PUBLIC;/u);
  assert.doesNotMatch(migration, /IF NOT EXISTS|ALTER TABLE|LOCK TABLE|FOREIGN KEY/u);
  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/iu);
  const table = migration.match(/CREATE TABLE "ModerationRateLimitBucket" \([\s\S]*?\n\);/u)?.[0];
  assert.ok(table);
  assert.doesNotMatch(table, /provider|subject|email|token|request|body|postId|reportId|ipAddress/iu);
  assert.match(migration, /COMMIT;\s*$/u);
});

test('consume SQL uses one post-lock DB clock and all-or-nothing multi-scope writes', () => {
  const sql = MODERATION_RATE_LIMIT_POSTGRES_SQL.consume;
  assert.equal((sql.match(/clock_timestamp\(\)/gu) || []).length, 1);
  assert.match(sql, /"dbClock" AS MATERIALIZED/u);
  assert.match(sql, /COALESCE\(BOOL_AND/u);
  assert.match(sql, /COUNT\(\*\) = \$4::integer/u);
  assert.match(sql, /WHERE summary\."allowed" AND NOT summary\."policyMismatch"/u);
  assert.match(sql, /ON CONFLICT \("actorId", "scope"\) DO UPDATE/u);
  assert.match(sql, /"policyFingerprint" IS DISTINCT FROM input\."policyFingerprint"/u);
  assert.doesNotMatch(sql, /GREATEST\(1::bigint, summary\."retryAfterSeconds"\)/u);
  assert.equal(MODERATION_RATE_LIMIT_POSTGRES_SQL.lock.includes('$1'), true);
  assert.equal(MODERATION_RATE_LIMIT_POSTGRES_SQL.lock.includes('$2'), true);
});
