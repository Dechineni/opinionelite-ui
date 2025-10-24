-- AlterTable
ALTER TABLE "public"."Client" ALTER COLUMN "code" SET DEFAULT ('C' || nextval('client_code_seq')::text);

-- AlterTable
ALTER TABLE "public"."Project" ALTER COLUMN "code" SET DEFAULT ('SR' || lpad(nextval('project_code_seq')::text, 4, '0'));

-- AlterTable
ALTER TABLE "public"."Supplier" ALTER COLUMN "code" SET DEFAULT 'S' || lpad(nextval('supplier_code_seq')::text, 4, '0');

-- CreateTable
CREATE TABLE "public"."SurveyRedirect" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "respondentId" TEXT,
    "supplierId" TEXT,
    "externalId" TEXT,
    "destination" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SurveyRedirect_projectId_idx" ON "public"."SurveyRedirect"("projectId");

-- CreateIndex
CREATE INDEX "SurveyRedirect_respondentId_idx" ON "public"."SurveyRedirect"("respondentId");

-- AddForeignKey
ALTER TABLE "public"."SurveyRedirect" ADD CONSTRAINT "SurveyRedirect_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyRedirect" ADD CONSTRAINT "SurveyRedirect_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "public"."Respondent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
