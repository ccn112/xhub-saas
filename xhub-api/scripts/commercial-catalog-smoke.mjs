// Commercial Catalog smoke (test:commercial-catalog, Phase 2 BO-0203).
// Server up on :4001. Proves: 4 seeded catalog items present; create;
// version bumps on edit; permission gating.
// Run: node scripts/commercial-catalog-smoke.mjs
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4001';
const ADMIN = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };
const LOWPRIV = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-huyvu', 'x-authz-enforce': 'true' };

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const j = async (path, opts = {}, headers = ADMIN) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};

console.log('Commercial Catalog smoke @ ' + BASE);

let itemId;
try {
  const list = await j('/api/commercial-catalog');
  ok(list.body.some((i) => i.code === 'XHUB-ENT'), 'seeded XHUB-ENT catalog item present');
  ok(list.body.filter((i) => ['XHUB-ENT', 'XOFFICE-IMP', 'X2-IMP', 'AI-PILOT'].includes(i.code)).length === 4, `all 4 seeded catalog items present (got ${list.body.length} total)`);

  const created = await j('/api/commercial-catalog', { method: 'POST', body: JSON.stringify({ code: 'SMOKE-ITEM', name: 'Smoke item', commercialType: 'SERVICE' }) });
  ok(created.status === 201 || created.status === 200, `catalog item created, version=1 (got ${created.status}/${created.body.version})`);
  itemId = created.body.id;

  const updated = await j(`/api/commercial-catalog/${itemId}`, { method: 'PATCH', body: JSON.stringify({ active: false }) });
  ok(updated.status === 200 && updated.body.version === 2 && updated.body.active === false, `edit bumps version to 2, active=false (got ${updated.status}/v${updated.body.version})`);

  const lowCreate = await j('/api/commercial-catalog', { method: 'POST', body: JSON.stringify({ code: 'SHOULD-FAIL', name: 'x', commercialType: 'SERVICE' }) }, LOWPRIV);
  ok(lowCreate.status === 403, `non-admin create -> 403 (got ${lowCreate.status})`);
  const lowRead = await j('/api/commercial-catalog', {}, LOWPRIV);
  ok(lowRead.status === 200, `non-admin read -> 200 (got ${lowRead.status})`);
} catch (e) {
  console.error('  ✗ unexpected error:', e.message);
  failed++;
} finally {
  const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
  await c.connect();
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  if (itemId) {
    const del = await c.query('DELETE FROM "CommercialCatalogItem" WHERE id = $1 RETURNING id', [itemId]);
    ok(del.rowCount === 1, 'smoke catalog item cleaned up');
  }
  await c.query('COMMIT');
  await c.end();
}

if (failed > 0) { console.error(`\nCOMMERCIAL CATALOG SMOKE FAILED (${failed})`); process.exit(1); }
console.log('\nCOMMERCIAL CATALOG SMOKE PASSED');
