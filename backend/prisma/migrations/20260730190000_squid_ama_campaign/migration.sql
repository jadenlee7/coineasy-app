-- Squid Korea Telegram AMA campaign operations.
-- Additive only: no existing EasyGo or Orange data is changed.

-- CreateEnum
CREATE TYPE "AmaQuestionStatus" AS ENUM (
    'SUBMITTED',
    'ACCEPTED',
    'DUPLICATE',
    'FILTERED',
    'ANSWERED_LIVE',
    'ANSWERED_FOLLOWUP'
);

-- CreateEnum
CREATE TYPE "AmaPreparedQuestionStatus" AS ENUM (
    'DRAFT',
    'APPROVED',
    'POSTED',
    'ANSWERED',
    'TRANSLATED',
    'FAILED'
);

-- CreateEnum
CREATE TYPE "AmaAnswerMode" AS ENUM (
    'APPROVED_SCRIPT',
    'LIVE_FREEFORM'
);

-- CreateEnum
CREATE TYPE "AmaSessionStatus" AS ENUM (
    'DRAFT',
    'READY',
    'FROZEN',
    'LIVE',
    'OPEN_FLOOR',
    'RESTORED',
    'FAILED'
);

-- CreateTable
CREATE TABLE "TelegramCampaignParticipant" (
    "id" TEXT NOT NULL,
    "campaignId" VARCHAR(100) NOT NULL,
    "telegramId" VARCHAR(32) NOT NULL,
    "telegramUsername" VARCHAR(64),
    "displayName" VARCHAR(200),
    "xp" INTEGER NOT NULL DEFAULT 0,
    "raffleEntries" INTEGER NOT NULL DEFAULT 0,
    "communityJoinedAt" TIMESTAMP(3),
    "referralCode" VARCHAR(32),
    "referredByParticipantId" TEXT,
    "referralQualifiedAt" TIMESTAMP(3),
    "dmOptOutAt" TIMESTAMP(3),
    "lastDmAt" TIMESTAMP(3),
    "dmFailureCount" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramCampaignParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramCampaignEvent" (
    "id" TEXT NOT NULL,
    "campaignId" VARCHAR(100) NOT NULL,
    "participantId" TEXT,
    "eventType" VARCHAR(100) NOT NULL,
    "eventKey" VARCHAR(255),
    "source" VARCHAR(100),
    "payload" JSONB,
    "xpDelta" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramCampaignEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramCampaignReward" (
    "id" TEXT NOT NULL,
    "campaignId" VARCHAR(100) NOT NULL,
    "participantId" TEXT NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "refId" VARCHAR(255) NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramCampaignReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmaQuestion" (
    "id" TEXT NOT NULL,
    "campaignId" VARCHAR(100) NOT NULL,
    "participantId" TEXT NOT NULL,
    "questionText" VARCHAR(1000) NOT NULL,
    "normalizedHash" VARCHAR(64) NOT NULL,
    "status" "AmaQuestionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "filterReason" VARCHAR(200),
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmaQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmaPreparedQuestion" (
    "id" TEXT NOT NULL,
    "campaignId" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL,
    "topic" VARCHAR(100),
    "questionKo" VARCHAR(1000) NOT NULL,
    "questionEn" VARCHAR(1000) NOT NULL,
    "sourceQuestionId" TEXT,
    "answerMode" "AmaAnswerMode" NOT NULL DEFAULT 'APPROVED_SCRIPT',
    "approvedAnswerEn" TEXT,
    "status" "AmaPreparedQuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "postedMessageId" VARCHAR(32),
    "answerMessageId" VARCHAR(32),
    "translationMessageId" VARCHAR(32),
    "answerReceivedAt" TIMESTAMP(3),
    "translatedAt" TIMESTAMP(3),
    "translationLatencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmaPreparedQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmaQuestionPack" (
    "id" TEXT NOT NULL,
    "campaignId" VARCHAR(100) NOT NULL,
    "version" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "sourceQuestionIds" JSONB NOT NULL,
    "contentEn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmaQuestionPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmaSession" (
    "campaignId" VARCHAR(100) NOT NULL,
    "chatId" VARCHAR(32) NOT NULL,
    "speakerTelegramId" VARCHAR(32) NOT NULL,
    "status" "AmaSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "savedPermissions" JSONB,
    "currentPosition" INTEGER NOT NULL DEFAULT 0,
    "currentQuestionMessageId" VARCHAR(32),
    "pinnedMessageId" VARCHAR(32),
    "frozenAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "openFloorStartedAt" TIMESTAMP(3),
    "openFloorEndedAt" TIMESTAMP(3),
    "openFloorQuestionCount" INTEGER NOT NULL DEFAULT 0,
    "restoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmaSession_pkey" PRIMARY KEY ("campaignId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramCampaignParticipant_campaignId_telegramId_key"
ON "TelegramCampaignParticipant"("campaignId", "telegramId");

CREATE INDEX "TelegramCampaignParticipant_campaignId_xp_idx"
ON "TelegramCampaignParticipant"("campaignId", "xp");

CREATE INDEX "TelegramCampaignParticipant_campaignId_lastSeenAt_idx"
ON "TelegramCampaignParticipant"("campaignId", "lastSeenAt");

CREATE UNIQUE INDEX "TelegramCampaignParticipant_referralCode_key"
ON "TelegramCampaignParticipant"("referralCode");

CREATE INDEX "TelegramCampaignParticipant_campaignId_referredByParticipantId_referralQualifiedAt_idx"
ON "TelegramCampaignParticipant"("campaignId", "referredByParticipantId", "referralQualifiedAt");

CREATE UNIQUE INDEX "TelegramCampaignEvent_eventKey_key"
ON "TelegramCampaignEvent"("eventKey");

CREATE INDEX "TelegramCampaignEvent_campaignId_eventType_createdAt_idx"
ON "TelegramCampaignEvent"("campaignId", "eventType", "createdAt");

CREATE INDEX "TelegramCampaignEvent_participantId_createdAt_idx"
ON "TelegramCampaignEvent"("participantId", "createdAt");

CREATE UNIQUE INDEX "TelegramCampaignReward_campaignId_reason_refId_key"
ON "TelegramCampaignReward"("campaignId", "reason", "refId");

CREATE INDEX "TelegramCampaignReward_participantId_createdAt_idx"
ON "TelegramCampaignReward"("participantId", "createdAt");

CREATE UNIQUE INDEX "AmaQuestion_campaignId_normalizedHash_key"
ON "AmaQuestion"("campaignId", "normalizedHash");

CREATE INDEX "AmaQuestion_campaignId_status_createdAt_idx"
ON "AmaQuestion"("campaignId", "status", "createdAt");

CREATE INDEX "AmaQuestion_participantId_createdAt_idx"
ON "AmaQuestion"("participantId", "createdAt");

CREATE UNIQUE INDEX "AmaPreparedQuestion_campaignId_position_key"
ON "AmaPreparedQuestion"("campaignId", "position");

CREATE UNIQUE INDEX "AmaPreparedQuestion_sourceQuestionId_key"
ON "AmaPreparedQuestion"("sourceQuestionId");

CREATE INDEX "AmaPreparedQuestion_campaignId_status_position_idx"
ON "AmaPreparedQuestion"("campaignId", "status", "position");

CREATE UNIQUE INDEX "AmaQuestionPack_campaignId_version_key"
ON "AmaQuestionPack"("campaignId", "version");

CREATE INDEX "AmaQuestionPack_campaignId_createdAt_idx"
ON "AmaQuestionPack"("campaignId", "createdAt");

CREATE INDEX "AmaSession_status_updatedAt_idx"
ON "AmaSession"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "TelegramCampaignEvent"
ADD CONSTRAINT "TelegramCampaignEvent_participantId_fkey"
FOREIGN KEY ("participantId") REFERENCES "TelegramCampaignParticipant"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TelegramCampaignReward"
ADD CONSTRAINT "TelegramCampaignReward_participantId_fkey"
FOREIGN KEY ("participantId") REFERENCES "TelegramCampaignParticipant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TelegramCampaignParticipant"
ADD CONSTRAINT "TelegramCampaignParticipant_referredByParticipantId_fkey"
FOREIGN KEY ("referredByParticipantId") REFERENCES "TelegramCampaignParticipant"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AmaQuestion"
ADD CONSTRAINT "AmaQuestion_participantId_fkey"
FOREIGN KEY ("participantId") REFERENCES "TelegramCampaignParticipant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AmaPreparedQuestion"
ADD CONSTRAINT "AmaPreparedQuestion_sourceQuestionId_fkey"
FOREIGN KEY ("sourceQuestionId") REFERENCES "AmaQuestion"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
