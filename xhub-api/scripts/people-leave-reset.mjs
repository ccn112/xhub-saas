// Reset for People Essentials PE-01 smoke (part of test:people-leave). Removes
// any residue from a previous people-leave-smoke run so the smoke starts from
// a clean slate. DB-only under RLS bypass; idempotent. Deletes ONLY rows
// tagged with the smoke idempotencyKey prefix `pe-smoke-` (+ their dependent
// LeaveBalanceSnapshot/LeaveImpactSnapshot/WorkflowInstance/ApprovalTask rows)
// — it NEVER touches seed:people-leave data (`people-seed-*` ids) or other
// tenants/modules.
import 'dotenv/config';
import pg from 'pg';

const TENANT = 'tenant-xtech';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  const leaveIds = (
    await c.query(`SELECT id, "workflowInstanceId" FROM "LeaveRequest" WHERE "tenantId"=$1 AND "idempotencyKey" LIKE 'pe-smoke-%'`, [TENANT])
  ).rows;
  const otIds = (
    await c.query(`SELECT id, "workflowInstanceId" FROM "OvertimeRequest" WHERE "tenantId"=$1 AND "idempotencyKey" LIKE 'pe-smoke-%'`, [TENANT])
  ).rows;
  const instanceIds = [...leaveIds, ...otIds].map((r) => r.workflowInstanceId).filter(Boolean);
  const leaveRequestIds = leaveIds.map((r) => r.id);

  if (leaveRequestIds.length) {
    await c.query(`DELETE FROM "LeaveImpactSnapshot" WHERE "tenantId"=$1 AND "leaveRequestId" = ANY($2::text[])`, [TENANT, leaveRequestIds]);
    await c.query(`DELETE FROM "LeaveBalanceSnapshot" WHERE "tenantId"=$1 AND "sourceLeaveRequestId" = ANY($2::text[])`, [TENANT, leaveRequestIds]);
  }
  if (instanceIds.length) {
    await c.query(`DELETE FROM "ApprovalTask" WHERE "tenantId"=$1 AND "instanceId" = ANY($2::text[])`, [TENANT, instanceIds]);
    await c.query(`DELETE FROM "WorkflowInstance" WHERE "tenantId"=$1 AND id = ANY($2::text[])`, [TENANT, instanceIds]);
  }
  await c.query(`DELETE FROM "LeaveRequest" WHERE "tenantId"=$1 AND "idempotencyKey" LIKE 'pe-smoke-%'`, [TENANT]);
  await c.query(`DELETE FROM "OvertimeRequest" WHERE "tenantId"=$1 AND "idempotencyKey" LIKE 'pe-smoke-%'`, [TENANT]);

  await c.query('COMMIT');
  console.log(`people-leave reset OK | cleared ${leaveRequestIds.length} leave + ${otIds.length} overtime smoke rows for ${TENANT}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('people-leave reset FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
