// Engineering Governance — Document smoke (test:engineering-docs, DG-03-lite).
// Server must be up on :4000 with products seeded.
// Proves: list finds the seeded Security Standards doc with real
// standardsRefs; create+edit works; a body containing a secret-shaped value
// is rejected (MUST_NOT_LEAK); enforcement on write routes.
// Run: node scripts/engineering-docs-smoke.mjs
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

console.log('Engineering Docs smoke @ ' + BASE);

try {
  const prod = await j('/api/engineering/products/PRD-XHUB');
  const productId = prod.body.id;

  const list = await j('/api/engineering/documents?productId=' + productId);
  ok(list.status === 200, `GET documents 200 (got ${list.status})`);
  const secDoc = (list.body ?? []).find((d) => d.code === 'XHUB-SEC-STANDARDS');
  ok(!!secDoc, 'seeded Security Standards document present');
  ok(Array.isArray(secDoc?.standardsRefs) && secDoc.standardsRefs.includes('OWASP-API-Security-Top10-2023:API1'), 'standardsRefs cites OWASP API1:2023 (BOLA)');
  ok(secDoc?.status === 'PUBLISHED', `security doc is PUBLISHED (got ${secDoc?.status})`);

  const created = await j('/api/engineering/documents', { method: 'POST', body: JSON.stringify({ productId, code: 'DOC-SMOKE-TEST', title: 'Smoke doc', body: 'hello' }) });
  ok(created.status === 201 || created.status === 200, `doc created (got ${created.status})`);
  const docId = created.body.id;

  // Fixture placeholder (not a real key) — the /* placeholder */ marker keeps
  // scripts/secret-scan.mjs's repo-wide scan from flagging this intentional
  // secret-shaped test value (see its ALLOW_SUBSTRINGS list).
  const secretBody = await j(`/api/engineering/documents/${docId}`, { method: 'PATCH', body: JSON.stringify({ body: /* placeholder */ 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890ABCD' }) });
  ok(secretBody.status >= 400, `body with secret-shaped value rejected (got ${secretBody.status})`);

  const edit = await j(`/api/engineering/documents/${docId}`, { method: 'PATCH', body: JSON.stringify({ body: 'updated content', status: 'REVIEW' }) });
  ok(edit.status === 200 && edit.body.version === 2, `edit bumps version to 2 (got ${edit.status}/${edit.body.version})`);

  const lowCreate = await j('/api/engineering/documents', { method: 'POST', body: JSON.stringify({ productId, code: 'DOC-SHOULD-FAIL', title: 'x' }) }, LOWPRIV);
  ok(lowCreate.status === 403, `non-admin create doc -> 403 (got ${lowCreate.status})`);

  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const del = await c.query('DELETE FROM "EngineeringDocument" WHERE code = $1 RETURNING id', ['DOC-SMOKE-TEST']);
  ok(del.rowCount === 1, 'smoke doc cleaned up');
  await c.end();
} catch (e) {
  console.error('  ✗ unexpected error:', e.message);
  failed++;
}

if (failed > 0) { console.error(`\nENGINEERING DOCS SMOKE FAILED (${failed})`); process.exit(1); }
console.log('\nENGINEERING DOCS SMOKE PASSED');
