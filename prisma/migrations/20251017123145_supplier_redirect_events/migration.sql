-- CreateEnum
CREATE TYPE "public"."RedirectOutcome" AS ENUM ('COMPLETE', 'TERMINATE', 'OVER_QUOTA', 'DROP_OUT', 'QUALITY_TERM', 'SURVEY_CLOSE');

-- AlterTable
ALTER TABLE "public"."Client" ALTER COLUMN "code" SET DEFAULT ('C' || nextval('client_code_seq')::text);

-- AlterTable
ALTER TABLE "public"."Project" ALTER COLUMN "code" SET DEFAULT ('SR' || lpad(nextval('project_code_seq')::text, 4, '0'));

-- AlterTable
ALTER TABLE "public"."Supplier" ALTER COLUMN "code" SET DEFAULT 'S' || lpad(nextval('supplier_code_seq')::text, 4, '0');

-- CreateTable
CREATE TABLE "public"."SupplierRedirectEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "supplierId" TEXT,
    "respondentId" TEXT,
    "pid" TEXT,
    "outcome" "public"."RedirectOutcome" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierRedirectEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierRedirectEvent_projectId_supplierId_outcome_idx" ON "public"."SupplierRedirectEvent"("projectId", "supplierId", "outcome");

-- CreateIndex
CREATE INDEX "SupplierRedirectEvent_pid_idx" ON "public"."SupplierRedirectEvent"("pid");

-- AddForeignKey
ALTER TABLE "public"."SupplierRedirectEvent" ADD CONSTRAINT "SupplierRedirectEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierRedirectEvent" ADD CONSTRAINT "SupplierRedirectEvent_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierRedirectEvent" ADD CONSTRAINT "SupplierRedirectEvent_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "public"."Respondent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
