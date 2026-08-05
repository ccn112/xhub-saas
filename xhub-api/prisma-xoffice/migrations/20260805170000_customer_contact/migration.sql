-- Phase 2 — Revenue & Contract MVP, slice 1 (BO-0201): Customer/Contact
-- account model + 360 view — 2026-08-05. Tenant-scoped (RLS applied
-- separately via scripts/rls-setup-xoffice.mjs).
-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "canonicalCustomerId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROSPECT',
    "ownerIdentityId" TEXT,
    "industryCode" TEXT,
    "privacyClass" TEXT,
    "taxCode" TEXT,
    "addressLine" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "contactPreference" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consentEvidenceRef" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_tenantId_code_key" ON "Customer"("tenantId", "code");
-- CreateIndex
CREATE UNIQUE INDEX "Customer_tenantId_idempotencyKey_key" ON "Customer"("tenantId", "idempotencyKey");
-- CreateIndex
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");
-- CreateIndex
CREATE INDEX "Customer_tenantId_status_idx" ON "Customer"("tenantId", "status");
-- CreateIndex
CREATE INDEX "Contact_tenantId_idx" ON "Contact"("tenantId");
-- CreateIndex
CREATE INDEX "Contact_tenantId_customerId_idx" ON "Contact"("tenantId", "customerId");
-- CreateIndex
CREATE INDEX "CustomerEvent_tenantId_customerId_idx" ON "CustomerEvent"("tenantId", "customerId");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CustomerEvent" ADD CONSTRAINT "CustomerEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
