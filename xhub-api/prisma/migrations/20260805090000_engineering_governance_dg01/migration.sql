-- Engineering Governance DG-01 (2026-08-05): Product/Version registry core.
-- Platform-wide, not tenant-scoped — deliberately excluded from RLS
-- TENANT_TABLES (see docs/implementation/engineering-hub/ADR_SCOPE_MODEL.md).
-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SAAS_PRODUCT',
    "ownerRole" TEXT,
    "versionPolicy" TEXT NOT NULL DEFAULT 'SEMVER',
    "description" TEXT,
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "rolloutOrder" INTEGER,
    "sourceSystem" TEXT NOT NULL DEFAULT 'xhub-saas',
    "sourceRef" TEXT,
    "correlationId" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductComponent" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL DEFAULT 'SERVICE',
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryConnection" (
    "id" TEXT NOT NULL,
    "productComponentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'GITHUB',
    "repoFullName" TEXT,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "connectorStatus" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepositoryConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseTrain" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cadence" TEXT,
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseTrain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVersion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "releaseTrainId" TEXT,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "releaseChannel" TEXT,
    "releasedAt" TIMESTAMP(3),
    "scopeType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "sourceSystem" TEXT NOT NULL DEFAULT 'xhub-saas',
    "sourceRef" TEXT,
    "correlationId" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "Product_type_idx" ON "Product"("type");

-- CreateIndex
CREATE INDEX "ProductComponent_productId_idx" ON "ProductComponent"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductComponent_productId_code_key" ON "ProductComponent"("productId", "code");

-- CreateIndex
CREATE INDEX "RepositoryConnection_productComponentId_idx" ON "RepositoryConnection"("productComponentId");

-- CreateIndex
CREATE INDEX "Environment_productId_idx" ON "Environment"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Environment_productId_name_key" ON "Environment"("productId", "name");

-- CreateIndex
CREATE INDEX "ReleaseTrain_productId_idx" ON "ReleaseTrain"("productId");

-- CreateIndex
CREATE INDEX "ProductVersion_productId_idx" ON "ProductVersion"("productId");

-- CreateIndex
CREATE INDEX "ProductVersion_productId_status_idx" ON "ProductVersion"("productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVersion_productId_version_key" ON "ProductVersion"("productId", "version");

-- AddForeignKey
ALTER TABLE "ProductComponent" ADD CONSTRAINT "ProductComponent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryConnection" ADD CONSTRAINT "RepositoryConnection_productComponentId_fkey" FOREIGN KEY ("productComponentId") REFERENCES "ProductComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseTrain" ADD CONSTRAINT "ReleaseTrain_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_releaseTrainId_fkey" FOREIGN KEY ("releaseTrainId") REFERENCES "ReleaseTrain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
