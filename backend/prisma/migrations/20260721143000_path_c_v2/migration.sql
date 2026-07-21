-- Path C v2 S1-S7 additive schema expansion.
-- Generated from the committed social schema to prisma/schema.prisma.
-- This migration creates no destructive DROP or data rewrite statements.

-- CreateEnum
CREATE TYPE "ConsentAuditAction" AS ENUM ('GRANTED', 'UPDATED', 'REVOKED', 'VERSION_RESET');

-- CreateEnum
CREATE TYPE "EnsSubnameStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'ISSUED', 'FAILED');

-- CreateEnum
CREATE TYPE "QuestType" AS ENUM ('QUIZ', 'TRANSACTION');

-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QuestCompletionStatus" AS ENUM ('STARTED', 'SUBMITTED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SegmentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SegmentAssignmentSource" AS ENUM ('INDEXER', 'MANUAL');

-- CreateEnum
CREATE TYPE "AdvertiserStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "siweChainId" INTEGER,
ADD COLUMN     "siweNonceAddress" TEXT,
ADD COLUMN     "siweNonceExpiresAt" TIMESTAMP(3),
ADD COLUMN     "siweNonceHash" TEXT,
ADD COLUMN     "siweVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "subname" TEXT,
ADD COLUMN     "subnameAddress" TEXT,
ADD COLUMN     "subnameChainId" INTEGER,
ADD COLUMN     "subnameChallengeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "subnameChallengeHash" TEXT,
ADD COLUMN     "subnameIssuedAt" TIMESTAMP(3),
ADD COLUMN     "subnameRequestedAt" TIMESTAMP(3),
ADD COLUMN     "subnameStatus" "EnsSubnameStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN     "verifiedAddress" TEXT;

-- CreateTable
CREATE TABLE "UserConsent" (
    "userId" TEXT NOT NULL,
    "consentVersion" VARCHAR(50),
    "termsAcceptedAt" TIMESTAMP(3),
    "privacyAcceptedAt" TIMESTAMP(3),
    "segmentingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserConsentAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "ConsentAuditAction" NOT NULL,
    "consentVersion" VARCHAR(50),
    "segmentingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "termsAcceptedAt" TIMESTAMP(3),
    "privacyAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserConsentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "type" "QuestType" NOT NULL,
    "status" "QuestStatus" NOT NULL DEFAULT 'DRAFT',
    "rewardOrange" INTEGER NOT NULL DEFAULT 0,
    "requirements" JSONB NOT NULL,
    "requiresWalletSharing" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestCompletion" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "QuestCompletionStatus" NOT NULL DEFAULT 'STARTED',
    "verifyProof" JSONB,
    "walletSharingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "walletSharingConsentedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "status" "SegmentStatus" NOT NULL DEFAULT 'DRAFT',
    "ruleVersion" INTEGER NOT NULL DEFAULT 1,
    "rule" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSegment" (
    "userId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "source" "SegmentAssignmentSource" NOT NULL DEFAULT 'INDEXER',
    "ruleVersion" INTEGER NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "UserSegment_pkey" PRIMARY KEY ("userId","segmentId")
);

-- CreateTable
CREATE TABLE "Advertiser" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" "AdvertiserStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advertiser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "targetSegmentId" TEXT,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserConsentAudit_userId_createdAt_idx" ON "UserConsentAudit"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quest_slug_key" ON "Quest"("slug");

-- CreateIndex
CREATE INDEX "Quest_status_startsAt_endsAt_idx" ON "Quest"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Quest_campaignId_status_idx" ON "Quest"("campaignId", "status");

-- CreateIndex
CREATE INDEX "QuestCompletion_questId_status_idx" ON "QuestCompletion"("questId", "status");

-- CreateIndex
CREATE INDEX "QuestCompletion_userId_createdAt_idx" ON "QuestCompletion"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuestCompletion_questId_userId_key" ON "QuestCompletion"("questId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Segment_slug_key" ON "Segment"("slug");

-- CreateIndex
CREATE INDEX "Segment_status_updatedAt_idx" ON "Segment"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "UserSegment_segmentId_matchedAt_idx" ON "UserSegment"("segmentId", "matchedAt");

-- CreateIndex
CREATE INDEX "UserSegment_userId_expiresAt_idx" ON "UserSegment"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_slug_key" ON "Advertiser"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- CreateIndex
CREATE INDEX "Campaign_advertiserId_status_idx" ON "Campaign"("advertiserId", "status");

-- CreateIndex
CREATE INDEX "Campaign_targetSegmentId_status_idx" ON "Campaign"("targetSegmentId", "status");

-- CreateIndex
CREATE INDEX "Campaign_status_startsAt_endsAt_idx" ON "Campaign"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_verifiedAddress_key" ON "User"("verifiedAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_subname_key" ON "User"("subname");

-- AddForeignKey
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConsentAudit" ADD CONSTRAINT "UserConsentAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestCompletion" ADD CONSTRAINT "QuestCompletion_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestCompletion" ADD CONSTRAINT "QuestCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSegment" ADD CONSTRAINT "UserSegment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSegment" ADD CONSTRAINT "UserSegment_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_targetSegmentId_fkey" FOREIGN KEY ("targetSegmentId") REFERENCES "Segment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
