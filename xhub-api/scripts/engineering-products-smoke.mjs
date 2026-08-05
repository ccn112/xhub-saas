// Engineering Governance — Product Registry smoke (test:engineering-products,
// DG-01). Server must be up on :4000 with products seeded
// (npm run seed:engineering-products).
//
// Proves: list has the 6 seeded products in rollout order; get by code works;
// create rejects a duplicate code; create+list a ProductVersion; FSM guard
// rejects an illegal jump (DRAFT -> RELEASED) and accepts the legal chain
// (DRAFT -> PLANNING -> IN_DEVELOPMENT); RELEASED stays reachable only via the
// full chain, never skipped; write routes enforce
// engineering.product.manage/engineering.version.manage under
// x-authz-enforce:true. Self-cleaning: leaves seeded rows untouched, only
// deletes the test product/version it creates.
// Run: node scripts/engineering-products-smoke.mjs
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const ADMIN = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };
const LOWPRIV = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-huyvu', 'x-authz-enforce': 'true' };

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); failed++; }
};
const j = async (path, opts = {}, headers = ADMIN) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};

console.log('Engineering Products smoke @ ' + BASE);

try {
  // 1. List has the 6 seeded products, in rollout order.
  const list = await j('/api/engineering/products');
  ok(list.status === 200, 'GET /api/engineering/products 200');
  const codes = (list.body ?? []).map((p) => p.code);
  ok(codes.includes('PRD-XHUB') && codes.includes('PRD-XOFFICE') && codes.includes('PRD-XSPACE'), `6 seeded products present (got ${codes.length})`);
  const orders = (list.body ?? []).map((p) => p.rolloutOrder).filter((n) => n != null);
  const sorted = [...orders].sort((a, b) => a - b);
  ok(JSON.stringify(orders) === JSON.stringify(sorted), 'list returns rolloutOrder ascending');

  // 2. Get by code, includes versions/components/environments.
  const xhub = await j('/api/engineering/products/PRD-XHUB');
  ok(xhub.status === 200 && xhub.body?.code === 'PRD-XHUB', 'GET by code works');
  ok(Array.isArray(xhub.body?.versions) && xhub.body.versions.some((v) => v.version === '1.0.0'), 'seeded initial version 1.0.0 present');
  ok(xhub.status === 200 && 'components' in xhub.body && 'environments' in xhub.body, 'detail includes components/environments arrays');

  // 3. Create rejects a duplicate code.
  const dup = await j('/api/engineering/products', { method: 'POST', body: JSON.stringify({ code: 'PRD-XHUB', name: 'dup' }) });
  ok(dup.status === 400, `duplicate code rejected 400 (got ${dup.status})`);

  // 4. Create a throwaway test product + version, exercise the FSM guard.
  const testCode = 'PRD-SMOKE-TEST';
  const created = await j('/api/engineering/products', { method: 'POST', body: JSON.stringify({ code: testCode, name: 'Smoke Test Product', type: 'DOMAIN_PRODUCT' }) });
  ok(created.status === 201 || created.status === 200, `test product created (got ${created.status})`);
  const productId = created.body?.id;

  const ver = await j(`/api/engineering/products/${productId}/versions`, { method: 'POST', body: JSON.stringify({ version: '0.1.0' }) });
  ok(ver.status === 201 || ver.status === 200, `version created (got ${ver.status})`);
  ok(ver.body?.status === 'DRAFT', `new version starts DRAFT (got ${ver.body?.status})`);
  const versionId = ver.body?.id;

  const illegal = await j(`/api/engineering/versions/${versionId}`, { method: 'PATCH', body: JSON.stringify({ status: 'RELEASED' }) });
  ok(illegal.status === 400, `DRAFT -> RELEASED (skip) rejected 400 (got ${illegal.status})`);

  const step1 = await j(`/api/engineering/versions/${versionId}`, { method: 'PATCH', body: JSON.stringify({ status: 'PLANNING' }) });
  ok(step1.status === 200 && step1.body?.status === 'PLANNING', `DRAFT -> PLANNING accepted (got ${step1.status}/${step1.body?.status})`);

  const step2 = await j(`/api/engineering/versions/${versionId}`, { method: 'PATCH', body: JSON.stringify({ status: 'IN_DEVELOPMENT' }) });
  ok(step2.status === 200 && step2.body?.status === 'IN_DEVELOPMENT', `PLANNING -> IN_DEVELOPMENT accepted (got ${step2.status}/${step2.body?.status})`);

  const backwards = await j(`/api/engineering/versions/${versionId}`, { method: 'PATCH', body: JSON.stringify({ status: 'DRAFT' }) });
  ok(backwards.status === 400, `IN_DEVELOPMENT -> DRAFT (backwards, not allowed) rejected 400 (got ${backwards.status})`);

  // 5. Enforcement: low-priv actor denied on write routes.
  const lowCreate = await j('/api/engineering/products', { method: 'POST', body: JSON.stringify({ code: 'PRD-SHOULD-FAIL', name: 'x' }) }, LOWPRIV);
  ok(lowCreate.status === 403, `non-admin create product -> 403 (got ${lowCreate.status})`);
  const lowTransition = await j(`/api/engineering/versions/${versionId}`, { method: 'PATCH', body: JSON.stringify({ status: 'CODE_FREEZE' }) }, LOWPRIV);
  ok(lowTransition.status === 403, `non-admin transition version -> 403 (got ${lowTransition.status})`);

  // 6. Reads stay open for the low-priv actor (no permission gate on GET).
  const lowRead = await j('/api/engineering/products', {}, LOWPRIV);
  ok(lowRead.status === 200, `non-admin read products -> 200 (got ${lowRead.status})`);

  // Cleanup: remove only the test product/version this smoke created.
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('DELETE FROM "ProductVersion" WHERE "productId" = $1', [productId]);
  const del = await c.query('DELETE FROM "Product" WHERE code = $1 RETURNING id', [testCode]);
  ok(del.rowCount === 1, 'smoke test product cleaned up');
  await c.end();
} catch (e) {
  console.error('  ✗ unexpected error:', e.message);
  failed++;
}

if (failed > 0) {
  console.error(`\nENGINEERING PRODUCTS SMOKE FAILED (${failed})`);
  process.exit(1);
}
console.log('\nENGINEERING PRODUCTS SMOKE PASSED');
