-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CLOSED', 'INVOICED', 'BID');

-- CreateEnum
CREATE TYPE "SurveyLinkType" AS ENUM ('SINGLE', 'MULTI');

-- CreateEnum
CREATE TYPE "SupplierRedirectionType" AS ENUM ('STATIC_REDIRECT', 'STATIC_POSTBACK', 'DYNAMIC_REDIRECT', 'DYNAMIC_POSTBACK');

-- CreateEnum
CREATE TYPE "PrescreenControlType" AS ENUM ('TEXT', 'RADIO', 'DROPDOWN', 'CHECKBOX');

-- CreateEnum
CREATE TYPE "PrescreenTextType" AS ENUM ('EMAIL', 'CONTACTNO', 'ZIPCODE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RedirectResult" AS ENUM ('COMPLETE', 'TERMINATE', 'OVERQUOTA', 'QUALITYTERM', 'CLOSE');

-- CreateEnum
CREATE TYPE "RedirectOutcome" AS ENUM ('COMPLETE', 'TERMINATE', 'OVER_QUOTA', 'DROP_OUT', 'QUALITY_TERM', 'SURVEY_CLOSE');

CREATE SEQUENCE IF NOT EXISTS client_code_seq START 1001 INCREMENT 1;

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT ('C'::text || (nextval('client_code_seq'::regclass))::text),
    "name" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "email" TEXT,
    "contactNumber" TEXT,
    "countryCode" TEXT NOT NULL,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE SEQUENCE IF NOT EXISTS supplier_code_seq START 1001 INCREMENT 1;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT ('S'::text || lpad((nextval('supplier_code_seq'::regclass))::text, 4, '0'::text)),
    "name" TEXT NOT NULL,
    "website" TEXT,
    "countryCode" TEXT NOT NULL,
    "email" TEXT,
    "contactNumber" TEXT,
    "panelSize" INTEGER,
    "completeUrl" TEXT NOT NULL,
    "terminateUrl" TEXT NOT NULL,
    "overQuotaUrl" TEXT NOT NULL,
    "qualityTermUrl" TEXT NOT NULL,
    "surveyCloseUrl" TEXT NOT NULL,
    "about" TEXT,
    "allowedCountries" TEXT[],
    "api" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectGroup" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dynamicThanks" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectGroup_pkey" PRIMARY KEY ("id")
);

CREATE SEQUENCE IF NOT EXISTS project_code_seq START 1 INCREMENT 1;

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT ('SR'::text || lpad((nextval('project_code_seq'::regclass))::text, 4, '0'::text)),
    "clientId" TEXT NOT NULL,
    "groupId" TEXT,
    "name" TEXT NOT NULL,
    "managerEmail" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "countryCode" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "loi" INTEGER NOT NULL,
    "ir" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "clickQuota" INTEGER NOT NULL,
    "projectCpi" DECIMAL(10,2) NOT NULL,
    "supplierCpi" DECIMAL(10,2),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "preScreen" BOOLEAN NOT NULL DEFAULT false,
    "exclude" BOOLEAN NOT NULL DEFAULT false,
    "geoLocation" BOOLEAN NOT NULL DEFAULT false,
    "dynamicThanksUrl" BOOLEAN NOT NULL DEFAULT false,
    "uniqueIp" BOOLEAN NOT NULL DEFAULT false,
    "uniqueIpDepth" INTEGER,
    "tSign" BOOLEAN NOT NULL DEFAULT false,
    "speeder" BOOLEAN NOT NULL DEFAULT false,
    "speederDepth" INTEGER,
    "mobile" BOOLEAN NOT NULL DEFAULT true,
    "tablet" BOOLEAN NOT NULL DEFAULT false,
    "desktop" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "surveyLinkType" "SurveyLinkType" DEFAULT 'SINGLE',
    "surveyLiveUrl" TEXT,
    "surveyTestUrl" TEXT,
    "surveyName" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSupplierMap" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "quota" INTEGER NOT NULL,
    "clickQuota" INTEGER NOT NULL,
    "cpi" DECIMAL(10,2) NOT NULL,
    "redirectionType" "SupplierRedirectionType" NOT NULL,
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
    "supplierUrl" TEXT,

    CONSTRAINT "ProjectSupplierMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescreenQuestion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "controlType" "PrescreenControlType" NOT NULL,
    "textMinLength" INTEGER DEFAULT 0,
    "textMaxLength" INTEGER,
    "textType" "PrescreenTextType",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescreenQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescreenOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "validate" BOOLEAN NOT NULL DEFAULT false,
    "quota" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PrescreenOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Respondent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "supplierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Respondent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescreenAnswer" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "respondentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerText" TEXT,
    "answerValue" TEXT,
    "selectedValues" TEXT[],
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrescreenAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyRedirect" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "respondentId" TEXT,
    "supplierId" TEXT,
    "externalId" TEXT,
    "destination" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" "RedirectResult",

    CONSTRAINT "SurveyRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierRedirectEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "supplierId" TEXT,
    "respondentId" TEXT,
    "pid" TEXT,
    "outcome" "RedirectOutcome" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierRedirectEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_code_key" ON "Client"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "ProjectSupplierMap_projectId_idx" ON "ProjectSupplierMap"("projectId");

