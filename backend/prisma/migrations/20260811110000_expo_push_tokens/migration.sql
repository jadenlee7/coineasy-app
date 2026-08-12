-- Store one Expo delivery address under exactly one EasyGo account.
-- This migration is additive; account deletion removes registrations through
-- the cascading user foreign key.
CREATE TABLE "ExpoPushToken" (
  "id" TEXT NOT NULL,
  "token" VARCHAR(255) NOT NULL,
  "platform" VARCHAR(16) NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExpoPushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExpoPushToken_token_key"
  ON "ExpoPushToken"("token");
CREATE INDEX "ExpoPushToken_userId_updatedAt_idx"
  ON "ExpoPushToken"("userId", "updatedAt");

ALTER TABLE "ExpoPushToken"
  ADD CONSTRAINT "ExpoPushToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
