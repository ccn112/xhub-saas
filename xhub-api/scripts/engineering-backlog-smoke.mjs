// Engineering Governance — Feature/BacklogItem smoke (test:engineering-backlog,
// DG-02). Server must be up on :4000 with products seeded.
// Proves: create feature+backlog item; FSM guard (illegal jump rejected,
// legal chain accepted); enforcement on write routes.
// Run: node scripts/engineering-backlog-smoke.mjs
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

console.log('Engineering Backlog smoke @ ' + BASE);

try {
  const prod = await j('/api/engineering/products/PRD-XHUB');
  const productId = prod.body.id;

  const feat = await j('/api/engineering/features', { method: 'POST', body: JSON.stringify({ productId, code: 'FEA-SMOKE-TEST', title: 'Smoke feature' }) });
  ok(feat.status === 201 || feat.status === 200, `feature created (got ${feat.status})`);
  const featureId = feat.body.id;

  const item = await j('/api/engineering/backlog', { method: 'POST', body: JSON.stringify({ productId, featureId, code: 'BLG-SMOKE-TEST', title: 'Smoke item' }) });
  ok(item.status === 201 || item.status === 200, `backlog item created (got ${item.status})`);
  ok(item.body.status === 'IDEA', `new item starts IDEA (got ${item.body.status})`);
  const itemId = item.body.id;

  const illegal = await j(`/api/engineering/backlog/${itemId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'RELEASED' }) });
  ok(illegal.status === 400, `IDEA -> RELEASED (skip) rejected 400 (got ${illegal.status})`);

  const step1 = await j(`/api/engineering/backlog/${itemId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'TRIAGED' }) });
  ok(step1.status === 200 && step1.body.status === 'TRIAGED', `IDEA -> TRIAGED accepted (got ${step1.status}/${step1.body.status})`);

  const lowCreate = await j('/api/engineering/backlog', { method: 'POST', body: JSON.stringify({ productId, code: 'BLG-SHOULD-FAIL', title: 'x' }) }, LOWPRIV);
  ok(lowCreate.status === 403, `non-admin create backlog item -> 403 (got ${lowCreate.status})`);
  const lowRead = await j('/api/engineering/backlog?productId=' + productId, {}, LOWPRIV);
  ok(lowRead.status === 200, `non-admin read backlog -> 200 (got ${lowRead.status})`);

  // Cleanup
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('DELETE FROM "BacklogItem" WHERE code IN ($1,$2)', ['BLG-SMOKE-TEST', 'BLG-SHOULD-FAIL']);
  const delFeat = await c.query('DELETE FROM "Feature" WHERE code = $1 RETURNING id', ['FEA-SMOKE-TEST']);
  ok(delFeat.rowCount === 1, 'smoke feature/backlog cleaned up');
  await c.end();
} catch (e) {
  console.error('  ✗ unexpected error:', e.message);
  failed++;
}

if (failed > 0) { console.error(`\nENGINEERING BACKLOG SMOKE FAILED (${failed})`); process.exit(1); }
console.log('\nENGINEERING BACKLOG SMOKE PASSED');
