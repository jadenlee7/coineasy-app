-- Add dormant, distributed moderation rate-limit state. The table stores one
-- bounded row per opaque workforce actor and capability scope. It contains no
-- provider subject, request, IP, token, UGC, or per-request event ledger.
BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE "ModerationRateLimitBucket" (
  "actorId" VARCHAR(64) NOT NULL,
  "scope" VARCHAR(32) NOT NULL,
  "policyVersion" VARCHAR(64) NOT NULL,
  "policyFingerprint" CHAR(64) NOT NULL,
  "theoreticalArrivalAt" TIMESTAMPTZ(6) NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "ModerationRateLimitBucket_pkey"
    PRIMARY KEY ("actorId", "scope"),
  CONSTRAINT "ModerationRateLimitBucket_actor_format_check"
    CHECK ("actorId" ~ '^wf_[A-Za-z0-9_-]{22,60}$'),
  CONSTRAINT "ModerationRateLimitBucket_scope_check"
    CHECK (
      "scope" IN (
        'queue.read',
        'report.claim',
        'report.decide',
        'content.remove'
      )
    ),
  CONSTRAINT "ModerationRateLimitBucket_policy_version_check"
    CHECK ("policyVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'),
  CONSTRAINT "ModerationRateLimitBucket_policy_fingerprint_check"
    CHECK ("policyFingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ModerationRateLimitBucket_time_order_check"
    CHECK ("theoreticalArrivalAt" >= "updatedAt")
);

CREATE INDEX "idx_moderation_rate_bucket_cleanup"
  ON "ModerationRateLimitBucket"(
    "updatedAt",
    "theoreticalArrivalAt",
    "actorId",
    "scope"
  );

REVOKE ALL ON TABLE "ModerationRateLimitBucket" FROM PUBLIC;

COMMIT;
