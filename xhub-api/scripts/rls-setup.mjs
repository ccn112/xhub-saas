// Idempotent Postgres Row-Level Security (RLS) setup for X.Office tenant tables.
// Run: node scripts/rls-setup.mjs   (or: npm run rls:setup)
//
// For every tenant-scoped table (those that carry a "tenantId" column) this:
//   1) ENABLE + FORCE ROW LEVEL SECURITY  (FORCE so the table OWNER — the app
//      role `xhub`, which is not a superuser — is also subject to the policy);
//   2) (re)creates a single policy `tenant_isolation` that lets a session see /
//      write ONLY rows whose "tenantId" matches the GUC `app.current_tenant`,
//      unless `app.bypass_rls` = 'on' (platform / seed / scheduler context).
//
// current_setting(..., true) is null-safe: when app.current_tenant is NOT set it
// returns NULL, so `"tenantId" = NULL` is never true → the session sees 0 rows.
//
// NOTE on scope: WorkflowVersion / WorkflowNode / WorkflowEdge / Tenant do NOT
// carry a tenantId column, so a per-tenant RLS predicate cannot be applied to
// them directly. WorkflowVersion is reachable only via its parent Workflow
// (which IS RLS-protected) and every service query for it is Workflow-scoped in
// code — so it stays protected transitively.
import 'dotenv/config';
import pg from 'pg';

const TENANT_TABLES = [
  'Workflow',
  'WorkflowInstance',
  'ApprovalTask',
  'WorkflowEvent',
  'AuditLog',
  'ConnectorCommand',
  'UnifiedWorkItem',
  'CommandLog',
  'ExternalExecution',
  'Delegation',
  'Notification',
  'Membership',
  // Identity/Org Core (shared platform domain)
  'PersonProfile',
  'OrgUnit',
  'Position',
  'PositionAssignment',
  'Group',
  'RoleBinding',
  'PermissionPolicy',
  'DataScope',
  'AssignmentResolution',
  // Tenant Control Plane + Application Provisioning (ApplicationDefinition is a
  // platform catalog — NOT tenant-scoped — so it is intentionally NOT listed).
  'TenantApplicationInstance',
  'AppAccountBinding',
  'AppRoleMapping',
  'ProvisioningCommand',
  'ProvisioningConflict',
  // Shared Master Data Hub (MDM) — MasterRecord is the SHARED platform canonical
  // (NOT tenant-scoped, no RLS, like ApplicationDefinition) so it is intentionally
  // NOT listed. The tables below carry tenantId and MUST be RLS-protected.
  'SourceRecord',
  'ImportJob',
  'DuplicatePair',
  'TenantMasterOverlay',
  // Per-tenant logical Backup / Restore (module src/backup) — Mục 6.
  'BackupJob',
  'RestoreJob',
  // Records / Documents + Webhook inbound + Transactional Outbox — Mục 8.
  'RecordDocument',
  'DocumentVersion',
  'WebhookEvent',
  'OutboxEvent',
  // Internal auth — credentials + one-time invite/reset tokens (PH-00b).
  'UserCredential',
  'AuthToken',
  // Electronic-office Request module (PH-02a — NX-020..024).
  'Request',
  'RequestComment',
  'RequestEvent',
  // Directive / Decision / Commitment module (PH-02b — NX-025).
  'Directive',
  'DirectiveAssignment',
  'DirectiveEvent',
  // Internal Service Desk / Ticket module (PH-02c — NX-026).
  'ServiceCatalogItem',
  'Ticket',
  'TicketEvent',
  // Resource Booking module (PH-02d — NX-027).
  'BookableResource',
  'Booking',
  'BookingEvent',
  // Announcement / read-acknowledgement module (PH-02e — NX-028).
  'Announcement',
  'AnnouncementReceipt',
  'AnnouncementEvent',
  // Solution Delivery Workspace — T001-scoped engagement lifecycle (SaaS step 5).
  'Engagement',
  'EngagementEvent',
];

const PREDICATE =
  `current_setting('app.bypass_rls', true) = 'on' ` +
  `OR "tenantId" = current_setting('app.current_tenant', true)`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

for (const t of TENANT_TABLES) {
  await client.query(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`);
  await client.query(`ALTER TABLE "${t}" FORCE ROW LEVEL SECURITY`);
  // Idempotent: drop + recreate the policy so re-runs pick up predicate changes.
  await client.query(`DROP POLICY IF EXISTS tenant_isolation ON "${t}"`);
  await client.query(
    `CREATE POLICY tenant_isolation ON "${t}" ` +
      `USING (${PREDICATE}) WITH CHECK (${PREDICATE})`,
  );
  console.log(`  RLS enabled + policy set: ${t}`);
}

// Report resulting state.
const rows = (
  await client.query(
    `SELECT c.relname AS table, c.relrowsecurity AS rls, c.relforcerowsecurity AS force
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
      ORDER BY c.relname`,
    [TENANT_TABLES],
  )
).rows;
console.log('\nRLS STATE:');
for (const r of rows) console.log(`  ${r.table}: rls=${r.rls} force=${r.force}`);
console.log(`\nRLS SETUP OK | ${TENANT_TABLES.length} tables`);

await client.end();
