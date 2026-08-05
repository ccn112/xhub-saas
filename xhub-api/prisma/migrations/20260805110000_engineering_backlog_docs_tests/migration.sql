-- Engineering Governance: DG-02 (Feature/BacklogItem), DG-03-lite
-- (EngineeringDocument), DG-04-lite (TestSuite/TestCase/TestResult) —
-- 2026-08-05. Platform-wide, no RLS (see
-- docs/implementation/engineering-hub/ADR_SCOPE_MODEL.md).
-- CreateTable
CREATE TABLE "Feature" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "targetVersionId" TEXT,
    "standardsRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "sourceSystem" TEXT NOT NULL DEFAULT 'xhub-saas',
    "correlationId" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacklogItem" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "featureId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TASK',
    "status" TEXT NOT NULL DEFAULT 'IDEA',
    "priority" TEXT NOT NULL DEFAULT 'P2',
    "targetVersionId" TEXT,
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "sourceSystem" TEXT NOT NULL DEFAULT 'xhub-saas',
    "sourceRef" TEXT,
    "correlationId" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacklogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngineeringDocument" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'OTHER',
    "ownershipMode" TEXT NOT NULL DEFAULT 'XHUB_OWNED',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "classification" TEXT NOT NULL DEFAULT 'INTERNAL',
    "body" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "standardsRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ownerRole" TEXT,
    "reviewDueAt" TIMESTAMP(3),
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "sourceSystem" TEXT NOT NULL DEFAULT 'xhub-saas',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngineeringDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSuite" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestSuite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "testSuiteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "expectedResult" TEXT,
    "deepLinkTemplate" TEXT,
    "externalLegacyCode" TEXT,
    "level" TEXT NOT NULL DEFAULT 'UAT',
    "requiredForRelease" BOOLEAN NOT NULL DEFAULT false,
    "standardsRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "productVersionId" TEXT,
    "status" TEXT NOT NULL,
    "actualResult" TEXT,
    "notes" TEXT,
    "environment" TEXT,
    "testerUserId" TEXT,
    "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Feature_code_key" ON "Feature"("code");
-- CreateIndex
CREATE INDEX "Feature_productId_idx" ON "Feature"("productId");
-- CreateIndex
CREATE UNIQUE INDEX "BacklogItem_code_key" ON "BacklogItem"("code");
-- CreateIndex
CREATE INDEX "BacklogItem_productId_idx" ON "BacklogItem"("productId");
-- CreateIndex
CREATE INDEX "BacklogItem_productId_status_idx" ON "BacklogItem"("productId", "status");
-- CreateIndex
CREATE INDEX "BacklogItem_featureId_idx" ON "BacklogItem"("featureId");
-- CreateIndex
CREATE UNIQUE INDEX "EngineeringDocument_code_key" ON "EngineeringDocument"("code");
-- CreateIndex
CREATE INDEX "EngineeringDocument_productId_idx" ON "EngineeringDocument"("productId");
-- CreateIndex
CREATE INDEX "EngineeringDocument_productId_documentType_idx" ON "EngineeringDocument"("productId", "documentType");
-- CreateIndex
CREATE INDEX "TestSuite_productId_idx" ON "TestSuite"("productId");
-- CreateIndex
CREATE UNIQUE INDEX "TestSuite_productId_name_key" ON "TestSuite"("productId", "name");
-- CreateIndex
CREATE UNIQUE INDEX "TestCase_code_key" ON "TestCase"("code");
-- CreateIndex
CREATE INDEX "TestCase_testSuiteId_idx" ON "TestCase"("testSuiteId");
-- CreateIndex
CREATE INDEX "TestResult_testCaseId_idx" ON "TestResult"("testCaseId");
-- CreateIndex
CREATE INDEX "TestResult_testCaseId_testedAt_idx" ON "TestResult"("testCaseId", "testedAt");
-- CreateIndex
CREATE INDEX "TestResult_productVersionId_idx" ON "TestResult"("productVersionId");

-- AddForeignKey
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_targetVersionId_fkey" FOREIGN KEY ("targetVersionId") REFERENCES "ProductVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "BacklogItem" ADD CONSTRAINT "BacklogItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "BacklogItem" ADD CONSTRAINT "BacklogItem_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "BacklogItem" ADD CONSTRAINT "BacklogItem_targetVersionId_fkey" FOREIGN KEY ("targetVersionId") REFERENCES "ProductVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "EngineeringDocument" ADD CONSTRAINT "EngineeringDocument_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "TestSuite" ADD CONSTRAINT "TestSuite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_testSuiteId_fkey" FOREIGN KEY ("testSuiteId") REFERENCES "TestSuite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
