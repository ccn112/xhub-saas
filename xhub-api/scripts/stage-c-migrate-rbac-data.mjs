// Phase 1.5 Stage C.3 — ONE-TIME copy of existing RoleBinding/PermissionPolicy/
// DataScope/Delegation/AssignmentResolution rows from the shared (old) database
// into X.Office's own database, now that Stage C's identity-placement decision
// moved ownership of these 4+1 tables there. Idempotent (ON CONFLICT DO NOTHING
// on the primary key) — safe to re-run. Run: node scripts/stage-c-migrate-rbac-data.mjs
import 'dotenv/config';
import pg from 'pg';

const TABLES = ['RoleBinding', 'PermissionPolicy', 'DataScope', 'Delegation', 'AssignmentResolution'];

const src = new pg.Client({ connectionString: process.env.DATABASE_URL });
const dst = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await src.connect();
await dst.connect();
await src.query("SET app.bypass_rls = 'on'");
await dst.query("SET app.bypass_rls = 'on'");

for (const table of TABLES) {
  const { rows } = await src.query(`SELECT * FROM "${table}"`);
  if (rows.length === 0) {
    console.log(`${table}: 0 rows in source, skipped`);
    continue;
  }
  const columns = Object.keys(rows[0]);
  const colList = columns.map((c) => `"${c}"`).join(', ');

  // node-postgres parses jsonb columns into JS objects/arrays on SELECT, but
  // does not auto-stringify them back to JSON text on parameterized INSERT —
  // need to re-stringify ONLY the jsonb columns (native text[]/int[] columns
  // must stay raw JS arrays, which pg already serializes correctly as
  // Postgres array literals). Distinguish by querying the real column type.
  const { rows: typeRows } = await src.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`,
    [table],
  );
  const jsonbColumns = new Set(typeRows.filter((r) => r.data_type === 'jsonb').map((r) => r.column_name));
  const toParam = (col, v) =>
    v !== null && jsonbColumns.has(col) ? JSON.stringify(v) : v;

  let inserted = 0;
  for (const row of rows) {
    const values = columns.map((c) => toParam(c, row[c]));
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const res = await dst.query(
      `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
      values,
    );
    inserted += res.rowCount;
  }
  console.log(`${table}: ${rows.length} rows in source, ${inserted} inserted into X.Office DB (${rows.length - inserted} already present)`);
}

await src.end();
await dst.end();
console.log('\nSTAGE C.3 RBAC DATA MIGRATION OK');
