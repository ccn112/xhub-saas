// Batch demo-tenant provisioner (SaaS step 6b) — npm run provision:demos.
//
// Provisions the 8 vertical demo tenants T003–T010 in ONE idempotent, resumable
// loop over the demo-tenants.params.mjs table, each via the SAME generalized
// provisionTenant() engine (no per-tenant branch logic). After the loop it seeds
// a per-tenant backup schedule for every newly-ACTIVE tenant (extends
// seed:backup-schedules coverage to the 8 new tenants).
//
// Idempotent + resumable: re-running skips already-ACTIVE tenants (zero dupes)
// and, if a run is interrupted, a later run finishes the rest. On a per-tenant
// failure the batch keeps going and reports which tenants remain at the end
// (non-zero exit) so the operator can re-run.
//
// Requires: DATABASE_URL + an API on :4000. Server not rebuilt (script + JSON).
import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { BATCH_TENANTS } from './demo-tenants.params.mjs';
import { provisionTenant } from './provision-tenant.mjs';

const BACKUP_DEFAULT = { frequency: 'DAILY', hourUtc: 19, retentionDays: 35, retentionWeeks: 12, retentionMonths: 12 };
function nextDailyRun(hourUtc) {
  const n = new Date();
  n.setUTCMinutes(0, 0, 0);
  n.setUTCHours(hourUtc);
  if (n.getTime() <= Date.now()) n.setUTCDate(n.getUTCDate() + 1);
  return n;
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const done = [];
const skipped = [];
const failed = [];
const creds = [];

console.log(`Provision demo tenants T003–T010 (${BATCH_TENANTS.length}) @ ${process.env.XOFFICE_BASE || 'http://localhost:4000'}\n`);
try {
  for (const t of BATCH_TENANTS) {
    const envCode = `T${String(t.no).padStart(3, '0')}`;
    try {
      let step = 0;
      const log = (m) => console.log(`  [${envCode}:${++step}] ${m}`);
      const res = await provisionTenant(t.no, { db, log });
      if (res.skipped) skipped.push(envCode);
      else { done.push(envCode); if (res.admin) creds.push({ envCode, id: t.id, ...res }); }

      // Ensure a backup schedule row for the (now ACTIVE) tenant — idempotent.
      await db.query("SELECT set_config('app.bypass_rls','on',true)");
      await db.query(
        `INSERT INTO "BackupSchedule" (id, "tenantId", enabled, frequency, "hourUtc", "retentionDays", "retentionWeeks", "retentionMonths", "nextRunAt", "updatedAt")
         VALUES ($1,$2,true,$3,$4,$5,$6,$7,$8, now())
         ON CONFLICT ("tenantId") DO UPDATE SET "nextRunAt"=EXCLUDED."nextRunAt", "updatedAt"=now()`,
        [randomUUID(), t.id, BACKUP_DEFAULT.frequency, BACKUP_DEFAULT.hourUtc, BACKUP_DEFAULT.retentionDays, BACKUP_DEFAULT.retentionWeeks, BACKUP_DEFAULT.retentionMonths, nextDailyRun(BACKUP_DEFAULT.hourUtc)],
      );
      await db.query("SELECT set_config('app.bypass_rls','on',false)");
      console.log(`  [${envCode}] backup schedule ensured\n`);
    } catch (e) {
      await db.query('ROLLBACK').catch(() => {});
      failed.push({ envCode, error: e?.message ?? String(e) });
      console.error(`  [${envCode}] FAILED: ${e?.message ?? e}\n`);
    }
  }
} finally {
  await db.end();
}

console.log('=== BATCH SUMMARY ===');
console.log(`  provisioned: ${done.join(', ') || '(none new)'}`);
console.log(`  skipped (already ACTIVE): ${skipped.join(', ') || '(none)'}`);
if (failed.length) console.log(`  FAILED (re-run to resume): ${failed.map((f) => f.envCode).join(', ')}`);
if (creds.length) {
  console.log('\n  new login credentials (ENV-overridable T00N_ADMIN_PASSWORD / T00N_EMP_PASSWORD; not stored in repo):');
  for (const c of creds) {
    console.log(`    ${c.envCode} (x-tenant-id: ${c.id})`);
    console.log(`      admin    userId=${c.admin.userId}  password=${c.admin.password}`);
    console.log(`      employee userId=${c.employee.userId}  password=${c.employee.password}`);
  }
}
console.log(failed.length ? `\nprovision:demos INCOMPLETE — ${failed.length} remaining` : '\nprovision:demos OK — all T003–T010 ACTIVE');
process.exit(failed.length ? 1 : 0);
