/*
  Warnings:

  - A unique constraint covering the columns `[projectId,externalId,supplierId]` on the table `Respondent` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Respondent_projectId_externalId_key";

-- AlterTable
ALTER TABLE "public"."Client" ALTER COLUMN "code" SET DEFAULT ('C' || nextval('client_code_seq')::text);

-- AlterTable
ALTER TABLE "public"."Project" ALTER COLUMN "code" SET DEFAULT ('SR' || lpad(nextval('project_code_seq')::text, 4, '0'));

-- AlterTable
ALTER TABLE "public"."Supplier" ALTER COLUMN "code" SET DEFAULT 'S' || lpad(nextval('supplier_code_seq')::text, 4, '0');

-- CreateIndex
CREATE UNIQUE INDEX "respondent_project_ext_supplier_unique" ON "public"."Respondent"("projectId", "externalId", "supplierId");
