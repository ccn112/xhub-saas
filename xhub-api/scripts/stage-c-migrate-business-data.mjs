// Phase 1.5 Stage C.7 — full-regression finding: Stage C.3's one-time copy
// only moved the 5 RBAC tables (RoleBinding/PermissionPolicy/DataScope/
// Delegation/AssignmentResolution). It never copied the actual XOFFICE_BUSINESS
// row data (Workflow/Request/Directive/Ticket/Booking/Announcement/NativeWorkItem/
// etc.) for the pre-existing demo tenants (T002–T010) — those were provisioned
// long before the DB split and only ever wrote into the OLD (Platform) database.
// tenant-xtech and tenant-demo-isolation are EXCLUDED here on purpose: their
// X.Office-side data was already freshly re-seeded directly into the new
// database via the various `seed:*` scripts during Stage C — copying the OLD
// stale xtech/demo-isolation rows on top would duplicate/conflict with that
// fresh data. Idempotent (ON CONFLICT (id) DO NOTHING) — safe to re-run.
// Run: node scripts/stage-c-migrate-business-data.mjs
import 'dotenv/config';
import pg from 'pg';

const EXCLUDED_TENANTS = ['tenant-xtech', 'tenant-demo-isolation'];

// Parent-before-child order (same table list as rls-setup-xoffice.mjs).
const TABLES = [
  'Workflow', 'WorkflowInstance', 'ApprovalTask', 'WorkflowEvent', 'AuditLog',
  'ConnectorCommand', 'UnifiedWorkItem', 'CommandLog', 'ExternalExecution',
  'Notification',
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
  'SceneBinding', 'TwinSceneVersion',
  // IconAsset excluded: already seeded per-tenant by ioc-template-catalog-seed.mjs
  // (BUILT_IN icon rows, different id generation, would collide on the
  // (tenantId, key) unique constraint rather than id).
  'DataLayerDefinition',
  'DashboardDefinition', 'DashboardVersion',
  'PeopleTenantConfig', 'LeavePolicyRef', 'LeaveBalanceSnapshot', 'LeaveRequest',
  'LeaveImpactSnapshot', 'OvertimeRequest',
  'Initiative', 'Portfolio', 'BenefitProfile',
  'WorkCalendar', 'ShiftPattern', 'ShiftAssignment', 'AttendanceImportBatch',
  'AttendanceEvent', 'AttendanceDay', 'AttendanceCorrectionRequest',
];

const src = new pg.Client({ connectionString: process.env.DATABASE_URL });
const dst = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await src.connect();
await dst.connect();
await src.query("SET app.bypass_rls = 'on'");
await dst.query("SET app.bypass_rls = 'on'");

let totalCopied = 0;
for (const table of TABLES) {
  const hasTenantId = (await src.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'tenantId'`,
    [table],
  )).rowCount > 0;

  const rows = hasTenantId
    ? (await src.query(`SELECT * FROM "${table}" WHERE "tenantId" <> ALL($1::text[])`, [EXCLUDED_TENANTS])).rows
    : (await src.query(`SELECT * FROM "${table}"`)).rows;

  if (rows.length === 0) {
    console.log(`${table}: 0 rows to migrate`);
    continue;
  }

  const columns = Object.keys(rows[0]);
  const colList = columns.map((c) => `"${c}"`).join(', ');

  const { rows: typeRows } = await src.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`,
    [table],
  );
  const jsonbColumns = new Set(typeRows.filter((r) => r.data_type === 'jsonb').map((r) => r.column_name));
  const toParam = (col, v) => (v !== null && jsonbColumns.has(col) ? JSON.stringify(v) : v);

  let inserted = 0;
  for (const row of rows) {
    const values = columns.map((c) => toParam(c, row[c]));
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const res = await dst.query(
      `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
      values,
    );
    inserted += res.rowCount;
  }
  totalCopied += inserted;
  console.log(`${table}: ${rows.length} rows in source (non-excluded tenants), ${inserted} inserted (${rows.length - inserted} already present)`);
}

await src.end();
await dst.end();
console.log(`\nSTAGE C.7 BUSINESS DATA MIGRATION OK — ${totalCopied} rows copied total`);
