// Reset Records runtime state so the smoke is re-runnable. Bypasses RLS to
// delete DocumentVersion / RecordDocument rows for the test tenants.
// Run: node scripts/records-reset.mjs  (or via npm run test:records)
// Phase 1.5 Stage C: RecordDocument/DocumentVersion now live in the X.Office
// database, not the shared one — connect via XOFFICE_DATABASE_URL.
import 'dotenv/config';
import pg from 'pg';

const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await c.connect();
await c.query("SELECT set_config('app.bypass_rls','on',false)");

const TENANTS = ['tenant-xtech', 'tenant-demo-isolation'];
let dv = 0, rd = 0;
for (const t of TENANTS) {
  dv += (await c.query(`DELETE FROM "DocumentVersion" WHERE "tenantId"=$1`, [t])).rowCount;
  rd += (await c.query(`DELETE FROM "RecordDocument" WHERE "tenantId"=$1`, [t])).rowCount;
}
console.log(`records reset OK | documentVersions=${dv} documents=${rd}`);
await c.end();
