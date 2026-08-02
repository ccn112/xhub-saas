// Reset for the X.Office Management reference slice (part of test:manage-slice).
// Removes any residue from a previous seed:manage OR manage-slice-smoke run so the
// smoke starts from a clean slate. DB-only under RLS bypass; idempotent. It
// deletes the slice's own rows ONLY (mg-seed-* ids + MG-SMOKE-* natural keys) —
// it NEVER touches other modules' data or other tenants.
import 'dotenv/config';
import pg from 'pg';

const TENANT = 'tenant-xtech';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  // Order respects the MetricObservation → MetricDefinition FK.
  await c.query(`DELETE FROM "ActionCommitment" WHERE "tenantId"=$1 AND (id LIKE 'mg-seed-%' OR title LIKE 'MG-SMOKE-%' OR title LIKE 'Theo dõi sau MG-SMOKE-%')`, [TENANT]);
  await c.query(`DELETE FROM "DecisionRecord" WHERE "tenantId"=$1 AND (id LIKE 'mg-seed-%' OR question LIKE 'MG-SMOKE-%')`, [TENANT]);
  await c.query(`DELETE FROM "BusinessReview" WHERE "tenantId"=$1 AND (id LIKE 'mg-seed-%' OR title LIKE 'MG-SMOKE-%')`, [TENANT]);
  await c.query(`DELETE FROM "MetricObservation" WHERE "tenantId"=$1 AND ("metricId" IN (SELECT id FROM "MetricDefinition" WHERE "tenantId"=$1 AND (id LIKE 'mg-seed-%' OR code LIKE 'MG-SMOKE-%')))`, [TENANT]);
  await c.query(`DELETE FROM "MetricDefinition" WHERE "tenantId"=$1 AND (id LIKE 'mg-seed-%' OR code LIKE 'MG-SMOKE-%')`, [TENANT]);
  await c.query(`DELETE FROM "StrategicObjective" WHERE "tenantId"=$1 AND (id LIKE 'mg-seed-%' OR code LIKE 'MG-SMOKE-%')`, [TENANT]);
  // Work items the slice spawned/linked (bridge) — mg-seed ids + MG-SMOKE- titles.
  // WorkItemEvent has a RESTRICT fk to NativeWorkItem (event history is never
  // silently orphaned) — other seed/smoke scripts (e.g. ioc-demo-load-seed.mjs)
  // may have logged events against these same items since they were created,
  // so their event rows must go first or the delete below fails.
  await c.query(
    `DELETE FROM "WorkItemEvent" WHERE "tenantId"=$1 AND "workItemId" IN (SELECT id FROM "NativeWorkItem" WHERE "tenantId"=$1 AND (id LIKE 'mg-seed-%' OR title LIKE 'MG-SMOKE-%'))`,
    [TENANT],
  );
  await c.query(`DELETE FROM "NativeWorkItem" WHERE "tenantId"=$1 AND (id LIKE 'mg-seed-%' OR title LIKE 'MG-SMOKE-%')`, [TENANT]);

  await c.query('COMMIT');
  console.log('manage-slice reset OK | cleared mg-seed-* + MG-SMOKE-* residue for', TENANT);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('manage-slice reset FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
