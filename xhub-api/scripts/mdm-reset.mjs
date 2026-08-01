// Reset MDM runtime state for tenant-xtech so the smoke is re-runnable.
// Bypasses RLS to clear the tenant's ingestion state + the project master(s) it
// produced. Preserves the tenant-demo-isolation MUST_NOT_LEAK canary and the
// shared GEOGRAPHY reference masters (they are re-seeded only at server boot).
import 'dotenv/config';
import pg from 'pg';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
await c.query("SELECT set_config('app.bypass_rls','on',false)");
const t = 'tenant-xtech';

// Masters produced from tenant-xtech project ingestion (shared PROJECT masters
// whose lineage is a tenant-xtech source record) — drop them so the smoke
// starts clean. Geography (domain=GEOGRAPHY) is preserved.
const masterIds = (
  await c.query(
    `SELECT DISTINCT m.id FROM "MasterRecord" m
       JOIN "SourceRecord" s ON s."masterRecordId" = m.id
      WHERE s."tenantId" = $1 AND m.domain = 'PROJECT'`,
    [t],
  )
).rows.map((r) => r.id);

const dp = await c.query(`DELETE FROM "DuplicatePair" WHERE "tenantId"=$1`, [t]);
const ov = await c.query(`DELETE FROM "TenantMasterOverlay" WHERE "tenantId"=$1`, [t]);
await c.query(`UPDATE "SourceRecord" SET "masterRecordId"=NULL WHERE "tenantId"=$1`, [t]);
const sr = await c.query(`DELETE FROM "SourceRecord" WHERE "tenantId"=$1`, [t]);
const ij = await c.query(`DELETE FROM "ImportJob" WHERE "tenantId"=$1`, [t]);
let mr = { rowCount: 0 };
if (masterIds.length) {
  mr = await c.query(`DELETE FROM "MasterRecord" WHERE id = ANY($1::text[])`, [masterIds]);
}

console.log(
  `mdm reset OK | masters=${mr.rowCount} sourceRecords=${sr.rowCount} importJobs=${ij.rowCount} dupPairs=${dp.rowCount} overlays=${ov.rowCount}`,
);
await c.end();
