-- Ensure the sequence exists in BOTH the real DB and the shadow DB
CREATE SEQUENCE IF NOT EXISTS client_code_seq START 1001 INCREMENT 1;

-- AlterTable
ALTER TABLE "public"."Client" ALTER COLUMN "code" SET DEFAULT ('C' || nextval('client_code_seq')::text);
