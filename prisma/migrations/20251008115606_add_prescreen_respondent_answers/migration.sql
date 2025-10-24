-- AlterTable
ALTER TABLE "public"."Client" ALTER COLUMN "code" SET DEFAULT ('C' || nextval('client_code_seq')::text);

-- AlterTable
ALTER TABLE "public"."Project" ALTER COLUMN "code" SET DEFAULT ('SR' || lpad(nextval('project_code_seq')::text, 4, '0'));

-- AlterTable
ALTER TABLE "public"."Supplier" ALTER COLUMN "code" SET DEFAULT 'S' || lpad(nextval('supplier_code_seq')::text, 4, '0');

-- CreateTable
CREATE TABLE "public"."Respondent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "supplierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Respondent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PrescreenAnswer" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "respondentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerText" TEXT,
    "answerValue" TEXT,
    "selectedValues" TEXT[],
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrescreenAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Respondent_projectId_idx" ON "public"."Respondent"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Respondent_projectId_externalId_key" ON "public"."Respondent"("projectId", "externalId");

-- CreateIndex
CREATE INDEX "PrescreenAnswer_projectId_idx" ON "public"."PrescreenAnswer"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PrescreenAnswer_respondentId_questionId_key" ON "public"."PrescreenAnswer"("respondentId", "questionId");

-- AddForeignKey
ALTER TABLE "public"."Respondent" ADD CONSTRAINT "Respondent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrescreenAnswer" ADD CONSTRAINT "PrescreenAnswer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrescreenAnswer" ADD CONSTRAINT "PrescreenAnswer_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "public"."Respondent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrescreenAnswer" ADD CONSTRAINT "PrescreenAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."PrescreenQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
