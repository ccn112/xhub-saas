-- Phase 2 — Revenue & Contract MVP, slices 2-8 (BO-0202..0209) — 2026-08-05.
-- Tenant-scoped (RLS applied separately via scripts/rls-setup-xoffice.mjs).
-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'LEAD',
    "expectedAmount" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "probability" DOUBLE PRECISION,
    "expectedCloseDate" TIMESTAMP(3),
    "ownerIdentityId" TEXT,
    "lostReason" TEXT,
    "idempotencyKey" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialCatalogItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commercialType" TEXT NOT NULL,
    "xhubAppCatalogRef" TEXT,
    "priceModel" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalAmount" TEXT NOT NULL DEFAULT '0',
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "validUntil" TIMESTAMP(3),
    "approvalInstanceId" TEXT,
    "documentRecordId" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" TEXT NOT NULL,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineTotal" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "sourceOpportunityId" TEXT,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "totalAmount" TEXT NOT NULL DEFAULT '0',
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "recordId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "deliveryMethod" TEXT NOT NULL,
    "billingMethod" TEXT NOT NULL,
    "lineValue" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "acceptanceRequired" BOOLEAN NOT NULL DEFAULT false,
    "projectTemplateCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractSignature" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MOCK',
    "envelopeRef" TEXT NOT NULL,
    "documentHash" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "signerName" TEXT,
    "createdBy" TEXT,

    CONSTRAINT "ContractSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractObligation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "contractLineId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "ownerIdentityId" TEXT,
    "billingPercent" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "evidenceRef" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "contractLineId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requestedAmount" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "idempotencyKey" TEXT NOT NULL,
    "finerpDocumentRef" TEXT,
    "blockers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_tenantId_idempotencyKey_key" ON "Opportunity"("tenantId", "idempotencyKey");
-- CreateIndex
CREATE INDEX "Opportunity_tenantId_idx" ON "Opportunity"("tenantId");
-- CreateIndex
CREATE INDEX "Opportunity_tenantId_stage_idx" ON "Opportunity"("tenantId", "stage");
-- CreateIndex
CREATE INDEX "Opportunity_customerId_idx" ON "Opportunity"("customerId");
-- CreateIndex
CREATE INDEX "OpportunityEvent_tenantId_opportunityId_idx" ON "OpportunityEvent"("tenantId", "opportunityId");
-- CreateIndex
CREATE UNIQUE INDEX "CommercialCatalogItem_tenantId_code_key" ON "CommercialCatalogItem"("tenantId", "code");
-- CreateIndex
CREATE INDEX "CommercialCatalogItem_tenantId_idx" ON "CommercialCatalogItem"("tenantId");
-- CreateIndex
CREATE UNIQUE INDEX "Proposal_tenantId_opportunityId_version_key" ON "Proposal"("tenantId", "opportunityId", "version");
-- CreateIndex
CREATE INDEX "Proposal_tenantId_idx" ON "Proposal"("tenantId");
-- CreateIndex
CREATE INDEX "Proposal_opportunityId_idx" ON "Proposal"("opportunityId");
-- CreateIndex
CREATE INDEX "ProposalLine_tenantId_proposalId_idx" ON "ProposalLine"("tenantId", "proposalId");
-- CreateIndex
CREATE INDEX "ProposalEvent_tenantId_proposalId_idx" ON "ProposalEvent"("tenantId", "proposalId");
-- CreateIndex
CREATE UNIQUE INDEX "Contract_tenantId_contractNo_key" ON "Contract"("tenantId", "contractNo");
-- CreateIndex
CREATE INDEX "Contract_tenantId_idx" ON "Contract"("tenantId");
-- CreateIndex
CREATE INDEX "Contract_tenantId_status_idx" ON "Contract"("tenantId", "status");
-- CreateIndex
CREATE INDEX "Contract_customerId_idx" ON "Contract"("customerId");
-- CreateIndex
CREATE INDEX "ContractLine_tenantId_contractId_idx" ON "ContractLine"("tenantId", "contractId");
-- CreateIndex
CREATE INDEX "ContractSignature_tenantId_contractId_idx" ON "ContractSignature"("tenantId", "contractId");
-- CreateIndex
CREATE INDEX "ContractObligation_tenantId_contractId_idx" ON "ContractObligation"("tenantId", "contractId");
-- CreateIndex
CREATE INDEX "ContractObligation_tenantId_status_idx" ON "ContractObligation"("tenantId", "status");
-- CreateIndex
CREATE UNIQUE INDEX "BillingRequest_tenantId_idempotencyKey_key" ON "BillingRequest"("tenantId", "idempotencyKey");
-- CreateIndex
CREATE INDEX "BillingRequest_tenantId_contractId_idx" ON "BillingRequest"("tenantId", "contractId");
-- CreateIndex
CREATE INDEX "BillingRequest_tenantId_status_idx" ON "BillingRequest"("tenantId", "status");
-- CreateIndex
CREATE INDEX "ContractEvent_tenantId_contractId_idx" ON "ContractEvent"("tenantId", "contractId");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "OpportunityEvent" ADD CONSTRAINT "OpportunityEvent_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ProposalLine" ADD CONSTRAINT "ProposalLine_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ProposalLine" ADD CONSTRAINT "ProposalLine_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CommercialCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ProposalEvent" ADD CONSTRAINT "ProposalEvent_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_sourceOpportunityId_fkey" FOREIGN KEY ("sourceOpportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ContractLine" ADD CONSTRAINT "ContractLine_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ContractLine" ADD CONSTRAINT "ContractLine_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CommercialCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ContractSignature" ADD CONSTRAINT "ContractSignature_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ContractObligation" ADD CONSTRAINT "ContractObligation_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ContractEvent" ADD CONSTRAINT "ContractEvent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
