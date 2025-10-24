-- CreateEnum
CREATE TYPE "public"."PrescreenControlType" AS ENUM ('TEXT', 'RADIO', 'DROPDOWN', 'CHECKBOX');

-- CreateEnum
CREATE TYPE "public"."PrescreenTextType" AS ENUM ('EMAIL', 'CONTACTNO', 'ZIPCODE', 'CUSTOM');

-- AlterTable
ALTER TABLE "public"."Client" ALTER COLUMN "code" SET DEFAULT ('C' || nextval('client_code_seq')::text);

-- AlterTable
ALTER TABLE "public"."Project" ALTER COLUMN "code" SET DEFAULT ('SR' || lpad(nextval('project_code_seq')::text, 4, '0'));

-- AlterTable
ALTER TABLE "public"."Supplier" ALTER COLUMN "code" SET DEFAULT 'S' || lpad(nextval('supplier_code_seq')::text, 4, '0');

-- CreateTable
CREATE TABLE "public"."PrescreenQuestion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "controlType" "public"."PrescreenControlType" NOT NULL,
    "textMinLength" INTEGER DEFAULT 0,
    "textMaxLength" INTEGER,
    "textType" "public"."PrescreenTextType",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescreenQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PrescreenOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PrescreenOption_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."PrescreenQuestion" ADD CONSTRAINT "PrescreenQuestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrescreenOption" ADD CONSTRAINT "PrescreenOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."PrescreenQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
