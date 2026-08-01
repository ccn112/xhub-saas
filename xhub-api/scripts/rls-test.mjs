// DB-level RLS proof (no application code / no in-code tenant filter involved).
// Run: node scripts/rls-test.mjs   (or: npm run test:rls)
//
// Connects to Postgres directly (as the app role `xhub`) and proves that Row-
// Level Security alone isolates tenants:
//   1) set app.current_tenant='tenant-xtech'          → sees xtech rows, NO other tenant.
//   2) set app.current_tenant='tenant-demo-isolation' → does NOT see xtech rows.
//   3) app.current_tenant NOT set                     → sees 0 rows (fail-safe).
//   4) MUST_NOT_LEAK: under any single tenant, EVERY visible row is that tenant's.
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
  // (NOT tenant-scoped) so it is intentionally NOT listed. These carry tenantId.
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
  // X.Office Management Operating System — MG-03 KPI/OKR/Scorecard.
  'Scorecard',
  'OKRCycle',
  'OKRObjective',
  'KeyResult',
  'KeyResultCheckIn',
  // XHub Enterprise IOC — Digital Twin (DT-01 → DT-03). AT-001 / AT-010.
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
];

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else {
    console.error('  ✗ ' + msg);
    failed++;
  }
};

/** Open a fresh connection with app.current_tenant optionally set (session GUC). */
async function conn(tenant) {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  if (tenant !== null) {
    await c.query("SELECT set_config('app.current_tenant', $1, false)", [tenant]);
  }
  // Ensure bypass is OFF for the isolation proof.
  await c.query("SELECT set_config('app.bypass_rls', 'off', false)");
  return c;
}

const countWhere = async (c, table, whereSql) =>
  Number((await c.query(`SELECT count(*)::int AS n FROM "${table}" ${whereSql}`)).rows[0].n);

console.log('RLS DB-level isolation test @ ' + (process.env.DATABASE_URL?.split('@')[1] ?? ''));

// Ground truth (via bypass) so the assertions are meaningful.
const admin = await conn(null);
await admin.query("SELECT set_config('app.bypass_rls', 'on', false)");
const totalXtechWorkflows = await countWhere(admin, 'Workflow', `WHERE "tenantId" = 'tenant-xtech'`);
await admin.end();
ok(totalXtechWorkflows >= 1, `ground truth: tenant-xtech has ${totalXtechWorkflows} workflows (bypass)`);

// 1) tenant-xtech context
const xtech = await conn('tenant-xtech');
const xtechSees = await countWhere(xtech, 'Workflow', '');
const xtechForeign = await countWhere(xtech, 'Workflow', `WHERE "tenantId" <> 'tenant-xtech'`);
ok(xtechSees === totalXtechWorkflows, `xtech sees its ${totalXtechWorkflows} workflows (got ${xtechSees})`);
ok(xtechForeign === 0, `xtech sees 0 foreign-tenant workflows (got ${xtechForeign})`);

// 4) MUST_NOT_LEAK across every RLS table under the xtech context.
let leak = 0;
for (const t of TENANT_TABLES) {
  const foreign = await countWhere(xtech, t, `WHERE "tenantId" <> 'tenant-xtech'`);
  if (foreign > 0) {
    leak += foreign;
    console.error(`    ! ${t}: ${foreign} foreign row(s) visible under xtech`);
  }
}
ok(leak === 0, `MUST_NOT_LEAK: no cross-tenant rows visible under xtech (any of ${TENANT_TABLES.length} tables)`);
await xtech.end();

// 2) demo-isolation context must NOT see xtech rows.
const demo = await conn('tenant-demo-isolation');
const demoSeesXtech = await countWhere(demo, 'Workflow', `WHERE "tenantId" = 'tenant-xtech'`);
ok(demoSeesXtech === 0, `demo-isolation sees 0 xtech workflows (got ${demoSeesXtech})`);
let demoLeak = 0;
for (const t of TENANT_TABLES) {
  demoLeak += await countWhere(demo, t, `WHERE "tenantId" = 'tenant-xtech'`);
}
ok(demoLeak === 0, `MUST_NOT_LEAK: demo-isolation sees 0 xtech rows across all tables (got ${demoLeak})`);
await demo.end();

// 3) no tenant set → 0 rows (fail-safe).
const none = await conn(null);
await none.query("SELECT set_config('app.bypass_rls', 'off', false)");
let unsetVisible = 0;
for (const t of TENANT_TABLES) unsetVisible += await countWhere(none, t, '');
ok(unsetVisible === 0, `app.current_tenant NOT set → 0 rows visible across all tables (got ${unsetVisible})`);
await none.end();

console.log(failed === 0 ? '\nRLS TEST PASSED' : `\nRLS TEST FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
