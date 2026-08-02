-- Preserve thread structure during account deletion and add a durable
-- cross-provider deletion tombstone. The request table intentionally has no
-- foreign key to User so a stale Privy session can remain blocked after the
-- local identity row is gone.

CREATE TYPE "AccountDeletionState" AS ENUM (
  'REQUESTED',
  'LOCAL_PURGED',
  'APPLE_REVOKED',
  'PRIVY_DELETED',
  'COMPLETED',
  'MANUAL_REVIEW'
);

ALTER TABLE "Post" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Post" DROP CONSTRAINT "Post_authorId_fkey";
ALTER TABLE "Post" ALTER COLUMN "authorId" DROP NOT NULL;
ALTER TABLE "Post"
  ADD CONSTRAINT "Post_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- An authorless post may only exist as a fully redacted thread placeholder.
-- This also makes a direct User delete fail rather than leak an unredacted
-- orphan if a concurrent post write escaped the deletion service's first pass.
ALTER TABLE "Post"
  ADD CONSTRAINT "Post_deleted_redacted_check"
  CHECK (
    ("deletedAt" IS NULL AND "authorId" IS NOT NULL)
    OR
    (
      "deletedAt" IS NOT NULL
      AND "authorId" IS NULL
      AND "body" = ''
      AND "mediaUrl" IS NULL
    )
  );

CREATE TABLE "AccountDeletionKeyRegistry" (
  "keyVersion" INTEGER NOT NULL,
  "fingerprint" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AccountDeletionKeyRegistry_pkey" PRIMARY KEY ("keyVersion"),
  CONSTRAINT "AccountDeletionKeyRegistry_fingerprint_check" CHECK (
    "fingerprint" ~ '^[0-9a-f]{64}$'
  )
);

CREATE UNIQUE INDEX "AccountDeletionKeyRegistry_fingerprint_key"
  ON "AccountDeletionKeyRegistry"("fingerprint");
CREATE UNIQUE INDEX "AccountDeletionKeyRegistry_keyVersion_fingerprint_key"
  ON "AccountDeletionKeyRegistry"("keyVersion", "fingerprint");

CREATE TABLE "AccountDeletionRequest" (
  "id" TEXT NOT NULL,
  "subjectHash" CHAR(64) NOT NULL,
  "subjectHashKeyVersion" INTEGER NOT NULL DEFAULT 1,
  "subjectHashKeyFingerprint" CHAR(64) NOT NULL,
  "privyDidCiphertext" TEXT,
  "encryptionKeyVersion" INTEGER,
  "clientRequestId" UUID NOT NULL,
  "state" "AccountDeletionState" NOT NULL DEFAULT 'REQUESTED',
  "stateVersion" INTEGER NOT NULL DEFAULT 0,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "lastErrorAt" TIMESTAMP(3),
  "lastErrorCode" VARCHAR(100),
  "leaseToken" VARCHAR(64),
  "leaseExpiresAt" TIMESTAMP(3),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "localPurgedAt" TIMESTAMP(3),
  "appleRevokedAt" TIMESTAMP(3),
  "privyDeletedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "manualReviewAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountDeletionRequest_subject_digests_check" CHECK (
    "subjectHash" ~ '^[0-9a-f]{64}$'
    AND "subjectHashKeyFingerprint" ~ '^[0-9a-f]{64}$'
  )
);

CREATE UNIQUE INDEX "AccountDeletionRequest_subjectHash_key"
  ON "AccountDeletionRequest"("subjectHash");
CREATE INDEX "AccountDeletionRequest_clientRequestId_idx"
  ON "AccountDeletionRequest"("clientRequestId");
CREATE INDEX "AccountDeletionRequest_state_nextAttemptAt_idx"
  ON "AccountDeletionRequest"("state", "nextAttemptAt");
CREATE INDEX "AccountDeletionRequest_leaseExpiresAt_idx"
  ON "AccountDeletionRequest"("leaseExpiresAt");

ALTER TABLE "AccountDeletionRequest"
  ADD CONSTRAINT "AccountDeletionRequest_subject_key_fkey"
  FOREIGN KEY ("subjectHashKeyVersion", "subjectHashKeyFingerprint")
  REFERENCES "AccountDeletionKeyRegistry"("keyVersion", "fingerprint")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
