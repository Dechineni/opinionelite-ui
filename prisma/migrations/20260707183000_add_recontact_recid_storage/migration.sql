ALTER TABLE "SupplierEntry"
ADD COLUMN IF NOT EXISTS "recid" TEXT;

ALTER TABLE "SurveyRedirect"
ADD COLUMN IF NOT EXISTS "recid" TEXT;

ALTER TABLE "Respondent"
ADD COLUMN IF NOT EXISTS "recid" TEXT;

CREATE INDEX IF NOT EXISTS "SupplierEntry_recid_idx"
ON "SupplierEntry"("recid");

CREATE INDEX IF NOT EXISTS "SupplierEntry_projectId_supplierCode_recid_idx"
ON "SupplierEntry"("projectId", "supplierCode", "recid");

CREATE INDEX IF NOT EXISTS "SurveyRedirect_recid_idx"
ON "SurveyRedirect"("recid");

CREATE INDEX IF NOT EXISTS "SurveyRedirect_projectId_supplierId_recid_idx"
ON "SurveyRedirect"("projectId", "supplierId", "recid");

CREATE INDEX IF NOT EXISTS "Respondent_recid_idx"
ON "Respondent"("recid");

CREATE INDEX IF NOT EXISTS "Respondent_projectId_supplierId_recid_idx"
ON "Respondent"("projectId", "supplierId", "recid");