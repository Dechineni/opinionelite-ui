-- 1) Create the sequence (idempotent)
CREATE SEQUENCE IF NOT EXISTS project_code_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

-- 2) Set the column default (keep this in sync with schema.prisma)
ALTER TABLE "Project"
  ALTER COLUMN "code"
  SET DEFAULT ('SR' || lpad(nextval('project_code_seq')::text, 4, '0'));

-- 3) Advance the sequence so the next value is correct
--    If there are no rows, this sets it to 1 (nextval() -> 1)
--    If the highest code is SR0024, this sets it to 25 (nextval() -> 25)
SELECT setval(
  'project_code_seq',
  COALESCE(
    (SELECT MAX(CAST(regexp_replace("code", '^SR', '') AS INTEGER)) FROM "Project"),
    0
  ) + 1,
  false
);