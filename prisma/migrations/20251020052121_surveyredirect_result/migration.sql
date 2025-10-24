-- CreateEnum
CREATE TYPE "public"."RedirectResult" AS ENUM ('COMPLETE', 'TERMINATE', 'OVERQUOTA', 'QUALITYTERM', 'CLOSE');

-- AlterTable
ALTER TABLE "public"."Client" ALTER COLUMN "code" SET DEFAULT ('C' || nextval('client_code_seq')::text);

-- AlterTable
ALTER TABLE "public"."Project" ALTER COLUMN "code" SET DEFAULT ('SR' || lpad(nextval('project_code_seq')::text, 4, '0'));

-- AlterTable
ALTER TABLE "public"."Supplier" ALTER COLUMN "code" SET DEFAULT 'S' || lpad(nextval('supplier_code_seq')::text, 4, '0');

-- AlterTable
ALTER TABLE "public"."SurveyRedirect" ADD COLUMN     "result" "public"."RedirectResult";
