-- CreateEnum
CREATE TYPE "PostReportReason" AS ENUM (
    'SPAM',
    'NUDITY_SEXUAL_CONTENT',
    'HATE_SPEECH',
    'VIOLENCE_DANGEROUS',
    'BULLYING_HARASSMENT',
    'SCAM_FRAUD',
    'FALSE_INFORMATION'
);

-- CreateEnum
CREATE TYPE "PostReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED');

-- CreateTable
CREATE TABLE "PostReport" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "PostReportReason" NOT NULL,
    "status" "PostReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "PostReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_post_report_reporter" ON "PostReport"("postId", "reporterId");

-- CreateIndex
CREATE INDEX "idx_post_report_queue" ON "PostReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "idx_post_report_reporter" ON "PostReport"("reporterId", "createdAt");

-- AddForeignKey
ALTER TABLE "PostReport" ADD CONSTRAINT "PostReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReport" ADD CONSTRAINT "PostReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
