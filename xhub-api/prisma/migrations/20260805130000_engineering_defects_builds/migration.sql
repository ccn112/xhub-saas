-- Engineering Governance: DG-05 (Defect FSM), DG-06 (BuildRecord / CI
-- ingest) — 2026-08-05. Platform-wide, no RLS (see
-- docs/implementation/engineering-hub/ADR_SCOPE_MODEL.md).
-- CreateTable
CREATE TABLE "Defect" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVersionId" TEXT,
    "testCaseId" TEXT,
    "testResultId" TEXT,
    "backlogItemId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'P2',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "rootCause" TEXT,
    "standardsRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "sourceSystem" TEXT NOT NULL DEFAULT 'xhub-saas',
    "sourceRef" TEXT,
    "correlationId" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Defect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildRecord" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "branch" TEXT,
    "status" TEXT NOT NULL,
    "workflowRunUrl" TEXT,
    "triggeredBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Defect_code_key" ON "Defect"("code");
-- CreateIndex
CREATE UNIQUE INDEX "Defect_testResultId_key" ON "Defect"("testResultId");
-- CreateIndex
CREATE INDEX "Defect_productId_idx" ON "Defect"("productId");
-- CreateIndex
CREATE INDEX "Defect_productId_status_idx" ON "Defect"("productId", "status");
-- CreateIndex
CREATE INDEX "BuildRecord_productId_idx" ON "BuildRecord"("productId");
-- CreateIndex
CREATE INDEX "BuildRecord_productId_status_idx" ON "BuildRecord"("productId", "status");
-- CreateIndex
CREATE UNIQUE INDEX "BuildRecord_productId_source_externalId_key" ON "BuildRecord"("productId", "source", "externalId");

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "BuildRecord" ADD CONSTRAINT "BuildRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
