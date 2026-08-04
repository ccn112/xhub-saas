/**
 * Per-tenant logical backup — table catalog + invariants (Mục 6).
 *
 * BACKUP_TABLES is the ordered list of TENANT-SCOPED (RLS) tables that make up
 * ONE tenant's logical backup. Order is dependency order (parents first) so the
 * restore can insert without violating the real DB foreign keys
 * (Workflow→Tenant, *→WorkflowInstance, ProvisioningConflict→ProvisioningCommand,
 * SourceRecord→ImportJob). `model` is the Prisma delegate name; `table` the SQL
 * name.
 *
 * SHARED / GLOBAL tables (ApplicationDefinition catalog, MasterRecord canonical,
 * WorkflowVersion/Node/Edge, Tenant) are PLATFORM data — they are NOT part of a
 * per-tenant backup and are recorded in `excludedData` with a reason. BackupJob
 * and RestoreJob themselves are also excluded (never back up backup metadata).
 */
export interface BackupTable {
  model: string; // Prisma delegate (camelCase)
  table: string; // SQL / PascalCase model name
}

export const BACKUP_TABLES: BackupTable[] = [
  { model: 'personProfile', table: 'PersonProfile' },
  { model: 'orgUnit', table: 'OrgUnit' },
  { model: 'position', table: 'Position' },
  { model: 'group', table: 'Group' },
  { model: 'roleBinding', table: 'RoleBinding' },
  { model: 'permissionPolicy', table: 'PermissionPolicy' },
  { model: 'dataScope', table: 'DataScope' },
  { model: 'assignmentResolution', table: 'AssignmentResolution' },
  { model: 'membership', table: 'Membership' },
  { model: 'delegation', table: 'Delegation' },
  { model: 'notification', table: 'Notification' },
  { model: 'unifiedWorkItem', table: 'UnifiedWorkItem' },
  { model: 'commandLog', table: 'CommandLog' },
  { model: 'externalExecution', table: 'ExternalExecution' },
  { model: 'tenantApplicationInstance', table: 'TenantApplicationInstance' },
  { model: 'appRoleMapping', table: 'AppRoleMapping' },
  { model: 'appAccountBinding', table: 'AppAccountBinding' },
  { model: 'workflow', table: 'Workflow' },
  { model: 'workflowInstance', table: 'WorkflowInstance' },
  { model: 'approvalTask', table: 'ApprovalTask' },
  { model: 'workflowEvent', table: 'WorkflowEvent' },
  { model: 'connectorCommand', table: 'ConnectorCommand' },
  { model: 'auditLog', table: 'AuditLog' },
  { model: 'provisioningCommand', table: 'ProvisioningCommand' },
  { model: 'provisioningConflict', table: 'ProvisioningConflict' },
  { model: 'importJob', table: 'ImportJob' },
  { model: 'sourceRecord', table: 'SourceRecord' },
  { model: 'duplicatePair', table: 'DuplicatePair' },
  { model: 'tenantMasterOverlay', table: 'TenantMasterOverlay' },
];

/** SHARED / global tables — NEVER in a per-tenant backup (MUST_NOT_LEAK). */
export const EXCLUDED_DATA: { table: string; reason: string }[] = [
  { table: 'ApplicationDefinition', reason: 'platform application catalog (shared, no tenantId)' },
  { table: 'MasterRecord', reason: 'shared/global canonical master (not per-tenant)' },
  { table: 'WorkflowVersion', reason: 'immutable published snapshot, reachable via shared Workflow (no tenantId)' },
  { table: 'WorkflowNode', reason: 'child of WorkflowVersion (shared, no tenantId)' },
  { table: 'WorkflowEdge', reason: 'child of WorkflowVersion (shared, no tenantId)' },
  { table: 'Tenant', reason: 'platform tenant registry (not tenant-owned data)' },
  { table: 'BackupJob', reason: 'backup metadata is not itself backed up' },
  { table: 'RestoreJob', reason: 'restore metadata is not itself backed up' },
  { table: 'credentials/secrets', reason: 'auth is delegated to IdP/Vault — no secret is ever stored or exported' },
];

/**
 * Identity / cross-row references to REWRITE on restore (old id → new id). The
 * key is the source table; each entry names the FK field and the table whose id
 * map rewrites it. `array` marks a String[] field (Group.memberPersonIds).
 * Polymorphic subjectId (RoleBinding / DataScope) is handled separately by
 * subjectType. Only CODE-level references are listed (real DB FKs by id).
 */
export interface FkRef {
  field: string;
  refModel: string; // BackupTable.model whose id map remaps this field
  array?: boolean;
}

export const FK_REFS: Record<string, FkRef[]> = {
  orgUnit: [{ field: 'parentId', refModel: 'orgUnit' }],
  position: [
    { field: 'orgUnitId', refModel: 'orgUnit' },
    { field: 'holderPersonId', refModel: 'personProfile' },
    { field: 'reportsToPositionId', refModel: 'position' },
  ],
  group: [{ field: 'memberPersonIds', refModel: 'personProfile', array: true }],
  appAccountBinding: [{ field: 'personId', refModel: 'personProfile' }],
  provisioningCommand: [{ field: 'personId', refModel: 'personProfile' }],
  provisioningConflict: [{ field: 'commandId', refModel: 'provisioningCommand' }],
  approvalTask: [{ field: 'instanceId', refModel: 'workflowInstance' }],
  workflowEvent: [{ field: 'instanceId', refModel: 'workflowInstance' }],
  connectorCommand: [{ field: 'instanceId', refModel: 'workflowInstance' }],
  sourceRecord: [{ field: 'importJobId', refModel: 'importJob' }],
  duplicatePair: [{ field: 'sourceRecordId', refModel: 'sourceRecord' }],
};

/** Polymorphic subjectType → refModel for the subjectId column. */
export const SUBJECT_TYPE_MODEL: Record<string, string> = {
  USER: 'personProfile',
  PERSON: 'personProfile',
  POSITION: 'position',
  GROUP: 'group',
  ORG_UNIT: 'orgUnit',
};

