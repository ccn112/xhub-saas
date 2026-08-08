-- DATA-02 (Building Service Contractor) + DATA-03 (Equipment/Product) +
-- DATA-04 (Project Supply & Vendor Graph) — Wave A, all in one migration.
-- See docs/data02/, docs/data03/, docs/data04/. Generated via the same
-- schema-to-schema diff technique as the two migrations before it today
-- (live dev DB drift blocks plain 'prisma migrate dev'); the redundant
-- re-emitted CREATE TABLE/INDEX/FK for already-applied Geo/DATA-01
-- tables were stripped by hand.

-- Organization.researchStatus (DATA-02's research-vetting vocabulary,
-- separate from OrganizationQualification.status which is the license
-- state) — plain column add on the existing table.
ALTER TABLE "Organization" ADD COLUMN "researchStatus" TEXT;

CREATE TABLE "ServiceCapability" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "sourceEvidenceId" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentProduct" (
    "id" TEXT NOT NULL,
    "manufacturerOrgId" TEXT,
    "categoryCode" TEXT NOT NULL,
    "familyName" TEXT,
    "modelCode" TEXT,
    "sku" TEXT,
    "productType" TEXT,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "launchDate" TIMESTAMP(3),
    "eolDate" TIMESTAMP(3),
    "replacementProductId" TEXT,
    "officialProductUrl" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "dataConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSpec" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "specKey" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "unit" TEXT,
    "sourceEvidenceId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationProductRelation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT,
    "categoryCode" TEXT,
    "relationType" TEXT NOT NULL,
    "authorizationStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "regionScope" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "sourceEvidenceId" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationProductRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePart" (
    "id" TEXT NOT NULL,
    "brandOrgId" TEXT,
    "partNumber" TEXT,
    "partName" TEXT NOT NULL,
    "componentType" TEXT,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "officialUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SparePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePartCompatibility" (
    "id" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "modelVariant" TEXT,
    "serialFrom" TEXT,
    "serialTo" TEXT,
    "sourceEvidenceId" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SparePartCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPriceObservation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "organizationId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "priceScope" TEXT NOT NULL,
    "vatIncluded" BOOLEAN,
    "installationIncluded" BOOLEAN,
    "shippingIncluded" BOOLEAN,
    "minimumQuantity" INTEGER,
    "sourceUrl" TEXT,
    "sourceVintage" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPriceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectInstalledProduct" (
    "id" TEXT NOT NULL,
    "globalProjectId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierOrgId" TEXT,
    "installerOrgId" TEXT,
    "maintainerOrgId" TEXT,
    "tower" TEXT,
    "system" TEXT,
    "quantity" INTEGER,
    "installedAt" TIMESTAMP(3),
    "commissionedAt" TIMESTAMP(3),
    "sourceEvidenceId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectInstalledProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMedia" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceWebsite" TEXT,
    "logoSourcePage" TEXT,
    "remoteImageUrl" TEXT,
    "imageType" TEXT NOT NULL,
    "sourceTier" TEXT,
    "retrievedAt" TIMESTAMP(3),
    "contentHash" TEXT,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "localMediaPath" TEXT,
    "attribution" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCandidate" (
    "id" TEXT NOT NULL,
    "candidateCode" TEXT NOT NULL,
    "projectNameRaw" TEXT NOT NULL,
    "projectNormalized" TEXT NOT NULL,
    "parentCandidateId" TEXT,
    "province" TEXT,
    "developer" TEXT,
    "projectType" TEXT,
    "primaryEvidenceUrl" TEXT,
    "matchStatus" TEXT NOT NULL DEFAULT 'PENDING_XHUB_MATCH',
    "matchedGlobalProjectId" TEXT,
    "edgeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectGraphEdge" (
    "id" TEXT NOT NULL,
    "projectCandidateId" TEXT NOT NULL,
    "organizationId" TEXT,
    "productId" TEXT,
    "rawProviderName" TEXT,
    "originData" TEXT,
    "relationshipType" TEXT NOT NULL,
    "serviceCategory" TEXT,
    "brand" TEXT,
    "modelProduct" TEXT,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "scopeText" TEXT,
    "contractFrom" TIMESTAMP(3),
    "contractTo" TIMESTAMP(3),
    "relationshipStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "contractValue" DOUBLE PRECISION,
    "contractValueCurrency" TEXT,
    "valueQualifier" TEXT,
    "evidenceTier" TEXT,
    "evidenceUrl" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectGraphEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectHierarchyRelation" (
    "id" TEXT NOT NULL,
    "parentCandidateId" TEXT NOT NULL,
    "childCandidateId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "sourceEvidenceId" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectHierarchyRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSupplyGap" (
    "id" TEXT NOT NULL,
    "projectCandidateId" TEXT NOT NULL,
    "category" TEXT,
    "knownFact" TEXT,
    "missingEntityType" TEXT,
    "researchPriority" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "evidenceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSupplyGap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceCapability_categoryCode_idx" ON "ServiceCapability"("categoryCode");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCapability_organizationId_categoryCode_key" ON "ServiceCapability"("organizationId", "categoryCode");

-- CreateIndex
CREATE INDEX "EquipmentProduct_categoryCode_idx" ON "EquipmentProduct"("categoryCode");

-- CreateIndex
CREATE INDEX "EquipmentProduct_manufacturerOrgId_idx" ON "EquipmentProduct"("manufacturerOrgId");

-- CreateIndex
CREATE INDEX "ProductSpec_productId_idx" ON "ProductSpec"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSpec_productId_specKey_key" ON "ProductSpec"("productId", "specKey");

-- CreateIndex
CREATE INDEX "OrganizationProductRelation_organizationId_idx" ON "OrganizationProductRelation"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationProductRelation_productId_idx" ON "OrganizationProductRelation"("productId");

-- CreateIndex
CREATE INDEX "SparePart_brandOrgId_idx" ON "SparePart"("brandOrgId");

-- CreateIndex
CREATE INDEX "SparePartCompatibility_sparePartId_idx" ON "SparePartCompatibility"("sparePartId");

-- CreateIndex
CREATE INDEX "SparePartCompatibility_productId_idx" ON "SparePartCompatibility"("productId");

-- CreateIndex
CREATE INDEX "ProductPriceObservation_productId_idx" ON "ProductPriceObservation"("productId");

-- CreateIndex
CREATE INDEX "ProductPriceObservation_productId_observedAt_idx" ON "ProductPriceObservation"("productId", "observedAt");

-- CreateIndex
CREATE INDEX "ProjectInstalledProduct_globalProjectId_idx" ON "ProjectInstalledProduct"("globalProjectId");

-- CreateIndex
CREATE INDEX "ProjectInstalledProduct_productId_idx" ON "ProjectInstalledProduct"("productId");

-- CreateIndex
CREATE INDEX "OrganizationMedia_organizationId_idx" ON "OrganizationMedia"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCandidate_candidateCode_key" ON "ProjectCandidate"("candidateCode");

-- CreateIndex
CREATE INDEX "ProjectCandidate_matchStatus_idx" ON "ProjectCandidate"("matchStatus");

-- CreateIndex
CREATE INDEX "ProjectCandidate_projectNormalized_idx" ON "ProjectCandidate"("projectNormalized");

-- CreateIndex
CREATE INDEX "ProjectGraphEdge_projectCandidateId_idx" ON "ProjectGraphEdge"("projectCandidateId");

-- CreateIndex
CREATE INDEX "ProjectGraphEdge_organizationId_idx" ON "ProjectGraphEdge"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectHierarchyRelation_parentCandidateId_childCandidateId_key" ON "ProjectHierarchyRelation"("parentCandidateId", "childCandidateId");

-- CreateIndex
CREATE INDEX "ProjectSupplyGap_status_idx" ON "ProjectSupplyGap"("status");

-- AddForeignKey
ALTER TABLE "ServiceCapability" ADD CONSTRAINT "ServiceCapability_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentProduct" ADD CONSTRAINT "EquipmentProduct_manufacturerOrgId_fkey" FOREIGN KEY ("manufacturerOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentProduct" ADD CONSTRAINT "EquipmentProduct_replacementProductId_fkey" FOREIGN KEY ("replacementProductId") REFERENCES "EquipmentProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSpec" ADD CONSTRAINT "ProductSpec_productId_fkey" FOREIGN KEY ("productId") REFERENCES "EquipmentProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationProductRelation" ADD CONSTRAINT "OrganizationProductRelation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationProductRelation" ADD CONSTRAINT "OrganizationProductRelation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "EquipmentProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePart" ADD CONSTRAINT "SparePart_brandOrgId_fkey" FOREIGN KEY ("brandOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePartCompatibility" ADD CONSTRAINT "SparePartCompatibility_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePartCompatibility" ADD CONSTRAINT "SparePartCompatibility_productId_fkey" FOREIGN KEY ("productId") REFERENCES "EquipmentProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPriceObservation" ADD CONSTRAINT "ProductPriceObservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "EquipmentProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPriceObservation" ADD CONSTRAINT "ProductPriceObservation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInstalledProduct" ADD CONSTRAINT "ProjectInstalledProduct_globalProjectId_fkey" FOREIGN KEY ("globalProjectId") REFERENCES "GlobalProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInstalledProduct" ADD CONSTRAINT "ProjectInstalledProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "EquipmentProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInstalledProduct" ADD CONSTRAINT "ProjectInstalledProduct_supplierOrgId_fkey" FOREIGN KEY ("supplierOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInstalledProduct" ADD CONSTRAINT "ProjectInstalledProduct_installerOrgId_fkey" FOREIGN KEY ("installerOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInstalledProduct" ADD CONSTRAINT "ProjectInstalledProduct_maintainerOrgId_fkey" FOREIGN KEY ("maintainerOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMedia" ADD CONSTRAINT "OrganizationMedia_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCandidate" ADD CONSTRAINT "ProjectCandidate_parentCandidateId_fkey" FOREIGN KEY ("parentCandidateId") REFERENCES "ProjectCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCandidate" ADD CONSTRAINT "ProjectCandidate_matchedGlobalProjectId_fkey" FOREIGN KEY ("matchedGlobalProjectId") REFERENCES "GlobalProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectGraphEdge" ADD CONSTRAINT "ProjectGraphEdge_projectCandidateId_fkey" FOREIGN KEY ("projectCandidateId") REFERENCES "ProjectCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectGraphEdge" ADD CONSTRAINT "ProjectGraphEdge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectGraphEdge" ADD CONSTRAINT "ProjectGraphEdge_productId_fkey" FOREIGN KEY ("productId") REFERENCES "EquipmentProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectHierarchyRelation" ADD CONSTRAINT "ProjectHierarchyRelation_parentCandidateId_fkey" FOREIGN KEY ("parentCandidateId") REFERENCES "ProjectCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectHierarchyRelation" ADD CONSTRAINT "ProjectHierarchyRelation_childCandidateId_fkey" FOREIGN KEY ("childCandidateId") REFERENCES "ProjectCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSupplyGap" ADD CONSTRAINT "ProjectSupplyGap_projectCandidateId_fkey" FOREIGN KEY ("projectCandidateId") REFERENCES "ProjectCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

