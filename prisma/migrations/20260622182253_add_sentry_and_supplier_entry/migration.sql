-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "sentryEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sentryHashingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sentryIdField" TEXT,
ADD COLUMN     "sentryLiveUrl" TEXT,
ADD COLUMN     "sentryProjectId" TEXT,
ADD COLUMN     "sentryProjectStatus" TEXT,
ADD COLUMN     "sentryProviderId" TEXT,
ADD COLUMN     "sentryReportingUrl" TEXT,
ADD COLUMN     "sentryTemplateId" TEXT,
ADD COLUMN     "sentryTestUrl" TEXT,
ADD COLUMN     "sentryVerisoulEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sentryVerisoulTermFake" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sentryVerisoulTermSuspicious" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SupplierEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectCode" TEXT,
    "supplierCode" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "firstEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryCount" INTEGER NOT NULL DEFAULT 1,
    "currentStage" TEXT NOT NULL DEFAULT 'ENTERED',
    "finalOutcome" TEXT,
    "finalOutcomeAt" TIMESTAMP(3),
    "entrySource" TEXT NOT NULL DEFAULT 'LIVE',
    "finalSource" TEXT,
    "isBackfilled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SupplierEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentryRespondentResult" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectCode" TEXT,
    "supplierCode" TEXT NOT NULL DEFAULT '',
    "externalId" TEXT NOT NULL,
    "sentryStatus" TEXT NOT NULL,
    "sentryResult" TEXT NOT NULL,
    "verisoulStatus" TEXT,
    "verisoulResult" TEXT,
    "providerId" TEXT,
    "language" TEXT,
    "rawQuery" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SentryRespondentResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierEntry_projectId_idx" ON "SupplierEntry"("projectId");

-- CreateIndex
CREATE INDEX "SupplierEntry_supplierCode_idx" ON "SupplierEntry"("supplierCode");

-- CreateIndex
CREATE INDEX "SupplierEntry_externalId_idx" ON "SupplierEntry"("externalId");

-- CreateIndex
CREATE INDEX "SupplierEntry_currentStage_idx" ON "SupplierEntry"("currentStage");

-- CreateIndex
CREATE INDEX "SupplierEntry_finalOutcome_idx" ON "SupplierEntry"("finalOutcome");

-- CreateIndex
CREATE INDEX "SupplierEntry_finalSource_idx" ON "SupplierEntry"("finalSource");

-- CreateIndex
CREATE INDEX "SupplierEntry_firstEnteredAt_idx" ON "SupplierEntry"("firstEnteredAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierEntry_unique_respondent" ON "SupplierEntry"("projectId", "supplierCode", "externalId");

-- CreateIndex
CREATE INDEX "SentryRespondentResult_projectId_idx" ON "SentryRespondentResult"("projectId");

-- CreateIndex
CREATE INDEX "SentryRespondentResult_supplierCode_idx" ON "SentryRespondentResult"("supplierCode");

-- CreateIndex
CREATE INDEX "SentryRespondentResult_externalId_idx" ON "SentryRespondentResult"("externalId");

-- CreateIndex
CREATE INDEX "SentryRespondentResult_sentryStatus_idx" ON "SentryRespondentResult"("sentryStatus");

-- CreateIndex
CREATE INDEX "SentryRespondentResult_sentryResult_idx" ON "SentryRespondentResult"("sentryResult");

-- CreateIndex
CREATE INDEX "SentryRespondentResult_verisoulResult_idx" ON "SentryRespondentResult"("verisoulResult");

-- CreateIndex
CREATE UNIQUE INDEX "SentryRespondentResult_unique_respondent" ON "SentryRespondentResult"("projectId", "supplierCode", "externalId");

-- AddForeignKey
ALTER TABLE "SupplierEntry" ADD CONSTRAINT "SupplierEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentryRespondentResult" ADD CONSTRAINT "SentryRespondentResult_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
