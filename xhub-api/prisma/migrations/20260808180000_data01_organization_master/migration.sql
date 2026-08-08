-- DATA-01 (Wave A) — VN Property Management Company Master.
-- See docs/data01/*.md. Generated via schema-to-schema diff (same
-- technique as 20260808160000_geo_provider_master) — the live dev DB
-- has pre-existing drift vs migration history that blocks plain
-- 'prisma migrate dev'. This file is the DATA-01-only tail of a diff
-- that also re-emitted the already-applied Geo/Provider tables;
-- those lines were stripped.

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "organizationType" TEXT NOT NULL DEFAULT 'PROPERTY_OPERATOR',
    "legalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "shortName" TEXT,
    "taxCode" TEXT,
    "legalForm" TEXT,
    "companyStatus" TEXT,
    "legalAddress" TEXT,
    "officeAddress" TEXT,
    "provinceCode" TEXT,
    "districtCode" TEXT,
    "website" TEXT,
    "generalEmail" TEXT,
    "salesEmail" TEXT,
    "companyPhone" TEXT,
    "hotline" TEXT,
    "corporateSocials" JSONB,
    "operatorType" TEXT,
    "serviceRegions" JSONB,
    "observedProjectCount" INTEGER,
    "dataConfidence" DOUBLE PRECISION,
    "freshnessScore" DOUBLE PRECISION,
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationAlias" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "aliasType" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "sourceEvidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationQualificationEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "eventType" TEXT NOT NULL,
    "authority" TEXT,
    "documentNo" TEXT,
    "documentDate" TIMESTAMP(3),
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "qualificationStatus" TEXT,
    "rawLegalName" TEXT,
    "rawTaxCode" TEXT,
    "rawAddress" TEXT,
    "rawRepresentativeName" TEXT,
    "rawRepresentativeTitle" TEXT,
    "sourceEvidenceId" TEXT,
    "sourceUrl" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parserVersion" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationQualificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationQualification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "qualificationType" TEXT NOT NULL DEFAULT 'CONDOMINIUM_OPERATION_MANAGEMENT',
    "authority" TEXT,
    "documentNo" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "daysToExpiry" INTEGER,
    "renewalStatus" TEXT,
    "lastReverifiedAt" TIMESTAMP(3),
    "sourceEvidenceId" TEXT,
    "derivedFromEventId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationFieldObservation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "value" TEXT,
    "sourceType" TEXT,
    "sourceUrl" TEXT,
    "sourceHash" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'NOT_FOUND',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationFieldObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationLocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "locationType" TEXT NOT NULL,
    "addressRaw" TEXT,
    "addressNormalized" TEXT,
    "provinceCode" TEXT,
    "wardCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "sourceEvidenceId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "personIdentityKey" TEXT,
    "identityConfidence" DOUBLE PRECISION,
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonCompanyRole" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roleType" TEXT NOT NULL,
    "roleTitleRaw" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OBSERVED',
    "sourceEvidenceId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonCompanyRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectOrganizationRelation" (
    "id" TEXT NOT NULL,
    "globalProjectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL DEFAULT 'PROPERTY_MANAGER',
    "relationshipStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "evidenceType" TEXT,
    "sourceEvidenceId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectOrganizationRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgImportJob" (
    "id" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'ORGANIZATION',
    "stage" TEXT NOT NULL DEFAULT 'staging',
    "runLabel" TEXT,
    "counts" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgSourceRecord" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'ORGANIZATION',
    "raw" JSONB NOT NULL,
    "rawHash" TEXT,
    "normalized" JSONB,
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "matchScore" DOUBLE PRECISION,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgSourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgDuplicatePair" (
    "id" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "candidateOrganizationId" TEXT,
    "importJobId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'pending',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgDuplicatePair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_taxCode_key" ON "Organization"("taxCode");

-- CreateIndex
CREATE INDEX "Organization_normalizedName_idx" ON "Organization"("normalizedName");

-- CreateIndex
CREATE INDEX "Organization_organizationType_idx" ON "Organization"("organizationType");

-- CreateIndex
CREATE INDEX "OrganizationAlias_organizationId_idx" ON "OrganizationAlias"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationQualificationEvent_organizationId_idx" ON "OrganizationQualificationEvent"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationQualificationEvent_eventType_idx" ON "OrganizationQualificationEvent"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationQualification_organizationId_key" ON "OrganizationQualification"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationFieldObservation_organizationId_fieldName_idx" ON "OrganizationFieldObservation"("organizationId", "fieldName");

-- CreateIndex
CREATE INDEX "OrganizationLocation_organizationId_locationType_idx" ON "OrganizationLocation"("organizationId", "locationType");

-- CreateIndex
CREATE UNIQUE INDEX "Person_personIdentityKey_key" ON "Person"("personIdentityKey");

-- CreateIndex
CREATE INDEX "Person_normalizedName_idx" ON "Person"("normalizedName");

-- CreateIndex
CREATE INDEX "PersonCompanyRole_personId_idx" ON "PersonCompanyRole"("personId");

-- CreateIndex
CREATE INDEX "PersonCompanyRole_organizationId_idx" ON "PersonCompanyRole"("organizationId");

-- CreateIndex
CREATE INDEX "ProjectOrganizationRelation_organizationId_idx" ON "ProjectOrganizationRelation"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectOrganizationRelation_globalProjectId_organizationId__key" ON "ProjectOrganizationRelation"("globalProjectId", "organizationId", "relationshipType");

-- CreateIndex
CREATE INDEX "OrgSourceRecord_importJobId_idx" ON "OrgSourceRecord"("importJobId");

-- CreateIndex
CREATE INDEX "OrgSourceRecord_matchStatus_idx" ON "OrgSourceRecord"("matchStatus");

-- CreateIndex
CREATE UNIQUE INDEX "OrgSourceRecord_sourceSystem_sourceId_key" ON "OrgSourceRecord"("sourceSystem", "sourceId");

-- CreateIndex
CREATE INDEX "OrgDuplicatePair_decision_idx" ON "OrgDuplicatePair"("decision");

-- AddForeignKey
ALTER TABLE "OrganizationAlias" ADD CONSTRAINT "OrganizationAlias_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationQualificationEvent" ADD CONSTRAINT "OrganizationQualificationEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationQualification" ADD CONSTRAINT "OrganizationQualification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationFieldObservation" ADD CONSTRAINT "OrganizationFieldObservation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationLocation" ADD CONSTRAINT "OrganizationLocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonCompanyRole" ADD CONSTRAINT "PersonCompanyRole_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonCompanyRole" ADD CONSTRAINT "PersonCompanyRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectOrganizationRelation" ADD CONSTRAINT "ProjectOrganizationRelation_globalProjectId_fkey" FOREIGN KEY ("globalProjectId") REFERENCES "GlobalProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectOrganizationRelation" ADD CONSTRAINT "ProjectOrganizationRelation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgSourceRecord" ADD CONSTRAINT "OrgSourceRecord_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "OrgImportJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

