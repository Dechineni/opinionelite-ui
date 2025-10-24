-- ensure sequence exists before the table default uses it
DO $$ BEGIN
  CREATE SEQUENCE IF NOT EXISTS supplier_code_seq MINVALUE 1 START 1001;
EXCEPTION WHEN duplicate_table THEN
  -- ok if it already exists
END $$;

-- AlterTable
ALTER TABLE "public"."Client" ALTER COLUMN "code" SET DEFAULT ('C' || nextval('client_code_seq')::text);

-- AlterTable
ALTER TABLE "public"."Project" ALTER COLUMN "code" SET DEFAULT ('SR' || lpad(nextval('project_code_seq')::text, 4, '0'));

-- AlterTable
ALTER TABLE "public"."Supplier" ALTER COLUMN "code" SET DEFAULT 'S' || lpad(nextval('supplier_code_seq')::text, 4, '0');
