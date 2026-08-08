-- Dormant, short-lived recent-authentication challenges for account deletion.
-- Every durable value is a one-way digest; raw Privy sessions, Apple subjects,
-- JWTs, nonces, states, and bearer proofs remain memory-only.

CREATE TYPE "AccountDeletionReauthStatus" AS ENUM (
  'ISSUED',
  'ATTESTED',
  'CONSUMED'
);

CREATE TABLE "AccountDeletionReauthChallenge" (
  "id" TEXT NOT NULL,
  "subjectHash" CHAR(64) NOT NULL,
  "subjectHashKeyVersion" INTEGER NOT NULL DEFAULT 1,
  "subjectHashKeyFingerprint" CHAR(64) NOT NULL,
  "sessionHash" CHAR(64) NOT NULL,
  "clientRequestHash" CHAR(64) NOT NULL,
  "nonceHash" CHAR(64) NOT NULL,
  "stateHash" CHAR(64) NOT NULL,
  "providerIdentityHash" CHAR(64),
  "proofHash" CHAR(64),
  "status" "AccountDeletionReauthStatus" NOT NULL DEFAULT 'ISSUED',
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "attestedAt" TIMESTAMPTZ(3),
  "consumedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "AccountDeletionReauthChallenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountDeletionReauthChallenge_digests_check" CHECK (
    "subjectHash" ~ '^[0-9a-f]{64}$'
    AND "subjectHashKeyFingerprint" ~ '^[0-9a-f]{64}$'
    AND "sessionHash" ~ '^[0-9a-f]{64}$'
    AND "clientRequestHash" ~ '^[0-9a-f]{64}$'
    AND "nonceHash" ~ '^[0-9a-f]{64}$'
    AND "stateHash" ~ '^[0-9a-f]{64}$'
    AND ("providerIdentityHash" IS NULL OR "providerIdentityHash" ~ '^[0-9a-f]{64}$')
    AND ("proofHash" IS NULL OR "proofHash" ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT "AccountDeletionReauthChallenge_expiry_check" CHECK (
    "expiresAt" > "createdAt"
  ),
  CONSTRAINT "AccountDeletionReauthChallenge_status_check" CHECK (
    (
      "status" = 'ISSUED'
      AND "providerIdentityHash" IS NULL
      AND "proofHash" IS NULL
      AND "attestedAt" IS NULL
      AND "consumedAt" IS NULL
    )
    OR (
      "status" = 'ATTESTED'
      AND "providerIdentityHash" IS NOT NULL
      AND "proofHash" IS NOT NULL
      AND "attestedAt" IS NOT NULL
      AND "attestedAt" >= "createdAt"
      AND "attestedAt" < "expiresAt"
      AND "consumedAt" IS NULL
    )
    OR (
      "status" = 'CONSUMED'
      AND "providerIdentityHash" IS NOT NULL
      AND "proofHash" IS NOT NULL
      AND "attestedAt" IS NOT NULL
      AND "consumedAt" IS NOT NULL
      AND "attestedAt" >= "createdAt"
      AND "attestedAt" < "expiresAt"
      AND "consumedAt" >= "attestedAt"
      AND "consumedAt" < "expiresAt"
    )
  )
);

-- Challenge bindings and expiry are immutable. Status can only move forward
-- through the two application transitions; direct SQL cannot resurrect or
-- rewrite a consumed authorization proof.
CREATE FUNCTION "enforce_account_deletion_reauth_transition"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."subjectHash" IS DISTINCT FROM OLD."subjectHash"
    OR NEW."subjectHashKeyVersion" IS DISTINCT FROM OLD."subjectHashKeyVersion"
    OR NEW."subjectHashKeyFingerprint" IS DISTINCT FROM OLD."subjectHashKeyFingerprint"
    OR NEW."sessionHash" IS DISTINCT FROM OLD."sessionHash"
    OR NEW."clientRequestHash" IS DISTINCT FROM OLD."clientRequestHash"
    OR NEW."nonceHash" IS DISTINCT FROM OLD."nonceHash"
    OR NEW."stateHash" IS DISTINCT FROM OLD."stateHash"
    OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  THEN
    RAISE EXCEPTION 'account deletion reauth challenge binding is immutable';
  END IF;

  IF NEW."status" = OLD."status" THEN
    IF NEW."providerIdentityHash" IS DISTINCT FROM OLD."providerIdentityHash"
      OR NEW."proofHash" IS DISTINCT FROM OLD."proofHash"
      OR NEW."attestedAt" IS DISTINCT FROM OLD."attestedAt"
      OR NEW."consumedAt" IS DISTINCT FROM OLD."consumedAt"
    THEN
      RAISE EXCEPTION 'account deletion reauth proof is immutable';
    END IF;
  ELSIF OLD."status" = 'ISSUED'::"AccountDeletionReauthStatus"
    AND NEW."status" = 'ATTESTED'::"AccountDeletionReauthStatus"
  THEN
    IF NEW."consumedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'invalid account deletion reauth attestation';
    END IF;
  ELSIF OLD."status" = 'ATTESTED'::"AccountDeletionReauthStatus"
    AND NEW."status" = 'CONSUMED'::"AccountDeletionReauthStatus"
  THEN
    IF NEW."providerIdentityHash" IS DISTINCT FROM OLD."providerIdentityHash"
      OR NEW."proofHash" IS DISTINCT FROM OLD."proofHash"
      OR NEW."attestedAt" IS DISTINCT FROM OLD."attestedAt"
    THEN
      RAISE EXCEPTION 'account deletion reauth attestation is immutable';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid account deletion reauth status transition';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AccountDeletionReauthChallenge_transition_guard"
BEFORE UPDATE ON "AccountDeletionReauthChallenge"
FOR EACH ROW
EXECUTE FUNCTION "enforce_account_deletion_reauth_transition"();

CREATE UNIQUE INDEX "AccountDeletionReauthChallenge_proofHash_key"
  ON "AccountDeletionReauthChallenge"("proofHash");
CREATE INDEX "idx_deletion_reauth_binding"
  ON "AccountDeletionReauthChallenge"(
    "subjectHash", "sessionHash", "status", "expiresAt"
  );
CREATE INDEX "idx_deletion_reauth_expiry"
  ON "AccountDeletionReauthChallenge"("expiresAt");

ALTER TABLE "AccountDeletionReauthChallenge"
  ADD CONSTRAINT "AccountDeletionReauthChallenge_subject_key_fkey"
  FOREIGN KEY ("subjectHashKeyVersion", "subjectHashKeyFingerprint")
  REFERENCES "AccountDeletionKeyRegistry"("keyVersion", "fingerprint")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Preserve the exact one-time proof used to authorize a committed tombstone.
-- The row contains hashes only, and the restrictive FK keeps the audit binding
-- from disappearing while the deletion saga is durable.
ALTER TABLE "AccountDeletionRequest"
  ADD COLUMN "recentAuthChallengeId" TEXT;
CREATE UNIQUE INDEX "AccountDeletionRequest_recentAuthChallengeId_key"
  ON "AccountDeletionRequest"("recentAuthChallengeId");
ALTER TABLE "AccountDeletionRequest"
  ADD CONSTRAINT "AccountDeletionRequest_recent_auth_fkey"
  FOREIGN KEY ("recentAuthChallengeId")
  REFERENCES "AccountDeletionReauthChallenge"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
