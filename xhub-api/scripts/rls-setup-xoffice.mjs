// Idempotent Postgres Row-Level Security (RLS) setup for the X.Office database
// (Phase 1.5 Stage C — physically separate from XHub Platform's DATABASE_URL).
// Mirrors scripts/rls-setup.mjs exactly (same ENABLE+FORCE RLS + tenant_isolation
// policy pattern); table list is the 89 X.Office-owned tenant-scoped tables
// (93 models in prisma-xoffice/schema.prisma minus WorkflowVersion/WorkflowNode/
// WorkflowEdge — reachable only via parent Workflow, same as before the split —
// and IocTemplate, a shared/global catalog table with no tenantId column).
// Run: node scripts/rls-setup-xoffice.mjs   (or: npm run rls:setup:xoffice)
import 'dotenv/config';
import pg from 'pg';

const TENANT_TABLES = [
  'Workflow', 'WorkflowInstance', 'ApprovalTask', 'WorkflowEvent', 'AuditLog',
  'ConnectorCommand', 'UnifiedWorkItem', 'CommandLog', 'ExternalExecution',
  'Delegation', 'Notification',
  // Identity/Org Core — local cache (Person/OrgUnit/Position/Group) + local RBAC
  // ownership (RoleBinding/PermissionPolicy/DataScope/AssignmentResolution),
  // per the Stage C identity-placement decision.
  'PersonProfile', 'OrgUnit', 'Position', 'PositionAssignment', 'Group',
  'RoleBinding', 'PermissionPolicy', 'DataScope', 'AssignmentResolution',
  // Membership — read cache (Stage C follow-up, 2026-08-04). See the model
  // comment in prisma-xoffice/schema.prisma.
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
  // Phase 2 — Revenue & Contract MVP, slice 1 (2026-08-05).
  'Customer', 'Contact', 'CustomerEvent',
  // Phase 2 — Revenue & Contract MVP, slices 2-8 (2026-08-05).
  'Opportunity', 'OpportunityEvent', 'CommercialCatalogItem',
  'Proposal', 'ProposalLine', 'ProposalEvent',
  'Contract', 'ContractLine', 'ContractSignature', 'ContractObligation',
  'BillingRequest', 'ContractEvent',
  // Product Customer Support (2026-08-06).
  'SupportCase', 'SupportCaseEvent',
];

const PREDICATE =
  `current_setting('app.bypass_rls', true) = 'on' ` +
  `OR "tenantId" = current_setting('app.current_tenant', true)`;

const client = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await client.connect();

for (const t of TENANT_TABLES) {
  await client.query(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`);
  await client.query(`ALTER TABLE "${t}" FORCE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS tenant_isolation ON "${t}"`);
  await client.query(
    `CREATE POLICY tenant_isolation ON "${t}" ` +
      `USING (${PREDICATE}) WITH CHECK (${PREDICATE})`,
  );
  console.log(`  RLS enabled + policy set: ${t}`);
}

// Same GIN indexes as the platform-side script (NativeWorkItem lives here now).
await client.query(`CREATE INDEX IF NOT EXISTS "NativeWorkItem_tags_gin" ON "NativeWorkItem" USING GIN ("tags")`);
await client.query(`CREATE INDEX IF NOT EXISTS "NativeWorkItem_dimensions_gin" ON "NativeWorkItem" USING GIN ("dimensions" jsonb_path_ops)`);
console.log('  GIN indexes ensured: NativeWorkItem(tags), NativeWorkItem(dimensions)');

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
console.log(`\nRLS SETUP OK (xoffice DB) | ${TENANT_TABLES.length} tables`);

await client.end();
