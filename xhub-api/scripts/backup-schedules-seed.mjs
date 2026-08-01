// Default per-tenant backup schedules seeder (seed:backup-schedules) — PH-04.
//
// Creates ONE BackupSchedule for every ACTIVE registry tenant (shared Tenant
// table; T001=tenant-xtech, T002=tenant-realestate-demo) with the platform
// default: DAILY / 02:00 Asia/Bangkok (hourUtc=19) / retention 35d-12w-12m.
//
// The BackupSchedule table is SHARED (platform plane, no RLS) — like Tenant —
// so this seeds under app.bypass_rls in one tx. Idempotent: upsert-by tenantId,
// re-running produces NO duplicates and does not clobber a customised schedule's
// enable/frequency/retention (only fills in a missing row + refreshes nextRunAt).
// Run: npm run seed:backup-schedules  (needs DATABASE_URL; server not required)
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const DEFAULT = { frequency: 'DAILY', hourUtc: 19, retentionDays: 35, retentionWeeks: 12, retentionMonths: 12 };

/** Next occurrence of hourUtc (UTC), DAILY. */
function nextDailyRun(hourUtc) {
  const next = new Date();
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(hourUtc);
  if (next.getTime() <= Date.now()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  // Commercial registry tenants only (tenantNo NOT NULL, like GET /api/platform/tenants):
  // T001=tenant-xtech, T002=tenant-realestate-demo. Excludes system/sandbox/demo-isolation.
  const active = (await c.query(`SELECT id FROM "Tenant" WHERE status='ACTIVE' AND "tenantNo" IS NOT NULL ORDER BY "tenantNo"`)).rows;
  let created = 0;
  let existing = 0;
  for (const t of active) {
    const nextRunAt = nextDailyRun(DEFAULT.hourUtc);
    const r = await c.query(
      `INSERT INTO "BackupSchedule"
         (id, "tenantId", enabled, frequency, "hourUtc", "retentionDays", "retentionWeeks", "retentionMonths", "nextRunAt", "updatedAt")
       VALUES ($1,$2,true,$3,$4,$5,$6,$7,$8, now())
       ON CONFLICT ("tenantId") DO UPDATE SET "nextRunAt" = EXCLUDED."nextRunAt", "updatedAt" = now()
       RETURNING (xmax = 0) AS inserted`,
      [
        randomUUID(),
        t.id,
        DEFAULT.frequency,
        DEFAULT.hourUtc,
        DEFAULT.retentionDays,
        DEFAULT.retentionWeeks,
        DEFAULT.retentionMonths,
        nextRunAt,
      ],
    );
    if (r.rows[0].inserted) created++;
    else existing++;
  }

  await c.query('COMMIT');
  console.log(`backup-schedules seed OK | activeTenants=${active.length} created=${created} existing=${existing} default=DAILY/hourUtc=${DEFAULT.hourUtc}/35d-12w-12m`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('backup-schedules seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
