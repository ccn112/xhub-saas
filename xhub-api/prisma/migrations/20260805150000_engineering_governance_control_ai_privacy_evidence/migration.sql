-- Engineering Governance: DG-09 (Unified Control Framework), DG-10 (AI
-- Governance), DG-11 (Privacy/DPIA), DG-12-lite (Evidence Ledger) —
-- 2026-08-05. Platform-wide, no RLS (see
-- docs/implementation/engineering-hub/ADR_SCOPE_MODEL.md). Additive layer
-- per ADR_GOVERNANCE_RECONCILIATION.md — does not touch Product/Backlog/
-- Version/Test/Defect.
-- CreateTable
CREATE TABLE "Control" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "frameworkFamilies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Control_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlImplementation" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "evidenceRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlImplementation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AISystem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT,
    "provider" TEXT,
    "riskTier" TEXT NOT NULL DEFAULT 'MINIMAL',
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "humanOversight" TEXT,
    "standardsRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AISystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIImpactAssessment" (
    "id" TEXT NOT NULL,
    "aiSystemId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "risksIdentified" TEXT,
    "mitigations" TEXT,
    "approverRole" TEXT,
    "approvedAt" TIMESTAMP(3),
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIImpactAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingActivity" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT,
    "dataCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "legalBasis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "standardsRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyImpactAssessment" (
    "id" TEXT NOT NULL,
    "processingActivityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "risksIdentified" TEXT,
    "mitigations" TEXT,
    "approverRole" TEXT,
    "approvedAt" TIMESTAMP(3),
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyImpactAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'E1_DECLARED',
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceRef" TEXT,
    "recordedBy" TEXT,
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Control_code_key" ON "Control"("code");
-- CreateIndex
CREATE INDEX "Control_domain_idx" ON "Control"("domain");
-- CreateIndex
CREATE INDEX "ControlImplementation_productId_idx" ON "ControlImplementation"("productId");
-- CreateIndex
CREATE INDEX "ControlImplementation_controlId_idx" ON "ControlImplementation"("controlId");
-- CreateIndex
CREATE UNIQUE INDEX "ControlImplementation_controlId_productId_key" ON "ControlImplementation"("controlId", "productId");
-- CreateIndex
CREATE UNIQUE INDEX "AISystem_code_key" ON "AISystem"("code");
-- CreateIndex
CREATE INDEX "AISystem_productId_idx" ON "AISystem"("productId");
-- CreateIndex
CREATE INDEX "AIImpactAssessment_aiSystemId_idx" ON "AIImpactAssessment"("aiSystemId");
-- CreateIndex
CREATE UNIQUE INDEX "ProcessingActivity_code_key" ON "ProcessingActivity"("code");
-- CreateIndex
CREATE INDEX "ProcessingActivity_productId_idx" ON "ProcessingActivity"("productId");
-- CreateIndex
CREATE INDEX "PrivacyImpactAssessment_processingActivityId_idx" ON "PrivacyImpactAssessment"("processingActivityId");
-- CreateIndex
CREATE UNIQUE INDEX "Evidence_code_key" ON "Evidence"("code");
-- CreateIndex
CREATE INDEX "Evidence_subjectType_subjectId_idx" ON "Evidence"("subjectType", "subjectId");

-- AddForeignKey
ALTER TABLE "ControlImplementation" ADD CONSTRAINT "ControlImplementation_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ControlImplementation" ADD CONSTRAINT "ControlImplementation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "AISystem" ADD CONSTRAINT "AISystem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "AIImpactAssessment" ADD CONSTRAINT "AIImpactAssessment_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AISystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ProcessingActivity" ADD CONSTRAINT "ProcessingActivity_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PrivacyImpactAssessment" ADD CONSTRAINT "PrivacyImpactAssessment_processingActivityId_fkey" FOREIGN KEY ("processingActivityId") REFERENCES "ProcessingActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