-- CreateIndex
CREATE INDEX "ProjectSupplierMap_supplierId_idx" ON "ProjectSupplierMap"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSupplierMap_projectId_supplierId_key" ON "ProjectSupplierMap"("projectId", "supplierId");

-- CreateIndex
CREATE INDEX "Respondent_projectId_idx" ON "Respondent"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "respondent_project_ext_supplier_unique" ON "Respondent"("projectId", "externalId", "supplierId");

-- CreateIndex
CREATE INDEX "PrescreenAnswer_projectId_idx" ON "PrescreenAnswer"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PrescreenAnswer_respondentId_questionId_key" ON "PrescreenAnswer"("respondentId", "questionId");

-- CreateIndex
CREATE INDEX "SurveyRedirect_projectId_idx" ON "SurveyRedirect"("projectId");

-- CreateIndex
CREATE INDEX "SurveyRedirect_respondentId_idx" ON "SurveyRedirect"("respondentId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyRedirect_nat_unique" ON "SurveyRedirect"("projectId", "supplierId", "externalId");

-- CreateIndex
CREATE INDEX "SupplierRedirectEvent_projectId_supplierId_outcome_idx" ON "SupplierRedirectEvent"("projectId", "supplierId", "outcome");

-- CreateIndex
CREATE INDEX "SupplierRedirectEvent_pid_idx" ON "SupplierRedirectEvent"("pid");

-- AddForeignKey
ALTER TABLE "ProjectGroup" ADD CONSTRAINT "ProjectGroup_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProjectGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSupplierMap" ADD CONSTRAINT "ProjectSupplierMap_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSupplierMap" ADD CONSTRAINT "ProjectSupplierMap_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescreenQuestion" ADD CONSTRAINT "PrescreenQuestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescreenOption" ADD CONSTRAINT "PrescreenOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PrescreenQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Respondent" ADD CONSTRAINT "Respondent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescreenAnswer" ADD CONSTRAINT "PrescreenAnswer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescreenAnswer" ADD CONSTRAINT "PrescreenAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PrescreenQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescreenAnswer" ADD CONSTRAINT "PrescreenAnswer_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "Respondent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyRedirect" ADD CONSTRAINT "SurveyRedirect_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyRedirect" ADD CONSTRAINT "SurveyRedirect_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "Respondent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRedirectEvent" ADD CONSTRAINT "SupplierRedirectEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRedirectEvent" ADD CONSTRAINT "SupplierRedirectEvent_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "Respondent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRedirectEvent" ADD CONSTRAINT "SupplierRedirectEvent_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

