-- Add provider-generic, privacy-preserving stable identity mappings for the
-- account-deletion guard. Only keyed digests are stored; raw provider subjects
-- and provider emails never enter these tables.

CREATE TABLE "UserStableProviderIdentity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "context" VARCHAR(128) NOT NULL,
  "providerIdentityHash" CHAR(64) NOT NULL,
  "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "keyFingerprint" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserStableProviderIdentity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserStableProviderIdentity_namespace_check" CHECK (
    "provider" ~ '^[a-z][a-z0-9_:-]{0,63}$'
    AND "context" ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$'
  ),
  CONSTRAINT "UserStableProviderIdentity_digests_check" CHECK (
    "providerIdentityHash" ~ '^[0-9a-f]{64}$'
    AND "keyFingerprint" ~ '^[0-9a-f]{64}$'
  )
);

CREATE UNIQUE INDEX "uniq_user_stable_provider_identity"
  ON "UserStableProviderIdentity"("provider", "context", "providerIdentityHash");
CREATE UNIQUE INDEX "uniq_user_stable_provider_namespace"
  ON "UserStableProviderIdentity"("userId", "provider", "context");
CREATE INDEX "idx_user_stable_provider_user"
  ON "UserStableProviderIdentity"("userId");

ALTER TABLE "UserStableProviderIdentity"
  ADD CONSTRAINT "UserStableProviderIdentity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserStableProviderIdentity"
  ADD CONSTRAINT "UserStableProviderIdentity_subject_key_fkey"
  FOREIGN KEY ("keyVersion", "keyFingerprint")
  REFERENCES "AccountDeletionKeyRegistry"("keyVersion", "fingerprint")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "AccountDeletionProviderIdentity" (
  "id" TEXT NOT NULL,
  "accountDeletionRequestId" TEXT NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "context" VARCHAR(128) NOT NULL,
  "providerIdentityHash" CHAR(64) NOT NULL,
  "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "keyFingerprint" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AccountDeletionProviderIdentity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountDeletionProviderIdentity_namespace_check" CHECK (
    "provider" ~ '^[a-z][a-z0-9_:-]{0,63}$'
    AND "context" ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$'
  ),
  CONSTRAINT "AccountDeletionProviderIdentity_digests_check" CHECK (
    "providerIdentityHash" ~ '^[0-9a-f]{64}$'
    AND "keyFingerprint" ~ '^[0-9a-f]{64}$'
  )
);

CREATE UNIQUE INDEX "uniq_deletion_stable_provider_identity"
  ON "AccountDeletionProviderIdentity"("provider", "context", "providerIdentityHash");
CREATE UNIQUE INDEX "uniq_deletion_request_provider_namespace"
  ON "AccountDeletionProviderIdentity"("accountDeletionRequestId", "provider", "context");
CREATE INDEX "idx_deletion_provider_request"
  ON "AccountDeletionProviderIdentity"("accountDeletionRequestId");

ALTER TABLE "AccountDeletionProviderIdentity"
  ADD CONSTRAINT "AccountDeletionProviderIdentity_request_fkey"
  FOREIGN KEY ("accountDeletionRequestId") REFERENCES "AccountDeletionRequest"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "AccountDeletionProviderIdentity"
  ADD CONSTRAINT "AccountDeletionProviderIdentity_subject_key_fkey"
  FOREIGN KEY ("keyVersion", "keyFingerprint")
  REFERENCES "AccountDeletionKeyRegistry"("keyVersion", "fingerprint")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Provider identity bindings are write-once. Active bindings may disappear
-- only through their owning User cascade; deletion bindings are durable and
-- intentionally make AccountDeletionRequest deletion fail.
CREATE FUNCTION "reject_stable_provider_identity_update"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'stable provider identity rows are immutable';
END;
$$;

CREATE TRIGGER "UserStableProviderIdentity_immutable"
  BEFORE UPDATE ON "UserStableProviderIdentity"
  FOR EACH ROW EXECUTE FUNCTION "reject_stable_provider_identity_update"();

CREATE TRIGGER "AccountDeletionProviderIdentity_immutable"
  BEFORE UPDATE OR DELETE ON "AccountDeletionProviderIdentity"
  FOR EACH ROW EXECUTE FUNCTION "reject_stable_provider_identity_update"();

-- Tighten the existing durable worker row while this migration still has no
-- production deletion rows to backfill. Lease fields move together, retries
-- cannot underflow, and terminal completion cannot retain decryptable DID
-- material.
ALTER TABLE "AccountDeletionRequest"
  ADD CONSTRAINT "AccountDeletionRequest_attemptCount_nonnegative_check"
  CHECK ("attemptCount" >= 0),
  ADD CONSTRAINT "AccountDeletionRequest_lease_pair_check"
  CHECK (
    ("leaseToken" IS NULL AND "leaseExpiresAt" IS NULL)
    OR ("leaseToken" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "AccountDeletionRequest_completed_ciphertext_cleared_check"
  CHECK (
    "state" <> 'COMPLETED'
    OR ("privyDidCiphertext" IS NULL AND "encryptionKeyVersion" IS NULL)
  );
