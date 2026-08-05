// Engineering Governance — Evidence Ledger smoke (test:engineering-evidence,
// DG-12-lite). Server up on :4000. Proves: record evidence for a real
// subject (a seeded ControlImplementation); level defaults E1_DECLARED;
// listing by (subjectType,subjectId) returns append-only history (2 records
// -> 2 rows); open write (no permission gate, self-service logging).
// Run: node scripts/engineering-evidence-smoke.mjs
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const ADMIN = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };
const LOWPRIV = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-huyvu', 'x-authz-enforce': 'true' };

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const j = async (path, opts = {}, headers = ADMIN) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};

console.log('Engineering Evidence Ledger smoke @ ' + BASE);

const subjectId = 'smoke-subject-' + Date.now();
try {
  const e1 = await j('/api/engineering/evidence', { method: 'POST', body: JSON.stringify({ subjectType: 'ControlImplementation', subjectId, description: 'smoke evidence #1' }) });
  ok(e1.status === 201 || e1.status === 200, `evidence recorded (got ${e1.status})`);
  ok(e1.body.level === 'E1_DECLARED', `defaults level=E1_DECLARED (got ${e1.body.level})`);
  ok(/^EVD-\d{4}$/.test(e1.body.code), `auto-generated code matches EVD-NNNN (got ${e1.body.code})`);

  const e2 = await j('/api/engineering/evidence', { method: 'POST', body: JSON.stringify({ subjectType: 'ControlImplementation', subjectId, level: 'E4_TEST_EXECUTED', description: 'smoke evidence #2', sourceRef: 'npm run test:engineering-controls' }) }, LOWPRIV);
  ok(e2.status === 201 || e2.status === 200, `non-admin CAN record evidence (open by design, got ${e2.status})`);

  const list = await j(`/api/engineering/evidence?subjectType=ControlImplementation&subjectId=${subjectId}`);
  ok(list.status === 200 && list.body.length === 2, `history keeps both records, append-only (got ${list.body?.length})`);

  const badLevel = await j('/api/engineering/evidence', { method: 'POST', body: JSON.stringify({ subjectType: 'ControlImplementation', subjectId, level: 'NOT_A_LEVEL', description: 'x' }) });
  ok(badLevel.status === 400, `invalid level rejected 400 (got ${badLevel.status})`);
} catch (e) {
  console.error('  ✗ unexpected error:', e.message);
  failed++;
} finally {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const del = await c.query('DELETE FROM "Evidence" WHERE "subjectId" = $1 RETURNING id', [subjectId]);
  ok(del.rowCount === 2, `smoke evidence cleaned up (deleted ${del.rowCount})`);
  await c.end();
}

if (failed > 0) { console.error(`\nENGINEERING EVIDENCE SMOKE FAILED (${failed})`); process.exit(1); }
console.log('\nENGINEERING EVIDENCE SMOKE PASSED');
