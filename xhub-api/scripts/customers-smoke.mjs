// Customer/Contact smoke (test:customers, Phase 2 BO-0201). Server up on
// :4001 (X.Office). Proves: seeded T001 Riverside scenario present with a
// primary contact; idempotent create (same idempotencyKey -> no duplicate);
// duplicate-candidate detection on similar name; addContact enforces at
// most one primary; 360 view returns customer+contacts+events; tenant
// isolation (MUST_NOT_LEAK — a different tenant sees none of this data);
// writes gated (customer.manage), reads open.
// Run: node scripts/customers-smoke.mjs
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4001';
const ADMIN = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };
const LOWPRIV = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-huyvu', 'x-authz-enforce': 'true' };
const OTHER_TENANT = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-demo-isolation', 'x-user-id': 'user-nam' };

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const j = async (path, opts = {}, headers = ADMIN) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};

console.log('Customers smoke @ ' + BASE);

let smokeCustomerId;
try {
  const seeded = await j('/api/customers');
  const riverside = (seeded.body ?? []).find((c) => c.code === 'CUS-T002');
  ok(!!riverside, 'seeded T001 Riverside customer present');
  ok(riverside?.contacts?.[0]?.isPrimary === true, 'seeded primary contact present');

  const riverside360 = await j(`/api/customers/${riverside.id}`);
  ok(riverside360.status === 200 && riverside360.body.events?.length >= 1, `360 view returns events timeline (got ${riverside360.body.events?.length} events)`);

  // Duplicate-candidate detection: creating a similarly-named customer should surface Riverside.
  const idemKey = 'smoke-' + Date.now();
  const created = await j('/api/customers', { method: 'POST', body: JSON.stringify({ name: 'Công ty Riverside Smoke Test', idempotencyKey: idemKey }) });
  ok(created.status === 201 || created.status === 200, `customer created (got ${created.status})`);
  smokeCustomerId = created.body.customer.id;
  ok(created.body.duplicateCandidates?.some((d) => d.code === 'CUS-T002'), 'duplicate-candidate detection surfaces the similarly-named seeded customer');

  const replay = await j('/api/customers', { method: 'POST', body: JSON.stringify({ name: 'should be ignored', idempotencyKey: idemKey }) });
  ok(replay.body.replayed === true && replay.body.customer.id === smokeCustomerId, 'replayed create with same idempotencyKey returns the original, not a duplicate');

  // addContact: 2nd primary unsets the 1st.
  const c1 = await j(`/api/customers/${smokeCustomerId}/contacts`, { method: 'POST', body: JSON.stringify({ displayName: 'Contact A', isPrimary: true }) });
  ok(c1.status === 201 || c1.status === 200, `first contact created (got ${c1.status})`);
  const c2 = await j(`/api/customers/${smokeCustomerId}/contacts`, { method: 'POST', body: JSON.stringify({ displayName: 'Contact B', isPrimary: true, contactPreference: ['zalo'] }) });
  ok(c2.body.isPrimary === true, 'second contact marked primary');
  const detail = await j(`/api/customers/${smokeCustomerId}`);
  const primaries = detail.body.contacts.filter((c) => c.isPrimary);
  ok(primaries.length === 1 && primaries[0].displayName === 'Contact B', `at most one primary contact enforced (got ${primaries.length}, latest wins)`);
  ok(detail.body.contacts.find((c) => c.displayName === 'Contact B')?.contactPreference?.includes('ZALO'), 'contactPreference normalized to uppercase (ZALO)');

  const statusChange = await j(`/api/customers/${smokeCustomerId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'inactive' }) });
  ok(statusChange.status === 200 && statusChange.body.status === 'INACTIVE', `status change normalizes case (got ${statusChange.body.status})`);

  // Tenant isolation (MUST_NOT_LEAK).
  const otherTenantList = await j('/api/customers', {}, OTHER_TENANT);
  ok(!otherTenantList.body.some((c) => c.code === 'CUS-T002'), 'a different tenant sees NONE of tenant-xtech\'s customers (RLS isolation)');

  // Permission gating.
  const lowCreate = await j('/api/customers', { method: 'POST', body: JSON.stringify({ name: 'should fail' }) }, LOWPRIV);
  ok(lowCreate.status === 403, `non-admin create customer -> 403 (got ${lowCreate.status})`);
  const lowRead = await j('/api/customers', {}, LOWPRIV);
  ok(lowRead.status === 200, `non-admin read customers -> 200 (got ${lowRead.status})`);
} catch (e) {
  console.error('  ✗ unexpected error:', e.message);
  failed++;
} finally {
  const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
  await c.connect();
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  if (smokeCustomerId) {
    await c.query('DELETE FROM "CustomerEvent" WHERE "customerId" = $1', [smokeCustomerId]);
    await c.query('DELETE FROM "Contact" WHERE "customerId" = $1', [smokeCustomerId]);
    const del = await c.query('DELETE FROM "Customer" WHERE id = $1 RETURNING id', [smokeCustomerId]);
    ok(del.rowCount === 1, 'smoke customer + contacts + events cleaned up');
  }
  await c.query('COMMIT');
  await c.end();
}

if (failed > 0) { console.error(`\nCUSTOMERS SMOKE FAILED (${failed})`); process.exit(1); }
console.log('\nCUSTOMERS SMOKE PASSED');
