// Platform Console smoke (test:platform-console) — SAAS-004 step 2.
// Server up on :4000; run `npm run seed:tenant-registry` + `npm run seed:platform-roles` first.
//
// Proves the PLATFORM vs TENANT permission SEPARATION (non-negotiable #6/#7):
//   1. A PLT_-bound platform operator (usr-plt-ops → PLT_PLATFORM_ADMIN) can
//      GET/POST /api/platform/tenants + GET /api/platform/summary under
//      x-authz-enforce:true.
//   2. A tenant-only user (user-huyvu → usr-it-support, SERVICE_DESK_AGENT, NO
//      PLT_ role) is DENIED 403 on /api/platform/* under enforcement.
//   3. Register a CUSTOMER → tenantNo >= 11 (self-cleaning).
//   4. The platform operator does NOT gain tenant business perms: its effective
//      permissions contain platform.* but NOT '*' and NOT request.approve.
//   5. The tenant super-admin PLATFORM_ADMIN=['*'] (user-nam → usr-cfo) STILL
//      passes every platform route (unchanged).
// Run: node scripts/platform-console-smoke.mjs
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const H = (user, extra = {}) => ({
  'content-type': 'application/json',
  'x-tenant-id': 'tenant-xtech',
  'x-user-id': user,
  ...extra,
});
const ENFORCE = { 'x-authz-enforce': 'true' };
const OP = H('usr-plt-ops', ENFORCE); // platform operator (PLT_ only)
const TENANT_ONLY = H('user-huyvu', ENFORCE); // tenant role, no platform perm
const SUPER = H('user-nam', ENFORCE); // tenant PLATFORM_ADMIN=['*']

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); failed++; }
};
const call = async (path, headers, opts = {}) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};

console.log('Platform Console smoke @ ' + BASE);
const createdIds = [];

try {
  // 1. Platform operator (PLT_PLATFORM_ADMIN) can read the registry + summary.
  const opList = await call('/api/platform/tenants', OP);
  ok(opList.status === 200 && Array.isArray(opList.body), `platform op GET /tenants 200 (got ${opList.status})`);
  const opSummary = await call('/api/platform/summary', OP);
  ok(opSummary.status === 200 && typeof opSummary.body?.total === 'number', `platform op GET /summary 200 total=${opSummary.body?.total}`);

  // 2. Tenant-only user DENIED on platform routes under enforcement.
  const deniedList = await call('/api/platform/tenants', TENANT_ONLY);
  ok(deniedList.status === 403, `tenant-only user DENIED 403 on GET /tenants (got ${deniedList.status})`);
  const deniedReg = await call('/api/platform/tenants', TENANT_ONLY, { method: 'POST', body: JSON.stringify({ name: 'nope' }) });
  ok(deniedReg.status === 403, `tenant-only user DENIED 403 on POST /tenants (got ${deniedReg.status})`);
  const deniedSum = await call('/api/platform/summary', TENANT_ONLY);
  ok(deniedSum.status === 403, `tenant-only user DENIED 403 on GET /summary (got ${deniedSum.status})`);

  // 3. Platform operator registers a CUSTOMER → tenantNo >= 11.
  const key = `plt-smoke-${Date.now()}`;
  const reg = await call('/api/platform/tenants', OP, { method: 'POST', body: JSON.stringify({ name: 'Platform Smoke Customer', tenantKey: key }) });
  ok(reg.status === 201 || reg.status === 200, `platform op POST register customer (got ${reg.status})`);
  if (reg.body?.id) createdIds.push(reg.body.id);
  ok(typeof reg.body?.tenantNo === 'number' && reg.body.tenantNo >= 11, `allocated tenantNo >= 11 (got ${reg.body?.tenantNo})`);
  ok(reg.body?.tenantClass === 'CUSTOMER' && reg.body?.status === 'PLANNED', 'customer class=CUSTOMER status=PLANNED');

  // 4. Platform operator does NOT gain tenant business perms — proven at the
  //    ACTUAL enforcement boundary (PermissionGuard). The PLT_ role grants only
  //    platform.* codes, so a tenant business endpoint (request.approve) DENIES
  //    the platform operator even though it passes every /api/platform route.
  //    (The guard resolves the PLT_ plane in a clean pre-interceptor withBypass;
  //    the '*'-holding tenant super-admin, by contrast, would pass.)
  const opBiz = await call('/api/requests/__none__/approve', OP, { method: 'POST', body: JSON.stringify({}) });
  ok(opBiz.status === 403, `platform op DENIED 403 on tenant business (request.approve) (got ${opBiz.status})`);
  const superBiz = await call('/api/requests/__none__/approve', SUPER, { method: 'POST', body: JSON.stringify({}) });
  ok(superBiz.status !== 403, `tenant super-admin (*) is NOT denied by request.approve gate (got ${superBiz.status})`);

  // 5. Tenant super-admin PLATFORM_ADMIN=['*'] still passes every platform route.
  const superList = await call('/api/platform/tenants', SUPER);
  ok(superList.status === 200, `tenant super-admin (*) STILL passes GET /tenants (got ${superList.status})`);
  const superSum = await call('/api/platform/summary', SUPER);
  ok(superSum.status === 200, `tenant super-admin (*) STILL passes GET /summary (got ${superSum.status})`);
} finally {
  // Self-cleaning: remove the customer tenant(s) this smoke created.
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  for (const id of createdIds) {
    await c.query(`DELETE FROM "AuditLog" WHERE "tenantId" = $1`, [id]).catch(() => {});
    await c.query(`DELETE FROM "Tenant" WHERE id = $1`, [id]).catch(() => {});
  }
  await c.query('COMMIT').catch(() => {});
  await c.end();
  console.log(`  · cleaned up ${createdIds.length} test tenant(s)`);
}

console.log(failed === 0 ? '\nPLATFORM CONSOLE SMOKE PASSED' : `\nPLATFORM CONSOLE SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
