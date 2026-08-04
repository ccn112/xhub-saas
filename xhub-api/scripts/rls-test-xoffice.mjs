// DB-level RLS proof for X.Office's OWN database (Phase 1.5 Stage C.6 —
// isolation sweep post-DB-split). Mirrors scripts/rls-test.mjs exactly (same
// 4 invariants), but connects to XOFFICE_DATABASE_URL and checks the 89
// X.Office-owned tenant-scoped tables (same list as scripts/rls-setup-xoffice.mjs).
// Run: node scripts/rls-test-xoffice.mjs   (or: npm run test:rls-xoffice)
import 'dotenv/config';
import pg from 'pg';

const TENANT_TABLES = [
  'Workflow', 'WorkflowInstance', 'ApprovalTask', 'WorkflowEvent', 'AuditLog',
  'ConnectorCommand', 'UnifiedWorkItem', 'CommandLog', 'ExternalExecution',
  'Delegation', 'Notification',
  'PersonProfile', 'OrgUnit', 'Position', 'PositionAssignment', 'Group',
  'RoleBinding', 'PermissionPolicy', 'DataScope', 'AssignmentResolution',
  'Membership',
  'RecordDocument', 'DocumentVersion',
  'Request', 'RequestComment', 'RequestEvent',
  'Directive', 'DirectiveAssignment', 'DirectiveEvent',
  'ServiceCatalogItem', 'Ticket', 'TicketEvent',
  'BookableResource', 'Booking', 'BookingEvent',
  'Announcement', 'AnnouncementReceipt', 'AnnouncementEvent',
  'Engagement', 'EngagementEvent',
  'NativeWorkItem', 'WorkItemComment', 'WorkItemChecklistItem', 'WorkItemEvent', 'WorkDimension',
  'ExecutionProject', 'ExecutionProjectEvent', 'WorkDependency', 'ProjectBaseline',
  'BaselineItem', 'ProjectRoleAssignment', 'CoordinationShare',
  'StrategicObjective', 'MetricDefinition', 'MetricObservation', 'BusinessReview',
  'DecisionRecord', 'ActionCommitment',
  'Scorecard', 'OKRCycle', 'OKRObjective', 'KeyResult', 'KeyResultCheckIn',
  'TwinSite', 'TwinFloor', 'FloorPlanDefinition', 'FloorPlanVersion', 'TwinScene',
  'SceneBinding', 'TwinSceneVersion', 'IconAsset', 'DataLayerDefinition',
  'DashboardDefinition', 'DashboardVersion',
  'PeopleTenantConfig', 'LeavePolicyRef', 'LeaveBalanceSnapshot', 'LeaveRequest',
  'LeaveImpactSnapshot', 'OvertimeRequest',
  'Initiative', 'Portfolio', 'BenefitProfile',
  'WorkCalendar', 'ShiftPattern', 'ShiftAssignment', 'AttendanceImportBatch',
  'AttendanceEvent', 'AttendanceDay', 'AttendanceCorrectionRequest',
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
  const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
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

console.log('RLS DB-level isolation test (X.Office DB) @ ' + (process.env.XOFFICE_DATABASE_URL?.split('@')[1] ?? ''));

// Ground truth (via bypass) so the assertions are meaningful.
const admin = await conn(null);
await admin.query("SELECT set_config('app.bypass_rls', 'on', false)");
const totalXtechRequests = await countWhere(admin, 'Request', `WHERE "tenantId" = 'tenant-xtech'`);
await admin.end();
ok(totalXtechRequests >= 1, `ground truth: tenant-xtech has ${totalXtechRequests} requests (bypass)`);

// 1) tenant-xtech context
const xtech = await conn('tenant-xtech');
const xtechSees = await countWhere(xtech, 'Request', '');
const xtechForeign = await countWhere(xtech, 'Request', `WHERE "tenantId" <> 'tenant-xtech'`);
ok(xtechSees === totalXtechRequests, `xtech sees its ${totalXtechRequests} requests (got ${xtechSees})`);
ok(xtechForeign === 0, `xtech sees 0 foreign-tenant requests (got ${xtechForeign})`);

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
const demoSeesXtech = await countWhere(demo, 'Request', `WHERE "tenantId" = 'tenant-xtech'`);
ok(demoSeesXtech === 0, `demo-isolation sees 0 xtech requests (got ${demoSeesXtech})`);
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

console.log(failed === 0 ? '\nRLS TEST (X.Office DB) PASSED' : `\nRLS TEST (X.Office DB) FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
