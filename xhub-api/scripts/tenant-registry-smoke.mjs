// Platform Tenant Registry smoke (test:tenant-registry). Server must be up on
// :4000 with the registry seeded (npm run seed:tenant-registry).
//
// Proves: list=10; T001=tenant-xtech/1/T001; register a CUSTOMER → tenantNo>=11,
// unique, immutable (PATCH tenantNo → 400); a 2nd allocate is strictly greater
// (no reuse); Tenant is a SHARED table (cross-tenant read works without tenant
// context); enforcement: platform.tenant.manage required (non-platform user
// under x-authz-enforce:true → 403). Self-cleaning: deletes the test tenants it
// creates. Run: node scripts/tenant-registry-smoke.mjs
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
const j = async (path, opts = {}) => {
  const r = await fetch(BASE + path, { headers: ADMIN, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};

console.log('Tenant Registry smoke @ ' + BASE);
const createdIds = [];

try {
  // 1. List returns the 10 fixed registry rows.
  const list = await j('/api/platform/tenants');
  ok(list.status === 200, 'GET /api/platform/tenants 200');
  ok(Array.isArray(list.body) && list.body.length === 10, `registry list has 10 rows (got ${list.body?.length})`);

  // 2. T001 = tenant-xtech / 1 / T001 (id unchanged).
  const t001 = (list.body ?? []).find((t) => t.tenantNo === 1);
  ok(t001?.id === 'tenant-xtech', `T001 id is tenant-xtech (got ${t001?.id})`);
  ok(t001?.tenantCode === 'T001' && t001?.tenantKey === 'xtech', `T001 code=T001 key=xtech`);
  ok(t001?.tenantClass === 'PLATFORM_OWNER_REFERENCE_CUSTOMER' && t001?.status === 'ACTIVE', 'T001 class+status correct');

  // 3. get by code.
  const byCode = await j('/api/platform/tenants/T001');
  ok(byCode.status === 200 && byCode.body?.id === 'tenant-xtech', 'GET /tenants/T001 resolves tenant-xtech');

  // 4. Register a CUSTOMER → tenantNo >= 11, derived code, class CUSTOMER, status PLANNED.
  const key1 = `smoke-cust-${Date.now()}`;
  const reg1 = await j('/api/platform/tenants', { method: 'POST', body: JSON.stringify({ name: 'Smoke Customer 1', tenantKey: key1 }) });
  ok(reg1.status === 201 || reg1.status === 200, `POST register customer (got ${reg1.status})`);
  const c1 = reg1.body;
  if (c1?.id) createdIds.push(c1.id);
  ok(typeof c1?.tenantNo === 'number' && c1.tenantNo >= 11, `allocated tenantNo >= 11 (got ${c1?.tenantNo})`);
  ok(c1?.tenantCode === `T${String(c1?.tenantNo).padStart(3, '0')}`, `tenantCode derived from tenantNo (${c1?.tenantCode})`);
  ok(c1?.tenantClass === 'CUSTOMER' && c1?.status === 'PLANNED', 'customer class=CUSTOMER status=PLANNED');

  // 5. tenantNo immutable — PATCH tenantNo → 400.
  const badPatch = await j(`/api/platform/tenants/${c1.id}`, { method: 'PATCH', body: JSON.stringify({ tenantNo: 999 }) });
  ok(badPatch.status === 400, `PATCH tenantNo rejected 400 (got ${badPatch.status})`);
  // ... but a legit metadata PATCH works.
  const goodPatch = await j(`/api/platform/tenants/${c1.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'ACTIVE' }) });
  ok(goodPatch.status === 200 && goodPatch.body?.status === 'ACTIVE', 'PATCH status=ACTIVE accepted');

  // 6. 2nd allocate strictly greater (never reused).
  const key2 = `smoke-cust2-${Date.now()}`;
  const reg2 = await j('/api/platform/tenants', { method: 'POST', body: JSON.stringify({ name: 'Smoke Customer 2', tenantKey: key2 }) });
  const c2 = reg2.body;
  if (c2?.id) createdIds.push(c2.id);
  ok(typeof c2?.tenantNo === 'number' && c2.tenantNo > c1.tenantNo, `2nd allocate strictly greater (${c1?.tenantNo} -> ${c2?.tenantNo})`);

  // 7. Enforcement: non-platform user (user-huyvu) under x-authz-enforce → 403.
  const denied = await fetch(BASE + '/api/platform/tenants', {
    method: 'POST', headers: LOWPRIV, body: JSON.stringify({ name: 'nope' }),
  });
  ok(denied.status === 403, `non-platform user DENIED 403 on register (got ${denied.status})`);
  const deniedRead = await fetch(BASE + '/api/platform/tenants', { headers: LOWPRIV });
  ok(deniedRead.status === 403, `non-platform user DENIED 403 on list read (got ${deniedRead.status})`);

  // 8. Tenant is a SHARED (non-RLS) table: a raw cross-tenant count works.
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  // No app.current_tenant / bypass set → an RLS table would return 0 rows; a
  // shared table returns the real count.
  const raw = await c.query(`SELECT COUNT(*)::int AS n FROM "Tenant" WHERE "tenantNo" BETWEEN 1 AND 10`);
  await c.end();
  ok(raw.rows[0].n === 10, `raw cross-tenant read sees 10 fixed rows (Tenant is shared/non-RLS) (got ${raw.rows[0].n})`);
} finally {
  // Self-cleaning: remove the customer tenants this smoke created.
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)"); // AuditLog is RLS-protected
  for (const id of createdIds) {
    // Audit rows FK-reference the tenant id — remove them before the tenant row.
    await c.query(`DELETE FROM "AuditLog" WHERE "tenantId" = $1`, [id]).catch(() => {});
    await c.query(`DELETE FROM "Tenant" WHERE id = $1`, [id]).catch(() => {});
  }
  await c.query('COMMIT').catch(() => {});
  await c.end();
  console.log(`  · cleaned up ${createdIds.length} test tenant(s)`);
}

console.log(failed === 0 ? '\nTENANT REGISTRY SMOKE PASSED' : `\nTENANT REGISTRY SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
