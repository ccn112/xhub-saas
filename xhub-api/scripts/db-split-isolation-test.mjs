// Phase 1.5 Stage C.6 — negative test proving the Platform DB and the X.Office
// DB are genuinely two separate physical databases, not just two schemas/two
// tenant-scoped views of ONE shared database. This is the risk unique to a
// live DB split (as opposed to RLS's usual per-tenant proof, already covered
// by rls-test.mjs / rls-test-xoffice.mjs): did the split actually happen, or
// are both env vars silently pointing at the same Postgres instance?
// Run: node scripts/db-split-isolation-test.mjs   (or: npm run test:db-split)
import 'dotenv/config';
import pg from 'pg';

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else {
    console.error('  ✗ ' + msg);
    failed++;
  }
};

const platform = new pg.Client({ connectionString: process.env.DATABASE_URL });
const xoffice = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await platform.connect();
await xoffice.connect();

console.log('DB split isolation test — Platform vs X.Office physical databases');

// 1) The two connection strings resolve to genuinely different databases.
const platformDb = (await platform.query('SELECT current_database() AS db')).rows[0].db;
const xofficeDb = (await xoffice.query('SELECT current_database() AS db')).rows[0].db;
ok(platformDb !== xofficeDb, `DATABASE_URL (${platformDb}) and XOFFICE_DATABASE_URL (${xofficeDb}) are different databases`);

// 2) Tenant is Platform-canonical — must exist there, and must NOT exist as a
// model in X.Office's own schema (Stage C's identity-placement decision).
const platformHasTenant = (await platform.query(
  `SELECT to_regclass('public."Tenant"') IS NOT NULL AS present`,
)).rows[0].present;
ok(platformHasTenant, 'Tenant table exists in the Platform database (canonical registry)');
const xofficeHasTenant = (await xoffice.query(
  `SELECT to_regclass('public."Tenant"') IS NOT NULL AS present`,
)).rows[0].present;
ok(!xofficeHasTenant, "X.Office's own database has NO Tenant table (by design — see prisma-xoffice/schema.prisma)");

// 3) Write a uniquely-marked row into X.Office's OWN Request table (bypassing
// RLS since this is a cross-DB structural check, not a tenant-scoping one),
// then prove it is invisible from the Platform connection — either because
// Platform's Request table is a stale, disconnected copy that never receives
// this write, or (post-full-cutover) doesn't exist there at all.
const marker = `DBSPLIT-ISO-${Date.now().toString(36)}`;
const markerId = `dbsplit-iso-${Date.now().toString(36)}`;
await xoffice.query("SELECT set_config('app.bypass_rls', 'on', false)");
await xoffice.query(
  `INSERT INTO "Request" (id, "tenantId", code, "procedureCode", title, "requesterId", state, "createdAt", "updatedAt")
   VALUES ($1, 'tenant-xtech', $2, 'DB_SPLIT_ISO_CHECK', 'db-split isolation marker', 'user-nam', 'DRAFT', now(), now())`,
  [markerId, marker],
);
const seenInXoffice = (await xoffice.query(`SELECT count(*)::int AS n FROM "Request" WHERE code = $1`, [marker])).rows[0].n;
ok(seenInXoffice === 1, `marker row visible in X.Office's own Request table (got ${seenInXoffice})`);

const platformHasRequestTable = (await platform.query(
  `SELECT to_regclass('public."Request"') IS NOT NULL AS present`,
)).rows[0].present;
let seenInPlatform = 0;
if (platformHasRequestTable) {
  await platform.query("SELECT set_config('app.bypass_rls', 'on', false)");
  seenInPlatform = (await platform.query(`SELECT count(*)::int AS n FROM "Request" WHERE code = $1`, [marker])).rows[0].n;
}
ok(seenInPlatform === 0, `marker row written to X.Office DB does NOT leak into the Platform database (got ${seenInPlatform})`);

// self-clean
await xoffice.query('DELETE FROM "Request" WHERE code = $1', [marker]);

await platform.end();
await xoffice.end();

console.log(failed === 0 ? '\nDB SPLIT ISOLATION TEST PASSED' : `\nDB SPLIT ISOLATION TEST FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
