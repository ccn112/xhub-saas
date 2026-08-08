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
  // X.Office Work & Project Management v2 — W1 (Native Work Core).
  'NativeWorkItem',
  'WorkItemComment',
  'WorkItemChecklistItem',
  'WorkItemEvent',
  'WorkDimension',
  // X.Office Work & Project Management v2 — W2 (Execution Project Core).
  'ExecutionProject',
  'ExecutionProjectEvent',
  'WorkDependency',
  'ProjectBaseline',
  'BaselineItem',
  'ProjectRoleAssignment',
  'CoordinationShare',
  // X.Office Management Operating System — MG-01 reference slice.
  'StrategicObjective',
  'MetricDefinition',
  'MetricObservation',
  'BusinessReview',
  'DecisionRecord',
  'ActionCommitment',
  // X.Office Management Operating System — MG-03 (KPI/OKR/Scorecard).
  'Scorecard',
  'OKRCycle',
  'OKRObjective',
  'KeyResult',
  'KeyResultCheckIn',
  // XHub Enterprise IOC — Digital Twin (DT-01 → DT-03). IOC is a projection
  // surface, but every one of its config tables is tenant-owned, so all of them
  // are FORCE-RLS with a negative isolation test (Constitution #3, AT-001/AT-010).
  'TwinSite',
  'TwinFloor',
  'FloorPlanDefinition',
  'FloorPlanVersion',
  'TwinScene',
  'SceneBinding',
  'TwinSceneVersion',
  'IconAsset',
  'DataLayerDefinition',
  'DashboardDefinition',
  'DashboardVersion',
  // People Essentials — PE-01 (Leave & Availability).
  'PeopleTenantConfig',
  'LeavePolicyRef',
  'LeaveBalanceSnapshot',
  'LeaveRequest',
  'LeaveImpactSnapshot',
  'OvertimeRequest',
  // Management OS — MG-04 (Portfolio & Benefit).
  'Initiative',
  'Portfolio',
  'BenefitProfile',
  // People Essentials — PE-02 (Attendance & Correction).
  'WorkCalendar',
  'ShiftPattern',
  'ShiftAssignment',
  'AttendanceImportBatch',
  'AttendanceEvent',
  'AttendanceDay',
  'AttendanceCorrectionRequest',
  // Geo/Global Project Catalog/Provider Master (Wave A) — GlobalProject/Place/
  // Provider/... are GLOBAL PUBLIC data (like MasterRecord/ApplicationDefinition)
  // so intentionally NOT listed. ProviderProjectOverlay is the one exception:
  // it carries tenantId (per-tenant recommend/featured/booking flags) and MUST
  // be RLS-protected like any other tenant table.
  'ProviderProjectOverlay',
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

// GIN indexes for NativeWorkItem tag/dimension aggregation (owner requirement
// #2). Idempotent — created here (not via prisma db push) so `tags @> [...]` and
// `dimensions @> '{...}'` filters/pivots are indexed. jsonb_path_ops is chosen
// for the dimensions containment index.
await client.query(`CREATE INDEX IF NOT EXISTS "NativeWorkItem_tags_gin" ON "NativeWorkItem" USING GIN ("tags")`);
await client.query(`CREATE INDEX IF NOT EXISTS "NativeWorkItem_dimensions_gin" ON "NativeWorkItem" USING GIN ("dimensions" jsonb_path_ops)`);
console.log('  GIN indexes ensured: NativeWorkItem(tags), NativeWorkItem(dimensions)');

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
