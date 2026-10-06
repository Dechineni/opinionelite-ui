CREATE TABLE IF NOT EXISTS "ProjectQuota" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "prescreenQuestionId" TEXT,
  "prescreenQuestionTitle" TEXT,
  "quotaName" TEXT NOT NULL,

  "status" TEXT NOT NULL DEFAULT 'Open',

  "targetCompletes" INTEGER NOT NULL DEFAULT 0,
  "quotaCount" INTEGER NOT NULL DEFAULT 0,
  "quotaPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,

  "totalAccesses" INTEGER NOT NULL DEFAULT 0,
  "prescreenClicks" INTEGER NOT NULL DEFAULT 0,
  "completes" INTEGER NOT NULL DEFAULT 0,
  "terminates" INTEGER NOT NULL DEFAULT 0,
  "overQuotas" INTEGER NOT NULL DEFAULT 0,

  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProjectQuota_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProjectQuota_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectQuota"
    ADD CONSTRAINT "ProjectQuota_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectQuota_project_question_quotaName_unique"
ON "ProjectQuota"("projectId", "prescreenQuestionId", "quotaName");

CREATE INDEX IF NOT EXISTS "ProjectQuota_projectId_idx"
ON "ProjectQuota"("projectId");

CREATE INDEX IF NOT EXISTS "ProjectQuota_projectId_status_idx"
ON "ProjectQuota"("projectId", "status");