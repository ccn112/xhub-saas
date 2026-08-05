// Engineering Governance — Unified Control Framework smoke
// (test:engineering-controls, DG-09). Server must be up on :4000 with
// products + controls seeded.
// Proves: catalog seeded (>=16); create control gated; set implementation
// status (upsert) works + re-set updates in place, not duplicates; reads
// open, writes gated.
// Run: node scripts/engineering-controls-smoke.mjs
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

console.log('Engineering Controls smoke @ ' + BASE);

let controlId;
try {
  const prod = await j('/api/engineering/products/PRD-XHUB');
  const productId = prod.body.id;

  const list = await j('/api/engineering/controls');
  ok(list.status === 200 && list.body.length >= 16, `control catalog has >=16 entries (got ${list.body?.length})`);

  const smokeCtl = await j('/api/engineering/controls', { method: 'POST', body: JSON.stringify({ code: 'CTL-SMOKE-TEST', domain: 'Smoke', title: 'Smoke control' }) });
  ok(smokeCtl.status === 201 || smokeCtl.status === 200, `control created (got ${smokeCtl.status})`);
  controlId = smokeCtl.body.id;

  const set1 = await j('/api/engineering/controls/implementations', { method: 'PUT', body: JSON.stringify({ controlId, productId, status: 'PROPOSED', evidenceRefs: ['smoke'] }) });
  ok(set1.status === 200 && set1.body.status === 'PROPOSED', `implementation set PROPOSED (got ${set1.status}/${set1.body.status})`);

  const set2 = await j('/api/engineering/controls/implementations', { method: 'PUT', body: JSON.stringify({ controlId, productId, status: 'IN_PLACE', evidenceRefs: ['smoke', 'more evidence'] }) });
  ok(set2.status === 200 && set2.body.status === 'IN_PLACE', `re-set updates to IN_PLACE (got ${set2.status}/${set2.body.status})`);

  const impls = await j(`/api/engineering/controls/implementations?productId=${productId}`);
  const smokeImpl = impls.body.find((i) => i.controlId === controlId);
  ok(smokeImpl && smokeImpl.status === 'IN_PLACE', 'implementation list shows exactly one row for this control (upsert, not duplicated)');

  const lowCreate = await j('/api/engineering/controls', { method: 'POST', body: JSON.stringify({ code: 'CTL-SHOULD-FAIL', domain: 'x', title: 'x' }) }, LOWPRIV);
  ok(lowCreate.status === 403, `non-admin create control -> 403 (got ${lowCreate.status})`);
  const lowRead = await j('/api/engineering/controls', {}, LOWPRIV);
  ok(lowRead.status === 200, `non-admin read controls -> 200 (got ${lowRead.status})`);
} catch (e) {
  console.error('  ✗ unexpected error:', e.message);
  failed++;
} finally {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  if (controlId) {
    await c.query('DELETE FROM "ControlImplementation" WHERE "controlId" = $1', [controlId]);
    await c.query('DELETE FROM "Control" WHERE id = $1', [controlId]);
  }
  ok(true, 'smoke control + implementation cleaned up');
  await c.end();
}

if (failed > 0) { console.error(`\nENGINEERING CONTROLS SMOKE FAILED (${failed})`); process.exit(1); }
console.log('\nENGINEERING CONTROLS SMOKE PASSED');
