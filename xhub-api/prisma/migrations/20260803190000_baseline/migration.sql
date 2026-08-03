-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InstanceStatus" AS ENUM ('running', 'completed', 'rejected');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('open', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantNo" INTEGER,
    "tenantCode" TEXT,
    "tenantKey" TEXT,
    "tenantClass" TEXT,
    "industry" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "planId" TEXT,
    "blueprintId" TEXT,
    "mode" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerRoleCode" TEXT,
    "workingDefinition" JSONB NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowVersion" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "definition" JSONB NOT NULL,
    "compiledPlan" JSONB,

    CONSTRAINT "WorkflowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowNode" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "nodeKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "posX" DOUBLE PRECISION,
    "posY" DOUBLE PRECISION,

    CONSTRAINT "WorkflowNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEdge" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "edgeKey" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "label" TEXT,

    CONSTRAINT "WorkflowEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workflowCode" TEXT NOT NULL,
    "versionId" TEXT,
    "instanceCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "status" "InstanceStatus" NOT NULL DEFAULT 'running',
    "currentNodeId" TEXT,
    "activeNodes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorCommand" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "connectorCode" TEXT NOT NULL,
    "actionCode" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "sourceRef" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectorCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalExecution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "instanceCode" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "connectorCode" TEXT NOT NULL,
    "actionCode" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'MANUAL_TASK',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "referenceCode" TEXT,
    "referenceSystem" TEXT,
    "enteredBy" TEXT,
    "enteredAt" TIMESTAMP(3),
    "sourceRef" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeName" TEXT NOT NULL,
    "assigneeRole" TEXT NOT NULL,
    "assigneeUserId" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'open',
    "slaHours" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actedAt" TIMESTAMP(3),
    "actorId" TEXT,
    "onBehalfOf" TEXT,
    "reminded" BOOLEAN NOT NULL DEFAULT false,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "escalatedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delegation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "fromAt" TIMESTAMP(3) NOT NULL,
    "toAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "sourceSystem" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "deepLink" TEXT,
    "channelHint" TEXT NOT NULL DEFAULT 'in_app',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,
    "instanceCode" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnifiedWorkItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "assignedTo" TEXT,
    "dueAt" TIMESTAMP(3),
    "sourceSystem" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceVersion" TEXT,
    "deepLink" TEXT,
    "ownerSystem" TEXT NOT NULL,
    "allowedActionsSnapshot" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnifiedWorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "commandType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "resultRef" TEXT,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommandLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "externalIdRefs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgUnit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'DEPARTMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "holderPersonId" TEXT,
    "reportsToPositionId" TEXT,
    "isHead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "memberPersonIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleBinding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "roleCode" TEXT NOT NULL,
    "scope" JSONB NOT NULL DEFAULT '{}',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roleCode" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "condition" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataScope" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "scope" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentResolution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workflowInstanceCode" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "selector" JSONB NOT NULL,
    "candidates" JSONB NOT NULL DEFAULT '[]',
    "resolvedPersonId" TEXT,
    "policyVersion" TEXT NOT NULL DEFAULT '1',
    "orgVersion" TEXT NOT NULL DEFAULT '1',
    "choicePolicy" TEXT NOT NULL DEFAULT 'SINGLE',
    "fallbackApplied" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDefinition" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerSystem" TEXT NOT NULL,
    "provisioningMode" TEXT NOT NULL DEFAULT 'MOCK',
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "userSoR" TEXT NOT NULL DEFAULT 'XHUB_IDENTITY_CORE',
    "deepLink" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationDefinition_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "TenantApplicationInstance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enabled',
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantApplicationInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppAccountBinding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "applicationCode" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "externalUsername" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "roleMappingVersion" INTEGER,
    "lastSyncedAt" TIMESTAMP(3),
    "sourceVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppAccountBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppRoleMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationCode" TEXT NOT NULL,
    "xhubRoleCode" TEXT NOT NULL,
    "appRole" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppRoleMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisioningCommand" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "applicationCode" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "result" JSONB,
    "sourceRef" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProvisioningCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisioningConflict" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProvisioningConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "domain" TEXT NOT NULL,
    "canonicalKey" TEXT,
    "canonicalFields" JSONB NOT NULL DEFAULT '{}',
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visibility" TEXT NOT NULL DEFAULT 'SHARED_WITH_VISIBILITY',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "qualityScore" DOUBLE PRECISION,
    "version" INTEGER NOT NULL DEFAULT 1,
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'PROJECT',
    "raw" JSONB NOT NULL,
    "rawHash" TEXT,
    "normalized" JSONB,
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "matchScore" DOUBLE PRECISION,
    "masterRecordId" TEXT,
    "importJobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMasterOverlay" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "masterRecordId" TEXT NOT NULL,
    "overlayFields" JSONB NOT NULL DEFAULT '{}',
    "privateTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ownerUserId" TEXT,
    "visibilityWithinTenant" TEXT NOT NULL DEFAULT 'ALL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantMasterOverlay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'PROJECT',
    "stage" TEXT NOT NULL DEFAULT 'staging',
    "counts" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuplicatePair" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "candidateMasterId" TEXT,
    "importJobId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'pending',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuplicatePair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "kind" TEXT NOT NULL DEFAULT 'LOGICAL_TENANT',
    "manifest" JSONB NOT NULL DEFAULT '{}',
    "checksum" TEXT,
    "outboxWatermark" JSONB,
    "byteSize" INTEGER,
    "location" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "BackupJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestoreJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "kind" TEXT NOT NULL DEFAULT 'FULL_REPLACE_TENANT',
    "mode" TEXT NOT NULL DEFAULT 'dry-run',
    "sourceBackupId" TEXT NOT NULL,
    "targetTenantId" TEXT,
    "manifest" JSONB NOT NULL DEFAULT '{}',
    "checksum" TEXT,
    "outboxWatermark" JSONB,
    "byteSize" INTEGER,
    "location" TEXT,
    "report" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "RestoreJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupSchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "frequency" TEXT NOT NULL DEFAULT 'DAILY',
    "hourUtc" INTEGER NOT NULL DEFAULT 19,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "retentionDays" INTEGER NOT NULL DEFAULT 35,
    "retentionWeeks" INTEGER NOT NULL DEFAULT 12,
    "retentionMonths" INTEGER NOT NULL DEFAULT 12,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "alert" BOOLEAN NOT NULL DEFAULT false,
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'GENERIC',
    "title" TEXT NOT NULL,
    "ownerId" TEXT,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "currentVersionId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "storageKey" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "eventType" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'received',
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'GENERIC',
    "procedureCode" TEXT NOT NULL,
    "procedureName" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "requesterId" TEXT NOT NULL,
    "orgUnitId" TEXT,
    "amount" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'VND',
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "workflowInstanceId" TEXT,
    "approverId" TEXT,
    "approverRole" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestComment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Directive" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "issuerId" TEXT NOT NULL,
    "audienceType" TEXT NOT NULL DEFAULT 'ORG_UNIT',
    "audienceId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "dueAt" TIMESTAMP(3),
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Directive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectiveAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "directiveId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "committedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "progress" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectiveAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectiveEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "directiveId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectiveEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCatalogItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "defaultSlaHours" INTEGER NOT NULL DEFAULT 24,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requesterId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "state" TEXT NOT NULL DEFAULT 'NEW',
    "assigneeId" TEXT,
    "orgUnitId" TEXT,
    "slaDueAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "csatScore" INTEGER,
    "csatComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookableResource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacity" INTEGER,
    "location" TEXT,
    "orgUnitId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookableResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'REQUESTED',
    "attendees" INTEGER,
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "noShow" BOOLEAN NOT NULL DEFAULT false,
    "orgUnitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "authorId" TEXT NOT NULL,
    "audienceType" TEXT NOT NULL DEFAULT 'ALL',
    "audienceId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "requireAck" BOOLEAN NOT NULL DEFAULT false,
    "publishAt" TIMESTAMP(3),
    "expireAt" TIMESTAMP(3),
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "remindCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantLaunch" (
    "id" TEXT NOT NULL,
    "targetTenantId" TEXT NOT NULL,
    "targetTenantNo" INTEGER,
    "blueprintId" TEXT,
    "seedPackId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "currentStepKey" TEXT,
    "request" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "TenantLaunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantLaunchStep" (
    "id" TEXT NOT NULL,
    "launchId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "TenantLaunchStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blueprint" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "inheritsCode" TEXT,
    "appsEnabled" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roleSet" JSONB NOT NULL DEFAULT '[]',
    "orgTemplate" JSONB NOT NULL DEFAULT '{}',
    "workflowSet" JSONB NOT NULL DEFAULT '[]',
    "menuEntitlement" JSONB NOT NULL DEFAULT '{}',
    "compatiblePlans" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "checksum" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Blueprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeedPack" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "blueprintCode" TEXT,
    "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "datasets" JSONB NOT NULL DEFAULT '[]',
    "checksum" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeedPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'CUSTOM',
    "appsAllowed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featureFlags" JSONB NOT NULL DEFAULT '{}',
    "limits" JSONB NOT NULL DEFAULT '{}',
    "priceRef" TEXT,
    "billingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "customerTenantMinNo" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoLiveChecklistTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "scope" TEXT NOT NULL DEFAULT 'GENERIC',
    "blueprintCode" TEXT,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "checksum" TEXT NOT NULL DEFAULT '',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoLiveChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantGoLive" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantGoLive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Engagement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "prospectTenantNo" INTEGER,
    "targetTenantId" TEXT,
    "industry" TEXT,
    "blueprintCode" TEXT,
    "seedPackCode" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'LEAD',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "ownerId" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "notes" TEXT,
    "launchId" TEXT,
    "executionProjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NativeWorkItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "parentId" TEXT,
    "wbsCode" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TASK',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BACKLOG',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "ownerId" TEXT,
    "assigneeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assignmentSnapshot" JSONB,
    "plannedStart" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION,
    "estimateMinutes" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dimensions" JSONB NOT NULL DEFAULT '{}',
    "sourceContext" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NativeWorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemComment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemChecklistItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneBy" TEXT,
    "doneAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkDimension" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "allowedValues" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionProject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectKind" TEXT NOT NULL DEFAULT 'INTERNAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "health" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "progressMethod" TEXT NOT NULL DEFAULT 'TASK_WEIGHTED',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "plannedStart" TIMESTAMP(3),
    "plannedFinish" TIMESTAMP(3),
    "forecastStart" TIMESTAMP(3),
    "forecastFinish" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualFinish" TIMESTAMP(3),
    "ownerId" TEXT,
    "projectManagerId" TEXT,
    "sponsorId" TEXT,
    "orgUnitId" TEXT,
    "canonicalProjectId" TEXT,
    "customerAccountId" TEXT,
    "tenantLaunchId" TEXT,
    "sourceRef" JSONB,
    "currentBaselineVersion" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dimensions" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutionProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionProjectEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionProjectEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkDependency" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "predecessorId" TEXT NOT NULL,
    "successorId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FS',
    "lagMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBaseline" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "plannedStart" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "weight" DOUBLE PRECISION,
    "progressPercent" INTEGER,

    CONSTRAINT "BaselineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRoleAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "visibilityTier" TEXT NOT NULL DEFAULT 'FULL',
    "assignmentSnapshot" JSONB,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoordinationShare" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "audienceType" TEXT NOT NULL,
    "audienceId" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'SUMMARY',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoordinationShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicObjective" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "perspective" TEXT,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewCadence" TEXT,
    "parentObjectiveId" TEXT,
    "linkedMetricIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedInitiativeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategicObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "formula" TEXT NOT NULL,
    "formulaVersion" TEXT,
    "unit" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "dataStewardId" TEXT,
    "sourceSystem" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "freshnessSlaMinutes" INTEGER,
    "classification" TEXT,
    "baseline" DOUBLE PRECISION,
    "target" DOUBLE PRECISION,
    "thresholdRed" DOUBLE PRECISION,
    "thresholdAmber" DOUBLE PRECISION,
    "dimensions" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricObservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessReview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT,
    "type" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "ownerId" TEXT NOT NULL,
    "meetingInstanceId" TEXT,
    "metricObservationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decisionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reviewId" TEXT,
    "question" TEXT NOT NULL,
    "context" TEXT,
    "deciderId" TEXT NOT NULL,
    "recommenderId" TEXT,
    "decision" TEXT NOT NULL,
    "rationale" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "reviewAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "rapid" JSONB NOT NULL DEFAULT '{}',
    "options" JSONB,
    "evidenceRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionCommitment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "decisionId" TEXT,
    "reviewId" TEXT,
    "nativeWorkItemId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scorecard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "perspectives" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scorecard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OKRCycle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OKRCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OKRObjective" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "confidence" DOUBLE PRECISION,
    "strategicObjectiveIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OKRObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyResult" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "okrObjectiveId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "baseline" DOUBLE PRECISION NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "current" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "linkedActionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyResultCheckIn" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keyResultId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION,
    "note" TEXT,
    "authorId" TEXT,
    "evidenceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyResultCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwinSite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwinSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwinFloor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "buildingLabel" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwinFloor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorPlanDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'METER',
    "metersPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "originX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "originY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "underlayAssetId" TEXT,
    "geometry" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "activeVersionNo" INTEGER,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloorPlanDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorPlanVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "FloorPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwinScene" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "floorPlanVersionNo" INTEGER,
    "themeKey" TEXT NOT NULL DEFAULT 'ioc-navy',
    "wallHeightMeters" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "activeVersionNo" INTEGER,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwinScene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneBinding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "bindingType" TEXT NOT NULL DEFAULT 'ORG_UNIT',
    "bindingId" TEXT NOT NULL,
    "iconKey" TEXT,
    "materialKey" TEXT NOT NULL DEFAULT 'status-dynamic',
    "dataLayerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwinSceneVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "TwinSceneVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IconAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BUILT_IN',
    "assetUrl" TEXT,
    "checksum" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sourceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IconAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataLayerDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "aggregation" JSONB NOT NULL,
    "refreshPolicy" TEXT NOT NULL DEFAULT 'ONE_MINUTE',
    "visualMapping" JSONB NOT NULL,
    "sensitivity" TEXT NOT NULL DEFAULT 'AGGREGATE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataLayerDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "viewType" TEXT NOT NULL,
    "sceneId" TEXT,
    "globalFilters" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "widgets" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "activeVersionNo" INTEGER,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "DashboardVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IocTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "twinType" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "floorPlanSpec" JSONB NOT NULL DEFAULT '{}',
    "sceneSpec" JSONB NOT NULL DEFAULT '{}',
    "dataLayerSpecs" JSONB NOT NULL DEFAULT '[]',
    "dashboardSpec" JSONB NOT NULL DEFAULT '{}',
    "iconSetCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "checksum" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IocTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeopleTenantConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "attendanceMode" TEXT NOT NULL DEFAULT 'FILE_IMPORT',
    "leaveMode" TEXT NOT NULL DEFAULT 'XOFFICE',
    "payrollMode" TEXT NOT NULL DEFAULT 'FILE_IMPORT',
    "timesheetEnabled" BOOLEAN NOT NULL DEFAULT true,
    "performanceBridgeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "iocCapacityEnabled" BOOLEAN NOT NULL DEFAULT false,
    "workCalendarId" TEXT,
    "externalSystemId" TEXT,
    "defaultStandardHoursPerDay" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "workingWeekdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeopleTenantConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicyRef" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "unit" TEXT NOT NULL DEFAULT 'DAY',
    "accrualMethod" TEXT NOT NULL DEFAULT 'ANNUAL',
    "accrualPerPeriod" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxCarryOver" DOUBLE PRECISION,
    "allowNegative" BOOLEAN NOT NULL DEFAULT false,
    "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
    "minNoticeDays" INTEGER NOT NULL DEFAULT 0,
    "maxConsecutiveDays" INTEGER,
    "appliesToOrgUnitIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "appliesToPositionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "externalSystem" TEXT,
    "externalPolicyCode" TEXT,
    "sourceVersion" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavePolicyRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalanceSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "leavePolicyId" TEXT NOT NULL,
    "periodCode" TEXT NOT NULL,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accrued" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pending" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjusted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carriedOver" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "available" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'DAY',
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "sourceLeaveRequestId" TEXT,
    "sourceSystem" TEXT,
    "sourceVersion" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveBalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "orgUnitId" TEXT,
    "positionId" TEXT,
    "leaveTypeCode" TEXT NOT NULL,
    "leavePolicyId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "startDayPart" TEXT NOT NULL DEFAULT 'FULL',
    "endDayPart" TEXT NOT NULL DEFAULT 'FULL',
    "durationValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationUnit" TEXT NOT NULL DEFAULT 'DAY',
    "reason" TEXT,
    "replacementPersonId" TEXT,
    "attachmentRecordIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "decisionNote" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "workflowInstanceId" TEXT,
    "approvalTaskId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveImpactSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedPhase" TEXT NOT NULL,
    "impactedWorkItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "impactedMilestoneIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "impactedApprovalTaskIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "impactedBookingIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "impactedDirectiveIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "impactedProjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" JSONB NOT NULL DEFAULT '{}',
    "capacityDeltaHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveImpactSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "orgUnitId" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otType" TEXT NOT NULL DEFAULT 'NORMAL',
    "reason" TEXT,
    "relatedWorkItemId" TEXT,
    "relatedProjectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "decisionNote" TEXT,
    "workflowInstanceId" TEXT,
    "approvalTaskId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Initiative" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "sponsorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INTAKE',
    "strategicObjectiveIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expectedBenefits" JSONB NOT NULL DEFAULT '[]',
    "executionProjectId" TEXT,
    "prioritization" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Initiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerRole" TEXT,
    "strategicThemeId" TEXT,
    "itemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenefitProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "benefitName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "baseline" DOUBLE PRECISION,
    "target" DOUBLE PRECISION,
    "metricCode" TEXT,
    "ownerId" TEXT NOT NULL,
    "realizationSchedule" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenefitProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkCalendar" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workingWeekdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "holidays" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftPattern" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 60,
    "graceMinutes" INTEGER NOT NULL DEFAULT 15,
    "standardHours" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "shiftPatternId" TEXT NOT NULL,
    "workCalendarId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceImportBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL DEFAULT 'ATTENDANCE_IMPORT_V1',
    "fileName" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEWED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "preview" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),

    CONSTRAINT "AttendanceImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'FILE_IMPORT',
    "importBatchId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceDay" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "shiftPatternId" TEXT,
    "firstIn" TIMESTAMP(3),
    "lastOut" TIMESTAMP(3),
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ABSENT',
    "correctionApplied" BOOLEAN NOT NULL DEFAULT false,
    "sourceEventIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recomputedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCorrectionRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedStatus" TEXT,
    "requestedFirstIn" TIMESTAMP(3),
    "requestedLastOut" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "decisionNote" TEXT,
    "workflowInstanceId" TEXT,
    "approvalTaskId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_tenantNo_key" ON "Tenant"("tenantNo");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_tenantCode_key" ON "Tenant"("tenantCode");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_tenantKey_key" ON "Tenant"("tenantKey");

-- CreateIndex
CREATE INDEX "Workflow_tenantId_idx" ON "Workflow"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_tenantId_code_key" ON "Workflow"("tenantId", "code");

-- CreateIndex
CREATE INDEX "WorkflowVersion_workflowId_idx" ON "WorkflowVersion"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowVersion_workflowId_version_key" ON "WorkflowVersion"("workflowId", "version");

-- CreateIndex
CREATE INDEX "WorkflowNode_versionId_idx" ON "WorkflowNode"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowNode_versionId_nodeKey_key" ON "WorkflowNode"("versionId", "nodeKey");

-- CreateIndex
CREATE INDEX "WorkflowEdge_versionId_idx" ON "WorkflowEdge"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowEdge_versionId_edgeKey_key" ON "WorkflowEdge"("versionId", "edgeKey");

-- CreateIndex
CREATE INDEX "WorkflowInstance_tenantId_status_idx" ON "WorkflowInstance"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowInstance_tenantId_instanceCode_key" ON "WorkflowInstance"("tenantId", "instanceCode");

-- CreateIndex
CREATE INDEX "ConnectorCommand_tenantId_instanceId_idx" ON "ConnectorCommand"("tenantId", "instanceId");

-- CreateIndex
CREATE INDEX "ExternalExecution_tenantId_instanceCode_idx" ON "ExternalExecution"("tenantId", "instanceCode");

-- CreateIndex
CREATE INDEX "ExternalExecution_tenantId_status_idx" ON "ExternalExecution"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ApprovalTask_tenantId_status_idx" ON "ApprovalTask"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Delegation_tenantId_toUserId_idx" ON "Delegation"("tenantId", "toUserId");

-- CreateIndex
CREATE INDEX "Delegation_tenantId_fromUserId_idx" ON "Delegation"("tenantId", "fromUserId");

-- CreateIndex
CREATE INDEX "Notification_tenantId_userId_idx" ON "Notification"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Notification_tenantId_userId_readAt_idx" ON "Notification"("tenantId", "userId", "readAt");

-- CreateIndex
CREATE INDEX "WorkflowEvent_tenantId_instanceId_idx" ON "WorkflowEvent"("tenantId", "instanceId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_instanceCode_idx" ON "AuditLog"("tenantId", "instanceCode");

-- CreateIndex
CREATE INDEX "UnifiedWorkItem_tenantId_idx" ON "UnifiedWorkItem"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "UnifiedWorkItem_tenantId_sourceSystem_sourceType_sourceId_key" ON "UnifiedWorkItem"("tenantId", "sourceSystem", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "CommandLog_tenantId_commandType_idx" ON "CommandLog"("tenantId", "commandType");

-- CreateIndex
CREATE UNIQUE INDEX "CommandLog_tenantId_idempotencyKey_key" ON "CommandLog"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_userId_key" ON "Membership"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "PersonProfile_tenantId_idx" ON "PersonProfile"("tenantId");

-- CreateIndex
CREATE INDEX "PersonProfile_tenantId_email_idx" ON "PersonProfile"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "PersonProfile_tenantId_id_key" ON "PersonProfile"("tenantId", "id");

-- CreateIndex
CREATE INDEX "OrgUnit_tenantId_idx" ON "OrgUnit"("tenantId");

-- CreateIndex
CREATE INDEX "OrgUnit_tenantId_parentId_idx" ON "OrgUnit"("tenantId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgUnit_tenantId_code_key" ON "OrgUnit"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Position_tenantId_idx" ON "Position"("tenantId");

-- CreateIndex
CREATE INDEX "Position_tenantId_orgUnitId_idx" ON "Position"("tenantId", "orgUnitId");

-- CreateIndex
CREATE INDEX "Position_tenantId_holderPersonId_idx" ON "Position"("tenantId", "holderPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_tenantId_code_key" ON "Position"("tenantId", "code");

-- CreateIndex
CREATE INDEX "PositionAssignment_tenantId_positionId_idx" ON "PositionAssignment"("tenantId", "positionId");

-- CreateIndex
CREATE INDEX "Group_tenantId_idx" ON "Group"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_tenantId_code_key" ON "Group"("tenantId", "code");

-- CreateIndex
CREATE INDEX "RoleBinding_tenantId_idx" ON "RoleBinding"("tenantId");

-- CreateIndex
CREATE INDEX "RoleBinding_tenantId_roleCode_idx" ON "RoleBinding"("tenantId", "roleCode");

-- CreateIndex
CREATE INDEX "RoleBinding_tenantId_subjectType_subjectId_idx" ON "RoleBinding"("tenantId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "PermissionPolicy_tenantId_roleCode_idx" ON "PermissionPolicy"("tenantId", "roleCode");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionPolicy_tenantId_roleCode_version_key" ON "PermissionPolicy"("tenantId", "roleCode", "version");

-- CreateIndex
CREATE INDEX "DataScope_tenantId_idx" ON "DataScope"("tenantId");

-- CreateIndex
CREATE INDEX "DataScope_tenantId_subjectType_subjectId_idx" ON "DataScope"("tenantId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "AssignmentResolution_tenantId_idx" ON "AssignmentResolution"("tenantId");

-- CreateIndex
CREATE INDEX "AssignmentResolution_tenantId_workflowInstanceCode_idx" ON "AssignmentResolution"("tenantId", "workflowInstanceCode");

-- CreateIndex
CREATE INDEX "TenantApplicationInstance_tenantId_idx" ON "TenantApplicationInstance"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantApplicationInstance_tenantId_applicationCode_key" ON "TenantApplicationInstance"("tenantId", "applicationCode");

-- CreateIndex
CREATE INDEX "AppAccountBinding_tenantId_idx" ON "AppAccountBinding"("tenantId");

-- CreateIndex
CREATE INDEX "AppAccountBinding_tenantId_applicationCode_idx" ON "AppAccountBinding"("tenantId", "applicationCode");

-- CreateIndex
CREATE UNIQUE INDEX "AppAccountBinding_tenantId_personId_applicationCode_key" ON "AppAccountBinding"("tenantId", "personId", "applicationCode");

-- CreateIndex
CREATE INDEX "AppRoleMapping_tenantId_applicationCode_idx" ON "AppRoleMapping"("tenantId", "applicationCode");

-- CreateIndex
CREATE UNIQUE INDEX "AppRoleMapping_tenantId_applicationCode_xhubRoleCode_versio_key" ON "AppRoleMapping"("tenantId", "applicationCode", "xhubRoleCode", "version");

-- CreateIndex
CREATE INDEX "ProvisioningCommand_tenantId_status_idx" ON "ProvisioningCommand"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ProvisioningCommand_tenantId_personId_applicationCode_idx" ON "ProvisioningCommand"("tenantId", "personId", "applicationCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProvisioningCommand_tenantId_idempotencyKey_key" ON "ProvisioningCommand"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ProvisioningConflict_tenantId_idx" ON "ProvisioningConflict"("tenantId");

-- CreateIndex
CREATE INDEX "ProvisioningConflict_tenantId_resolved_idx" ON "ProvisioningConflict"("tenantId", "resolved");

-- CreateIndex
CREATE INDEX "MasterRecord_domain_status_idx" ON "MasterRecord"("domain", "status");

-- CreateIndex
CREATE INDEX "MasterRecord_domain_canonicalKey_idx" ON "MasterRecord"("domain", "canonicalKey");

-- CreateIndex
CREATE INDEX "SourceRecord_tenantId_idx" ON "SourceRecord"("tenantId");

-- CreateIndex
CREATE INDEX "SourceRecord_tenantId_importJobId_idx" ON "SourceRecord"("tenantId", "importJobId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceRecord_tenantId_sourceSystem_sourceId_key" ON "SourceRecord"("tenantId", "sourceSystem", "sourceId");

-- CreateIndex
CREATE INDEX "TenantMasterOverlay_tenantId_idx" ON "TenantMasterOverlay"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMasterOverlay_tenantId_masterRecordId_key" ON "TenantMasterOverlay"("tenantId", "masterRecordId");

-- CreateIndex
CREATE INDEX "ImportJob_tenantId_idx" ON "ImportJob"("tenantId");

-- CreateIndex
CREATE INDEX "DuplicatePair_tenantId_idx" ON "DuplicatePair"("tenantId");

-- CreateIndex
CREATE INDEX "DuplicatePair_tenantId_decision_idx" ON "DuplicatePair"("tenantId", "decision");

-- CreateIndex
CREATE INDEX "BackupJob_tenantId_idx" ON "BackupJob"("tenantId");

-- CreateIndex
CREATE INDEX "BackupJob_tenantId_status_idx" ON "BackupJob"("tenantId", "status");

-- CreateIndex
CREATE INDEX "RestoreJob_tenantId_idx" ON "RestoreJob"("tenantId");

-- CreateIndex
CREATE INDEX "RestoreJob_tenantId_status_idx" ON "RestoreJob"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BackupSchedule_tenantId_key" ON "BackupSchedule"("tenantId");

-- CreateIndex
CREATE INDEX "RecordDocument_tenantId_idx" ON "RecordDocument"("tenantId");

-- CreateIndex
CREATE INDEX "RecordDocument_tenantId_kind_idx" ON "RecordDocument"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "RecordDocument_tenantId_subjectType_subjectId_idx" ON "RecordDocument"("tenantId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "DocumentVersion_tenantId_idx" ON "DocumentVersion"("tenantId");

-- CreateIndex
CREATE INDEX "DocumentVersion_tenantId_documentId_idx" ON "DocumentVersion"("tenantId", "documentId");

-- CreateIndex
CREATE INDEX "DocumentVersion_tenantId_contentHash_idx" ON "DocumentVersion"("tenantId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNo_key" ON "DocumentVersion"("documentId", "versionNo");

-- CreateIndex
CREATE INDEX "WebhookEvent_tenantId_idx" ON "WebhookEvent"("tenantId");

-- CreateIndex
CREATE INDEX "WebhookEvent_tenantId_status_idx" ON "WebhookEvent"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_tenantId_source_externalId_key" ON "WebhookEvent"("tenantId", "source", "externalId");

-- CreateIndex
CREATE INDEX "OutboxEvent_tenantId_idx" ON "OutboxEvent"("tenantId");

-- CreateIndex
CREATE INDEX "OutboxEvent_tenantId_status_idx" ON "OutboxEvent"("tenantId", "status");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_nextAttemptAt_idx" ON "OutboxEvent"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "UserCredential_tenantId_idx" ON "UserCredential"("tenantId");

-- CreateIndex
CREATE INDEX "UserCredential_tenantId_personId_idx" ON "UserCredential"("tenantId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCredential_tenantId_userId_key" ON "UserCredential"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "AuthToken_tenantId_idx" ON "AuthToken"("tenantId");

-- CreateIndex
CREATE INDEX "AuthToken_tenantId_personId_idx" ON "AuthToken"("tenantId", "personId");

-- CreateIndex
CREATE INDEX "AuthToken_tokenHash_idx" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "Request_tenantId_state_idx" ON "Request"("tenantId", "state");

-- CreateIndex
CREATE INDEX "Request_tenantId_requesterId_idx" ON "Request"("tenantId", "requesterId");

-- CreateIndex
CREATE UNIQUE INDEX "Request_tenantId_code_key" ON "Request"("tenantId", "code");

-- CreateIndex
CREATE INDEX "RequestComment_tenantId_requestId_idx" ON "RequestComment"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "RequestEvent_tenantId_requestId_idx" ON "RequestEvent"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "Directive_tenantId_state_idx" ON "Directive"("tenantId", "state");

-- CreateIndex
CREATE INDEX "Directive_tenantId_issuerId_idx" ON "Directive"("tenantId", "issuerId");

-- CreateIndex
CREATE UNIQUE INDEX "Directive_tenantId_code_key" ON "Directive"("tenantId", "code");

-- CreateIndex
CREATE INDEX "DirectiveAssignment_tenantId_directiveId_idx" ON "DirectiveAssignment"("tenantId", "directiveId");

-- CreateIndex
CREATE INDEX "DirectiveAssignment_tenantId_assigneeId_idx" ON "DirectiveAssignment"("tenantId", "assigneeId");

-- CreateIndex
CREATE INDEX "DirectiveEvent_tenantId_directiveId_idx" ON "DirectiveEvent"("tenantId", "directiveId");

-- CreateIndex
CREATE INDEX "ServiceCatalogItem_tenantId_category_idx" ON "ServiceCatalogItem"("tenantId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCatalogItem_tenantId_code_key" ON "ServiceCatalogItem"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Ticket_tenantId_state_idx" ON "Ticket"("tenantId", "state");

-- CreateIndex
CREATE INDEX "Ticket_tenantId_requesterId_idx" ON "Ticket"("tenantId", "requesterId");

-- CreateIndex
CREATE INDEX "Ticket_tenantId_assigneeId_idx" ON "Ticket"("tenantId", "assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_tenantId_code_key" ON "Ticket"("tenantId", "code");

-- CreateIndex
CREATE INDEX "TicketEvent_tenantId_ticketId_idx" ON "TicketEvent"("tenantId", "ticketId");

-- CreateIndex
CREATE INDEX "BookableResource_tenantId_type_idx" ON "BookableResource"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "BookableResource_tenantId_code_key" ON "BookableResource"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Booking_tenantId_state_idx" ON "Booking"("tenantId", "state");

-- CreateIndex
CREATE INDEX "Booking_tenantId_resourceId_idx" ON "Booking"("tenantId", "resourceId");

-- CreateIndex
CREATE INDEX "Booking_tenantId_requesterId_idx" ON "Booking"("tenantId", "requesterId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_tenantId_code_key" ON "Booking"("tenantId", "code");

-- CreateIndex
CREATE INDEX "BookingEvent_tenantId_bookingId_idx" ON "BookingEvent"("tenantId", "bookingId");

-- CreateIndex
CREATE INDEX "Announcement_tenantId_state_idx" ON "Announcement"("tenantId", "state");

-- CreateIndex
CREATE INDEX "Announcement_tenantId_authorId_idx" ON "Announcement"("tenantId", "authorId");

-- CreateIndex
CREATE UNIQUE INDEX "Announcement_tenantId_code_key" ON "Announcement"("tenantId", "code");

-- CreateIndex
CREATE INDEX "AnnouncementReceipt_tenantId_announcementId_idx" ON "AnnouncementReceipt"("tenantId", "announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementReceipt_tenantId_userId_idx" ON "AnnouncementReceipt"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementReceipt_announcementId_userId_key" ON "AnnouncementReceipt"("announcementId", "userId");

-- CreateIndex
CREATE INDEX "AnnouncementEvent_tenantId_announcementId_idx" ON "AnnouncementEvent"("tenantId", "announcementId");

-- CreateIndex
CREATE INDEX "TenantLaunch_targetTenantId_idx" ON "TenantLaunch"("targetTenantId");

-- CreateIndex
CREATE INDEX "TenantLaunch_status_idx" ON "TenantLaunch"("status");

-- CreateIndex
CREATE INDEX "TenantLaunchStep_launchId_idx" ON "TenantLaunchStep"("launchId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantLaunchStep_launchId_stepKey_key" ON "TenantLaunchStep"("launchId", "stepKey");

-- CreateIndex
CREATE INDEX "Blueprint_code_idx" ON "Blueprint"("code");

-- CreateIndex
CREATE INDEX "Blueprint_status_idx" ON "Blueprint"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Blueprint_code_version_key" ON "Blueprint"("code", "version");

-- CreateIndex
CREATE INDEX "SeedPack_code_idx" ON "SeedPack"("code");

-- CreateIndex
CREATE INDEX "SeedPack_status_idx" ON "SeedPack"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SeedPack_code_version_key" ON "SeedPack"("code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_tier_idx" ON "SubscriptionPlan"("tier");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_status_idx" ON "SubscriptionPlan"("status");

-- CreateIndex
CREATE INDEX "GoLiveChecklistTemplate_code_idx" ON "GoLiveChecklistTemplate"("code");

-- CreateIndex
CREATE INDEX "GoLiveChecklistTemplate_scope_idx" ON "GoLiveChecklistTemplate"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "GoLiveChecklistTemplate_code_version_key" ON "GoLiveChecklistTemplate"("code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "TenantGoLive_tenantId_key" ON "TenantGoLive"("tenantId");

-- CreateIndex
CREATE INDEX "TenantGoLive_status_idx" ON "TenantGoLive"("status");

-- CreateIndex
CREATE INDEX "Engagement_tenantId_stage_idx" ON "Engagement"("tenantId", "stage");

-- CreateIndex
CREATE INDEX "Engagement_tenantId_status_idx" ON "Engagement"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Engagement_tenantId_ownerId_idx" ON "Engagement"("tenantId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Engagement_tenantId_code_key" ON "Engagement"("tenantId", "code");

-- CreateIndex
CREATE INDEX "EngagementEvent_tenantId_engagementId_idx" ON "EngagementEvent"("tenantId", "engagementId");

-- CreateIndex
CREATE INDEX "NativeWorkItem_tenantId_projectId_idx" ON "NativeWorkItem"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "NativeWorkItem_tenantId_parentId_idx" ON "NativeWorkItem"("tenantId", "parentId");

-- CreateIndex
CREATE INDEX "NativeWorkItem_tenantId_status_idx" ON "NativeWorkItem"("tenantId", "status");

-- CreateIndex
CREATE INDEX "NativeWorkItem_tenantId_type_idx" ON "NativeWorkItem"("tenantId", "type");

-- CreateIndex
CREATE INDEX "NativeWorkItem_tenantId_ownerId_idx" ON "NativeWorkItem"("tenantId", "ownerId");

-- CreateIndex
CREATE INDEX "NativeWorkItem_tenantId_dueAt_idx" ON "NativeWorkItem"("tenantId", "dueAt");

-- CreateIndex
CREATE INDEX "WorkItemComment_tenantId_workItemId_idx" ON "WorkItemComment"("tenantId", "workItemId");

-- CreateIndex
CREATE INDEX "WorkItemChecklistItem_tenantId_workItemId_idx" ON "WorkItemChecklistItem"("tenantId", "workItemId");

-- CreateIndex
CREATE INDEX "WorkItemEvent_tenantId_workItemId_idx" ON "WorkItemEvent"("tenantId", "workItemId");

-- CreateIndex
CREATE INDEX "WorkDimension_tenantId_active_idx" ON "WorkDimension"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WorkDimension_tenantId_key_key" ON "WorkDimension"("tenantId", "key");

-- CreateIndex
CREATE INDEX "ExecutionProject_tenantId_status_idx" ON "ExecutionProject"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ExecutionProject_tenantId_projectKind_idx" ON "ExecutionProject"("tenantId", "projectKind");

-- CreateIndex
CREATE INDEX "ExecutionProject_tenantId_canonicalProjectId_idx" ON "ExecutionProject"("tenantId", "canonicalProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionProject_tenantId_code_key" ON "ExecutionProject"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ExecutionProjectEvent_tenantId_projectId_idx" ON "ExecutionProjectEvent"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "WorkDependency_tenantId_predecessorId_idx" ON "WorkDependency"("tenantId", "predecessorId");

-- CreateIndex
CREATE INDEX "WorkDependency_tenantId_successorId_idx" ON "WorkDependency"("tenantId", "successorId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkDependency_tenantId_predecessorId_successorId_type_key" ON "WorkDependency"("tenantId", "predecessorId", "successorId", "type");

-- CreateIndex
CREATE INDEX "ProjectBaseline_tenantId_projectId_idx" ON "ProjectBaseline"("tenantId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectBaseline_tenantId_projectId_version_key" ON "ProjectBaseline"("tenantId", "projectId", "version");

-- CreateIndex
CREATE INDEX "BaselineItem_tenantId_baselineId_idx" ON "BaselineItem"("tenantId", "baselineId");

-- CreateIndex
CREATE INDEX "ProjectRoleAssignment_tenantId_projectId_idx" ON "ProjectRoleAssignment"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectRoleAssignment_tenantId_subjectType_subjectId_idx" ON "ProjectRoleAssignment"("tenantId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "CoordinationShare_tenantId_scope_scopeId_idx" ON "CoordinationShare"("tenantId", "scope", "scopeId");

-- CreateIndex
CREATE INDEX "CoordinationShare_tenantId_audienceType_audienceId_idx" ON "CoordinationShare"("tenantId", "audienceType", "audienceId");

-- CreateIndex
CREATE INDEX "StrategicObjective_tenantId_status_idx" ON "StrategicObjective"("tenantId", "status");

-- CreateIndex
CREATE INDEX "StrategicObjective_tenantId_ownerId_idx" ON "StrategicObjective"("tenantId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "StrategicObjective_tenantId_code_key" ON "StrategicObjective"("tenantId", "code");

-- CreateIndex
CREATE INDEX "MetricDefinition_tenantId_sourceSystem_idx" ON "MetricDefinition"("tenantId", "sourceSystem");

-- CreateIndex
CREATE INDEX "MetricDefinition_tenantId_ownerId_idx" ON "MetricDefinition"("tenantId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "MetricDefinition_tenantId_code_key" ON "MetricDefinition"("tenantId", "code");

-- CreateIndex
CREATE INDEX "MetricObservation_tenantId_metricId_idx" ON "MetricObservation"("tenantId", "metricId");

-- CreateIndex
CREATE UNIQUE INDEX "MetricObservation_tenantId_metricId_periodStart_periodEnd_key" ON "MetricObservation"("tenantId", "metricId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "BusinessReview_tenantId_status_idx" ON "BusinessReview"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BusinessReview_tenantId_type_idx" ON "BusinessReview"("tenantId", "type");

-- CreateIndex
CREATE INDEX "DecisionRecord_tenantId_status_idx" ON "DecisionRecord"("tenantId", "status");

-- CreateIndex
CREATE INDEX "DecisionRecord_tenantId_reviewId_idx" ON "DecisionRecord"("tenantId", "reviewId");

-- CreateIndex
CREATE INDEX "ActionCommitment_tenantId_status_idx" ON "ActionCommitment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ActionCommitment_tenantId_decisionId_idx" ON "ActionCommitment"("tenantId", "decisionId");

-- CreateIndex
CREATE INDEX "ActionCommitment_tenantId_nativeWorkItemId_idx" ON "ActionCommitment"("tenantId", "nativeWorkItemId");

-- CreateIndex
CREATE INDEX "Scorecard_tenantId_period_idx" ON "Scorecard"("tenantId", "period");

-- CreateIndex
CREATE INDEX "OKRCycle_tenantId_status_idx" ON "OKRCycle"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OKRCycle_tenantId_code_key" ON "OKRCycle"("tenantId", "code");

-- CreateIndex
CREATE INDEX "OKRObjective_tenantId_cycleId_idx" ON "OKRObjective"("tenantId", "cycleId");

-- CreateIndex
CREATE INDEX "OKRObjective_tenantId_status_idx" ON "OKRObjective"("tenantId", "status");

-- CreateIndex
CREATE INDEX "KeyResult_tenantId_okrObjectiveId_idx" ON "KeyResult"("tenantId", "okrObjectiveId");

-- CreateIndex
CREATE INDEX "KeyResultCheckIn_tenantId_keyResultId_checkedAt_idx" ON "KeyResultCheckIn"("tenantId", "keyResultId", "checkedAt");

-- CreateIndex
CREATE INDEX "TwinSite_tenantId_idx" ON "TwinSite"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TwinSite_tenantId_code_key" ON "TwinSite"("tenantId", "code");

-- CreateIndex
CREATE INDEX "TwinFloor_tenantId_siteId_idx" ON "TwinFloor"("tenantId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "TwinFloor_tenantId_code_key" ON "TwinFloor"("tenantId", "code");

-- CreateIndex
CREATE INDEX "FloorPlanDefinition_tenantId_floorId_idx" ON "FloorPlanDefinition"("tenantId", "floorId");

-- CreateIndex
CREATE INDEX "FloorPlanDefinition_tenantId_status_idx" ON "FloorPlanDefinition"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FloorPlanVersion_tenantId_planId_idx" ON "FloorPlanVersion"("tenantId", "planId");

-- CreateIndex
CREATE UNIQUE INDEX "FloorPlanVersion_tenantId_planId_versionNo_key" ON "FloorPlanVersion"("tenantId", "planId", "versionNo");

-- CreateIndex
CREATE INDEX "TwinScene_tenantId_floorId_idx" ON "TwinScene"("tenantId", "floorId");

-- CreateIndex
CREATE INDEX "TwinScene_tenantId_status_idx" ON "TwinScene"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SceneBinding_tenantId_sceneId_idx" ON "SceneBinding"("tenantId", "sceneId");

-- CreateIndex
CREATE INDEX "SceneBinding_tenantId_bindingType_bindingId_idx" ON "SceneBinding"("tenantId", "bindingType", "bindingId");

-- CreateIndex
CREATE UNIQUE INDEX "SceneBinding_tenantId_sceneId_zoneId_key" ON "SceneBinding"("tenantId", "sceneId", "zoneId");

-- CreateIndex
CREATE INDEX "TwinSceneVersion_tenantId_sceneId_idx" ON "TwinSceneVersion"("tenantId", "sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "TwinSceneVersion_tenantId_sceneId_versionNo_key" ON "TwinSceneVersion"("tenantId", "sceneId", "versionNo");

-- CreateIndex
CREATE INDEX "IconAsset_tenantId_status_idx" ON "IconAsset"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IconAsset_tenantId_key_key" ON "IconAsset"("tenantId", "key");

-- CreateIndex
CREATE INDEX "DataLayerDefinition_tenantId_entityKey_idx" ON "DataLayerDefinition"("tenantId", "entityKey");

-- CreateIndex
CREATE UNIQUE INDEX "DataLayerDefinition_tenantId_code_key" ON "DataLayerDefinition"("tenantId", "code");

-- CreateIndex
CREATE INDEX "DashboardDefinition_tenantId_viewType_idx" ON "DashboardDefinition"("tenantId", "viewType");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardDefinition_tenantId_code_key" ON "DashboardDefinition"("tenantId", "code");

-- CreateIndex
CREATE INDEX "DashboardVersion_tenantId_dashboardId_idx" ON "DashboardVersion"("tenantId", "dashboardId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardVersion_tenantId_dashboardId_versionNo_key" ON "DashboardVersion"("tenantId", "dashboardId", "versionNo");

-- CreateIndex
CREATE INDEX "IocTemplate_code_idx" ON "IocTemplate"("code");

-- CreateIndex
CREATE INDEX "IocTemplate_status_idx" ON "IocTemplate"("status");

-- CreateIndex
CREATE INDEX "IocTemplate_twinType_idx" ON "IocTemplate"("twinType");

-- CreateIndex
CREATE UNIQUE INDEX "IocTemplate_code_version_key" ON "IocTemplate"("code", "version");

-- CreateIndex
CREATE INDEX "PeopleTenantConfig_tenantId_idx" ON "PeopleTenantConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PeopleTenantConfig_tenantId_key" ON "PeopleTenantConfig"("tenantId");

-- CreateIndex
CREATE INDEX "LeavePolicyRef_tenantId_idx" ON "LeavePolicyRef"("tenantId");

-- CreateIndex
CREATE INDEX "LeavePolicyRef_tenantId_status_idx" ON "LeavePolicyRef"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicyRef_tenantId_code_key" ON "LeavePolicyRef"("tenantId", "code");

-- CreateIndex
CREATE INDEX "LeaveBalanceSnapshot_tenantId_personId_idx" ON "LeaveBalanceSnapshot"("tenantId", "personId");

-- CreateIndex
CREATE INDEX "LeaveBalanceSnapshot_tenantId_leavePolicyId_idx" ON "LeaveBalanceSnapshot"("tenantId", "leavePolicyId");

-- CreateIndex
CREATE INDEX "LeaveBalanceSnapshot_tenantId_personId_leavePolicyId_period_idx" ON "LeaveBalanceSnapshot"("tenantId", "personId", "leavePolicyId", "periodCode");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalanceSnapshot_tenantId_personId_leavePolicyId_period_key" ON "LeaveBalanceSnapshot"("tenantId", "personId", "leavePolicyId", "periodCode", "sequence");

-- CreateIndex
CREATE INDEX "LeaveRequest_tenantId_personId_idx" ON "LeaveRequest"("tenantId", "personId");

-- CreateIndex
CREATE INDEX "LeaveRequest_tenantId_status_idx" ON "LeaveRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_tenantId_startAt_endAt_idx" ON "LeaveRequest"("tenantId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "LeaveRequest_tenantId_leavePolicyId_idx" ON "LeaveRequest"("tenantId", "leavePolicyId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_tenantId_idempotencyKey_key" ON "LeaveRequest"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "LeaveImpactSnapshot_tenantId_leaveRequestId_idx" ON "LeaveImpactSnapshot"("tenantId", "leaveRequestId");

-- CreateIndex
CREATE INDEX "LeaveImpactSnapshot_tenantId_personId_idx" ON "LeaveImpactSnapshot"("tenantId", "personId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_tenantId_personId_idx" ON "OvertimeRequest"("tenantId", "personId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_tenantId_status_idx" ON "OvertimeRequest"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeRequest_tenantId_idempotencyKey_key" ON "OvertimeRequest"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Initiative_tenantId_status_idx" ON "Initiative"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Initiative_tenantId_executionProjectId_idx" ON "Initiative"("tenantId", "executionProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Initiative_tenantId_code_key" ON "Initiative"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Portfolio_tenantId_idx" ON "Portfolio"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_tenantId_code_key" ON "Portfolio"("tenantId", "code");

-- CreateIndex
CREATE INDEX "BenefitProfile_tenantId_initiativeId_idx" ON "BenefitProfile"("tenantId", "initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkCalendar_tenantId_code_key" ON "WorkCalendar"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftPattern_tenantId_code_key" ON "ShiftPattern"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ShiftAssignment_tenantId_personId_idx" ON "ShiftAssignment"("tenantId", "personId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_tenantId_personId_effectiveFrom_idx" ON "ShiftAssignment"("tenantId", "personId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "AttendanceImportBatch_tenantId_status_idx" ON "AttendanceImportBatch"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceImportBatch_tenantId_checksum_key" ON "AttendanceImportBatch"("tenantId", "checksum");

-- CreateIndex
CREATE INDEX "AttendanceEvent_tenantId_personId_at_idx" ON "AttendanceEvent"("tenantId", "personId", "at");

-- CreateIndex
CREATE INDEX "AttendanceEvent_tenantId_importBatchId_idx" ON "AttendanceEvent"("tenantId", "importBatchId");

-- CreateIndex
CREATE INDEX "AttendanceDay_tenantId_workDate_idx" ON "AttendanceDay"("tenantId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDay_tenantId_personId_workDate_key" ON "AttendanceDay"("tenantId", "personId", "workDate");

-- CreateIndex
CREATE INDEX "AttendanceCorrectionRequest_tenantId_personId_workDate_idx" ON "AttendanceCorrectionRequest"("tenantId", "personId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceCorrectionRequest_tenantId_idempotencyKey_key" ON "AttendanceCorrectionRequest"("tenantId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNode" ADD CONSTRAINT "WorkflowNode_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "WorkflowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEdge" ADD CONSTRAINT "WorkflowEdge_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "WorkflowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEdge" ADD CONSTRAINT "WorkflowEdge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "WorkflowNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEdge" ADD CONSTRAINT "WorkflowEdge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "WorkflowNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "WorkflowVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorCommand" ADD CONSTRAINT "ConnectorCommand_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalTask" ADD CONSTRAINT "ApprovalTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalTask" ADD CONSTRAINT "ApprovalTask_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisioningConflict" ADD CONSTRAINT "ProvisioningConflict_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "ProvisioningCommand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_masterRecordId_fkey" FOREIGN KEY ("masterRecordId") REFERENCES "MasterRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RecordDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestComment" ADD CONSTRAINT "RequestComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestEvent" ADD CONSTRAINT "RequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectiveAssignment" ADD CONSTRAINT "DirectiveAssignment_directiveId_fkey" FOREIGN KEY ("directiveId") REFERENCES "Directive"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectiveEvent" ADD CONSTRAINT "DirectiveEvent_directiveId_fkey" FOREIGN KEY ("directiveId") REFERENCES "Directive"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "BookableResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementReceipt" ADD CONSTRAINT "AnnouncementReceipt_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementEvent" ADD CONSTRAINT "AnnouncementEvent_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantLaunchStep" ADD CONSTRAINT "TenantLaunchStep_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "TenantLaunch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementEvent" ADD CONSTRAINT "EngagementEvent_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemComment" ADD CONSTRAINT "WorkItemComment_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "NativeWorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemChecklistItem" ADD CONSTRAINT "WorkItemChecklistItem_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "NativeWorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemEvent" ADD CONSTRAINT "WorkItemEvent_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "NativeWorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionProjectEvent" ADD CONSTRAINT "ExecutionProjectEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ExecutionProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBaseline" ADD CONSTRAINT "ProjectBaseline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ExecutionProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineItem" ADD CONSTRAINT "BaselineItem_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "ProjectBaseline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRoleAssignment" ADD CONSTRAINT "ProjectRoleAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ExecutionProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricObservation" ADD CONSTRAINT "MetricObservation_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "MetricDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResult" ADD CONSTRAINT "KeyResult_okrObjectiveId_fkey" FOREIGN KEY ("okrObjectiveId") REFERENCES "OKRObjective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResultCheckIn" ADD CONSTRAINT "KeyResultCheckIn_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "KeyResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwinFloor" ADD CONSTRAINT "TwinFloor_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "TwinSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorPlanVersion" ADD CONSTRAINT "FloorPlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FloorPlanDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneBinding" ADD CONSTRAINT "SceneBinding_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "TwinScene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwinSceneVersion" ADD CONSTRAINT "TwinSceneVersion_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "TwinScene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardVersion" ADD CONSTRAINT "DashboardVersion_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "DashboardDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

