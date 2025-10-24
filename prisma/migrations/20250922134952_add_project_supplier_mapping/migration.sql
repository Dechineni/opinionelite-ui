-- CreateEnum
CREATE TYPE "public"."SupplierRedirectionType" AS ENUM ('STATIC_REDIRECT', 'STATIC_POSTBACK', 'DYNAMIC_REDIRECT', 'DYNAMIC_POSTBACK');

-- AlterTable
ALTER TABLE "public"."Client" ALTER COLUMN "code" SET DEFAULT ('C' || nextval('client_code_seq')::text);

-- AlterTable
ALTER TABLE "public"."Project" ALTER COLUMN "code" SET DEFAULT ('SR' || lpad(nextval('project_code_seq')::text, 4, '0'));

-- AlterTable
ALTER TABLE "public"."Supplier" ALTER COLUMN "code" SET DEFAULT 'S' || lpad(nextval('supplier_code_seq')::text, 4, '0');

-- CreateTable
CREATE TABLE "public"."ProjectSupplierMap" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "quota" INTEGER NOT NULL,
    "clickQuota" INTEGER NOT NULL,
    "cpi" DECIMAL(10,2) NOT NULL,
    "redirectionType" "public"."SupplierRedirectionType" NOT NULL,
    "postBackUrl" TEXT,
    "completeUrl" TEXT,
    "terminateUrl" TEXT,
    "overQuotaUrl" TEXT,
    "qualityTermUrl" TEXT,
    "surveyCloseUrl" TEXT,
    "supplierProjectId" TEXT,
    "allowTraffic" BOOLEAN NOT NULL DEFAULT false,
    "testLinkEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSupplierMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectSupplierMap_projectId_idx" ON "public"."ProjectSupplierMap"("projectId");

-- CreateIndex
CREATE INDEX "ProjectSupplierMap_supplierId_idx" ON "public"."ProjectSupplierMap"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSupplierMap_projectId_supplierId_key" ON "public"."ProjectSupplierMap"("projectId", "supplierId");

-- AddForeignKey
ALTER TABLE "public"."ProjectSupplierMap" ADD CONSTRAINT "ProjectSupplierMap_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectSupplierMap" ADD CONSTRAINT "ProjectSupplierMap_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
