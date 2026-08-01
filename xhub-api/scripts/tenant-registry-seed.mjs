// Platform Tenant Registry seeder (seed:tenant-registry) — seeds the fixed
// registry rows T001–T010 into the SHARED `Tenant` table (no-RLS, platform
// plane). Source of truth: seed-data/platform/tenants_001_010.seed.json
// (mirrors handoff data/TENANT_CATALOG_001_010.csv).
//
// T001 is the EXISTING `tenant-xtech` row: matched by id='tenant-xtech' and
// upgraded in place (id NEVER changes — ~53 RLS tables FK on this string).
// T002–T010 are registry entries only (status=PLANNED, id `tenant-<key>`); no
// org/user/business data is provisioned here (that is the Launch Factory).
//
// Idempotent: upsert-by tenantNo (T001 upsert-by id). Re-running produces NO
// duplicates. Runs under RLS bypass in a single transaction, mirroring
// scripts/role-registry-seed.mjs. Run: npm run seed:tenant-registry
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const rows = JSON.parse(
  readFileSync(join(process.cwd(), 'seed-data', 'platform', 'tenants_001_010.seed.json'), 'utf8'),
);

const XTECH_ID = 'tenant-xtech';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)"); // SET LOCAL — scoped to this tx

  let seeded = 0;
  for (const r of rows) {
    // T001 keeps the EXISTING id 'tenant-xtech'; others derive id from key.
    const id = r.tenantNo === 1 ? XTECH_ID : `tenant-${r.tenantKey}`;
    // Match an existing row by tenantNo OR (for T001) by the legacy id, so a
    // pre-existing tenant-xtech row is upgraded in place, not duplicated.
    const existing = await c.query(
      `SELECT id FROM "Tenant" WHERE "tenantNo" = $1 OR id = $2 LIMIT 1`,
      [r.tenantNo, id],
    );
    const targetId = existing.rows[0]?.id ?? id;
    // Tenant Lifecycle mode: T001 (platform owner) is EXEMPT (null); the demo
    // verticals T002–T010 default to DEMO. Never downgrade a tenant already LIVE
    // (COALESCE keeps an existing LIVE mode on re-seed).
    const mode = r.tenantNo === 1 ? null : 'DEMO';
    await c.query(
      `INSERT INTO "Tenant"
         (id, slug, name, "tenantNo", "tenantCode", "tenantKey", "tenantClass",
          industry, status, "planId", "blueprintId", mode, "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         slug=EXCLUDED.slug, name=EXCLUDED.name,
         "tenantNo"=EXCLUDED."tenantNo", "tenantCode"=EXCLUDED."tenantCode",
         "tenantKey"=EXCLUDED."tenantKey", "tenantClass"=EXCLUDED."tenantClass",
         industry=EXCLUDED.industry,
         -- Non-destructive: never downgrade a provisioned tenant. Keep an
         -- already-ACTIVE status and an already-set blueprintId (the Launch
         -- Factory writes the concrete blueprint code post-provision); only fill
         -- them from the seed when the row has not yet been provisioned.
         status=CASE WHEN "Tenant".status='ACTIVE' THEN "Tenant".status ELSE EXCLUDED.status END,
         "planId"=COALESCE("Tenant"."planId", EXCLUDED."planId"),
         "blueprintId"=COALESCE("Tenant"."blueprintId", EXCLUDED."blueprintId"),
         mode=COALESCE("Tenant".mode, EXCLUDED.mode),
         "updatedAt"=CURRENT_TIMESTAMP`,
      [
        targetId,
        r.tenantKey, // slug alias
        r.displayName,
        r.tenantNo,
        r.tenantCode,
        r.tenantKey,
        r.tenantClass,
        r.industry ?? null,
        r.status,
        r.plan ?? null,
        r.blueprint ?? null,
        mode,
      ],
    );
    seeded++;
  }

  await c.query('COMMIT');
  const total = await c.query(`SELECT COUNT(*)::int AS n FROM "Tenant" WHERE "tenantNo" IS NOT NULL`);
  console.log(`tenant-registry seed OK | rows=${seeded} | registry total=${total.rows[0].n}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('tenant-registry seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
