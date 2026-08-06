-- CreateTable
CREATE TABLE "SupportCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "productCode" TEXT NOT NULL,
    "customerId" TEXT,
    "customerTenantRef" TEXT,
    "requesterName" TEXT,
    "requesterContact" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'OTHER',
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "assigneeId" TEXT,
    "escalationType" TEXT,
    "escalatedItemId" TEXT,
    "escalatedItemCode" TEXT,
    "idempotencyKey" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportCaseEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supportCaseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportCaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportCase_tenantId_status_idx" ON "SupportCase"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SupportCase_tenantId_productCode_idx" ON "SupportCase"("tenantId", "productCode");

-- CreateIndex
CREATE INDEX "SupportCase_tenantId_assigneeId_idx" ON "SupportCase"("tenantId", "assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportCase_tenantId_code_key" ON "SupportCase"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SupportCase_tenantId_idempotencyKey_key" ON "SupportCase"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SupportCaseEvent_tenantId_supportCaseId_idx" ON "SupportCaseEvent"("tenantId", "supportCaseId");

-- AddForeignKey
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportCaseEvent" ADD CONSTRAINT "SupportCaseEvent_supportCaseId_fkey" FOREIGN KEY ("supportCaseId") REFERENCES "SupportCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

