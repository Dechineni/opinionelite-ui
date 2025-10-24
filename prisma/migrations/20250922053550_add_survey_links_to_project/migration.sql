-- CreateEnum
CREATE TYPE "public"."SurveyLinkType" AS ENUM ('SINGLE', 'MULTI');

-- AlterTable
ALTER TABLE "public"."Client" ALTER COLUMN "code" SET DEFAULT ('C' || nextval('client_code_seq')::text);

-- AlterTable
ALTER TABLE "public"."Project" ADD COLUMN     "surveyLinkType" "public"."SurveyLinkType" DEFAULT 'SINGLE',
ADD COLUMN     "surveyLiveUrl" TEXT,
ADD COLUMN     "surveyTestUrl" TEXT,
ALTER COLUMN "code" SET DEFAULT ('SR' || lpad(nextval('project_code_seq')::text, 4, '0'));

-- AlterTable
ALTER TABLE "public"."Supplier" ALTER COLUMN "code" SET DEFAULT 'S' || lpad(nextval('supplier_code_seq')::text, 4, '0');
