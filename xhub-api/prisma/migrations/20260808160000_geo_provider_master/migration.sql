-- Wave A (Hapulico golden slice) — Geo/Global Project Catalog/Provider Master.
-- See docs/geo-migration/*.md. Generated via schema-to-schema diff (git HEAD
-- schema.prisma vs the edited one) rather than 'prisma migrate dev' because the
-- live dev DB has pre-existing drift vs migration history (unrelated to this
-- change, baselined 2026-08-08 from a pre-Migrate db-push era DB) that would
-- otherwise trigger a destructive 'reset the public schema' prompt.

CREATE EXTENSION IF NOT EXISTS postgis;


-- CreateTable
CREATE TABLE "GlobalProject" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "projectType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "projectStatus" TEXT,
    "description" TEXT,
    "addressText" TEXT,
    "provinceCode" TEXT,
    "districtCode" TEXT,
    "wardCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geom" geography(Point,4326),
    "boundaryGeom" geography(MultiPolygon,4326),
    "developerName" TEXT,
    "website" TEXT,
    "sourceQualityScore" DOUBLE PRECISION,
    "dataConfidence" DOUBLE PRECISION,
    "freshnessScore" DOUBLE PRECISION,
    "lastVerifiedAt" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalProjectSource" (
    "id" TEXT NOT NULL,
    "globalProjectId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceSystem" TEXT,
    "sourceRecordId" TEXT,
    "sourceUrl" TEXT,
    "sourcePayload" JSONB,
    "sourceHash" TEXT,
    "observedAt" TIMESTAMP(3),
    "importJobId" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalProjectSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalEntityLink" (
    "id" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalEntityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "primaryCategoryId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "geom" geography(Point,4326),
    "addressText" TEXT,
    "provinceCode" TEXT,
    "districtCode" TEXT,
    "wardCode" TEXT,
    "phonePrimary" TEXT,
    "websitePrimary" TEXT,
    "emailPrimary" TEXT,
    "operatingStatus" TEXT NOT NULL DEFAULT 'OPEN',
    "dateOpened" TIMESTAMP(3),
    "dateClosed" TIMESTAMP(3),
    "dataConfidence" DOUBLE PRECISION,
    "freshnessScore" DOUBLE PRECISION,
    "lastObservedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceSource" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourcePlaceId" TEXT,
    "sourceUrl" TEXT,
    "sourcePayload" JSONB,
    "sourceHash" TEXT,
    "sourceObservedAt" TIMESTAMP(3),
    "sourceRefreshedAt" TIMESTAMP(3),
    "licenseCode" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "legalName" TEXT,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "providerType" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'DISCOVERED',
    "claimStatus" TEXT NOT NULL DEFAULT 'NONE',
    "partnerStatus" TEXT NOT NULL DEFAULT 'NONE',
    "taxCode" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "description" TEXT,
    "logoAssetId" TEXT,
    "dataConfidence" DOUBLE PRECISION,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderLocation" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "placeId" TEXT,
    "locationName" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geom" geography(Point,4326),
    "phone" TEXT,
    "openingHours" JSONB,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderContact" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "locationId" TEXT,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sourceId" TEXT,
    "observedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "skuExternal" TEXT,
    "unit" TEXT,
    "image" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogPriceObservation" (
    "id" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "providerLocationId" TEXT,
    "priceVndInteger" INTEGER NOT NULL,
    "originalPriceVndInteger" INTEGER,
    "unit" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION,
    "isPromotional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogPriceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalCategoryMapping" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalCategoryId" TEXT NOT NULL,
    "externalCategoryName" TEXT,
    "xhubCategoryId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION DEFAULT 1.0,
    "mappingVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalCategoryMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPlaceEdge" (
    "id" TEXT NOT NULL,
    "globalProjectId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL DEFAULT 'NEARBY',
    "distanceM" DOUBLE PRECISION NOT NULL,
    "insideProject" BOOLEAN NOT NULL DEFAULT false,
    "walkDistanceM" DOUBLE PRECISION,
    "walkDurationS" INTEGER,
    "rankScore" DOUBLE PRECISION,
    "categoryId" TEXT,
    "zone" TEXT NOT NULL,
    "spatialVersion" INTEGER NOT NULL DEFAULT 1,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectPlaceEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderProjectOverlay" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "globalProjectId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "relationship" TEXT,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "bookingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paymentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "voucherEnabled" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderProjectOverlay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataQualityIssue" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "detail" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataQualityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoImportJob" (
    "id" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'PLACE',
    "stage" TEXT NOT NULL DEFAULT 'staging',
    "aoiLabel" TEXT,
    "counts" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoSourceRecord" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'PLACE',
    "raw" JSONB NOT NULL,
    "rawHash" TEXT,
    "normalized" JSONB,
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "matchScore" DOUBLE PRECISION,
    "placeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoSourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoDuplicatePair" (
    "id" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "candidatePlaceId" TEXT,
    "importJobId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'pending',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoDuplicatePair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalProject_code_key" ON "GlobalProject"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalProject_slug_key" ON "GlobalProject"("slug");

-- CreateIndex
CREATE INDEX "GlobalProject_status_idx" ON "GlobalProject"("status");

-- CreateIndex
CREATE INDEX "GlobalProject_provinceCode_districtCode_idx" ON "GlobalProject"("provinceCode", "districtCode");

-- CreateIndex
CREATE INDEX "GlobalProjectSource_globalProjectId_idx" ON "GlobalProjectSource"("globalProjectId");

-- CreateIndex
CREATE INDEX "ExternalEntityLink_canonicalId_idx" ON "ExternalEntityLink"("canonicalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalEntityLink_system_entityType_externalId_key" ON "ExternalEntityLink"("system", "entityType", "externalId");

-- CreateIndex
CREATE INDEX "Place_primaryCategoryId_idx" ON "Place"("primaryCategoryId");

-- CreateIndex
CREATE INDEX "PlaceSource_placeId_idx" ON "PlaceSource"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaceSource_placeId_source_sourcePlaceId_key" ON "PlaceSource"("placeId", "source", "sourcePlaceId");

-- CreateIndex
CREATE INDEX "Provider_verificationStatus_idx" ON "Provider"("verificationStatus");

-- CreateIndex
CREATE INDEX "ProviderLocation_providerId_idx" ON "ProviderLocation"("providerId");

-- CreateIndex
CREATE INDEX "ProviderLocation_placeId_idx" ON "ProviderLocation"("placeId");

-- CreateIndex
CREATE INDEX "ProviderContact_providerId_idx" ON "ProviderContact"("providerId");

-- CreateIndex
CREATE INDEX "ProviderContact_providerId_type_idx" ON "ProviderContact"("providerId", "type");

-- CreateIndex
CREATE INDEX "CatalogItem_providerId_idx" ON "CatalogItem"("providerId");

-- CreateIndex
CREATE INDEX "CatalogPriceObservation_catalogItemId_idx" ON "CatalogPriceObservation"("catalogItemId");

-- CreateIndex
CREATE INDEX "CatalogPriceObservation_catalogItemId_observedAt_idx" ON "CatalogPriceObservation"("catalogItemId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalCategoryMapping_source_externalCategoryId_mappingVe_key" ON "ExternalCategoryMapping"("source", "externalCategoryId", "mappingVersion");

-- CreateIndex
CREATE INDEX "ProjectPlaceEdge_globalProjectId_zone_idx" ON "ProjectPlaceEdge"("globalProjectId", "zone");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPlaceEdge_globalProjectId_placeId_spatialVersion_key" ON "ProjectPlaceEdge"("globalProjectId", "placeId", "spatialVersion");

-- CreateIndex
CREATE INDEX "ProviderProjectOverlay_tenantId_idx" ON "ProviderProjectOverlay"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProjectOverlay_tenantId_globalProjectId_providerId_key" ON "ProviderProjectOverlay"("tenantId", "globalProjectId", "providerId");

-- CreateIndex
CREATE INDEX "DataQualityIssue_subjectType_subjectId_idx" ON "DataQualityIssue"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "DataQualityIssue_status_idx" ON "DataQualityIssue"("status");

-- CreateIndex
CREATE INDEX "GeoSourceRecord_importJobId_idx" ON "GeoSourceRecord"("importJobId");

-- CreateIndex
CREATE INDEX "GeoSourceRecord_matchStatus_idx" ON "GeoSourceRecord"("matchStatus");

-- CreateIndex
CREATE UNIQUE INDEX "GeoSourceRecord_sourceSystem_sourceId_key" ON "GeoSourceRecord"("sourceSystem", "sourceId");

-- CreateIndex
CREATE INDEX "GeoDuplicatePair_decision_idx" ON "GeoDuplicatePair"("decision");

-- AddForeignKey
ALTER TABLE "GlobalProjectSource" ADD CONSTRAINT "GlobalProjectSource_globalProjectId_fkey" FOREIGN KEY ("globalProjectId") REFERENCES "GlobalProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceSource" ADD CONSTRAINT "PlaceSource_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderLocation" ADD CONSTRAINT "ProviderLocation_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderLocation" ADD CONSTRAINT "ProviderLocation_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderContact" ADD CONSTRAINT "ProviderContact_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogPriceObservation" ADD CONSTRAINT "CatalogPriceObservation_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPlaceEdge" ADD CONSTRAINT "ProjectPlaceEdge_globalProjectId_fkey" FOREIGN KEY ("globalProjectId") REFERENCES "GlobalProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPlaceEdge" ADD CONSTRAINT "ProjectPlaceEdge_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderProjectOverlay" ADD CONSTRAINT "ProviderProjectOverlay_globalProjectId_fkey" FOREIGN KEY ("globalProjectId") REFERENCES "GlobalProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderProjectOverlay" ADD CONSTRAINT "ProviderProjectOverlay_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoSourceRecord" ADD CONSTRAINT "GeoSourceRecord_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "GeoImportJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

