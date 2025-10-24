-- CreateEnum
CREATE TYPE "public"."ProjectStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CLOSED', 'INVOICED', 'BID');

-- CreateTable
CREATE TABLE "public"."Supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
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
CREATE TABLE "public"."ProjectGroup" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dynamicThanks" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Project" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "groupId" TEXT,
    "name" TEXT NOT NULL,
    "managerEmail" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "public"."ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
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

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "public"."Supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "public"."Project"("code");

-- AddForeignKey
ALTER TABLE "public"."ProjectGroup" ADD CONSTRAINT "ProjectGroup_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."ProjectGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
