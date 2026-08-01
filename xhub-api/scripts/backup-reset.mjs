// Reset backup/restore runtime state so the smoke is re-runnable. Bypasses RLS
// to delete BackupJob / RestoreJob rows for the test tenant + its sandbox, and
// wipes the sandbox tenant's restored data + Tenant row.
// Run: node scripts/backup-reset.mjs   (or via: npm run test:backup)
import 'dotenv/config';
import pg from 'pg';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
await c.query("SELECT set_config('app.bypass_rls','on',false)");

const SOURCE = 'tenant-xtech';
const SANDBOX = 'tenant-xtech:restore-sandbox';

// Tenant-scoped tables that a restore writes into the sandbox (reverse dep order
// for FK safety). Kept in sync with src/backup/backup.tables.ts.
const TABLES = [
  'TenantMasterOverlay', 'DuplicatePair', 'SourceRecord', 'ImportJob',
  'ProvisioningConflict', 'ProvisioningCommand', 'AuditLog', 'ConnectorCommand',
  'WorkflowEvent', 'ApprovalTask', 'WorkflowInstance', 'Workflow',
  'AppAccountBinding', 'AppRoleMapping', 'TenantApplicationInstance',
  'ExternalExecution', 'CommandLog', 'UnifiedWorkItem', 'Notification',
  'Delegation', 'Membership', 'AssignmentResolution', 'DataScope',
  'PermissionPolicy', 'RoleBinding', 'Group', 'Position', 'OrgUnit', 'PersonProfile',
];

let sandboxRows = 0;
for (const t of TABLES) {
  const r = await c.query(`DELETE FROM "${t}" WHERE "tenantId"=$1`, [SANDBOX]);
  sandboxRows += r.rowCount;
}

const rj = await c.query(`DELETE FROM "RestoreJob" WHERE "tenantId"=$1 OR "tenantId"=$2`, [SOURCE, SANDBOX]);
const bj = await c.query(`DELETE FROM "BackupJob" WHERE "tenantId"=$1 OR "tenantId"=$2`, [SOURCE, SANDBOX]);
const tn = await c.query(`DELETE FROM "Tenant" WHERE id=$1`, [SANDBOX]);

console.log(
  `backup reset OK | backupJobs=${bj.rowCount} restoreJobs=${rj.rowCount} sandboxRows=${sandboxRows} sandboxTenant=${tn.rowCount}`,
);
await c.end();
