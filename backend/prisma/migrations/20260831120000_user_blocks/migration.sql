-- Add an account-owned, directed user-block relation. Application reads treat
-- either direction as a visibility boundary for authenticated social views.
CREATE TABLE "UserBlock" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("blockerId", "blockedId"),
    CONSTRAINT "UserBlock_not_self" CHECK ("blockerId" <> "blockedId")
);

CREATE INDEX "UserBlock_blockedId_blockerId_idx"
    ON "UserBlock"("blockedId", "blockerId");

CREATE INDEX "UserBlock_blockerId_createdAt_blockedId_idx"
    ON "UserBlock"("blockerId", "createdAt", "blockedId");

ALTER TABLE "UserBlock"
    ADD CONSTRAINT "UserBlock_blockerId_fkey"
    FOREIGN KEY ("blockerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBlock"
    ADD CONSTRAINT "UserBlock_blockedId_fkey"
    FOREIGN KEY ("blockedId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
