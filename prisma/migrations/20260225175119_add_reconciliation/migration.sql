-- CreateTable
CREATE TABLE "Reconciliation" (
    "id" TEXT NOT NULL,
    "respondentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "projectCode" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierIdentifier" TEXT NOT NULL,
    "outcome" "RedirectOutcome",
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reconciliation_respondentId_key" ON "Reconciliation"("respondentId");

-- CreateIndex
CREATE INDEX "Reconciliation_projectId_idx" ON "Reconciliation"("projectId");

-- CreateIndex
CREATE INDEX "Reconciliation_supplierId_idx" ON "Reconciliation"("supplierId");

-- CreateIndex
CREATE INDEX "Reconciliation_supplierIdentifier_idx" ON "Reconciliation"("supplierIdentifier");

-- CreateIndex
CREATE INDEX "Reconciliation_outcome_idx" ON "Reconciliation"("outcome");

-- AddForeignKey
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
