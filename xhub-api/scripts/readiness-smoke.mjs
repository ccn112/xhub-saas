// v1.0 SaaS readiness + customer onboarding smoke (test:readiness) — T011.
// Server up on :4000. FULLY SELF-CLEANING against two throwaway CUSTOMER
// tenants (tenantNo 11 + 12). Requires: seed:tenant-registry, seed:platform-roles,
// seed:blueprint-catalog, seed:backup-schedules, seed:subscription-plans.
//
// Proves the customer-readiness gate:
//   A. enforcement — a non-platform user → 403 on /onboard and /readiness.
//   B. onboarding — POST /api/platform/onboard allocates tenantNo=11 (in-lock),
//      registry CUSTOMER + plan set, Launch Factory COMPLETED, backup schedule
//      created, first admin can activate + login.
//   C. allocator — a 2nd onboard → tenantNo=12 (never reused, never <11).
//   D. isolation — MUST_NOT_LEAK: the customer and every other tenant cannot see
//      each other's rows (direct DB RLS proof).
//   E. entitlement — an app OUTSIDE the plan → rejected; a plan-allowed app →
//      allowed; exceeding maxUsers → rejected.
//   F. readiness — GET /api/platform/readiness returns all-green for the seeded
//      ecosystem (incl. the two new customers).
//   G. 0-residue — DELETE the throwaways → registry back to 10, allocator max 10.
import 'dotenv/config';
import pg from 'pg';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const H = (user, extra = {}) => ({ 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': user, ...extra });
const ENFORCE = { 'x-authz-enforce': 'true' };
const OP = H('user-nam'); // tenant PLATFORM_ADMIN=['*'] — happy path (no enforce)
const TENANT_ONLY = H('user-huyvu', ENFORCE); // tenant role, no platform perm

const KEY1 = 'readiness-cust-a';
const KEY2 = 'readiness-cust-b';
const T1 = `tenant-${KEY1}`;
const T2 = `tenant-${KEY2}`;

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const call = async (path, headers, opts = {}) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const post = (p, h, b) => call(p, h, { method: 'POST', body: b ? JSON.stringify(b) : undefined });

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const bypass = async (sql, args = []) => {
  await db.query('BEGIN');
  await db.query("SELECT set_config('app.bypass_rls','on',true)");
  const r = await db.query(sql, args);
  await db.query('COMMIT');
  return r;
};

async function cleanup(tid) {
  await db.query('BEGIN');
  await db.query("SELECT set_config('app.bypass_rls','on',true)");
  await db.query(`DELETE FROM "TenantLaunchStep" WHERE "launchId" IN (SELECT id FROM "TenantLaunch" WHERE "targetTenantId"=$1)`, [tid]).catch(() => {});
  await db.query(`DELETE FROM "TenantLaunch" WHERE "targetTenantId"=$1`, [tid]).catch(() => {});
  for (const t of ['AuditLog', 'Membership', 'OrgUnit', 'PersonProfile', 'TenantApplicationInstance', 'AppAccountBinding', 'ProvisioningConflict', 'ProvisioningCommand', 'RestoreJob', 'BackupJob', 'UserCredential', 'AuthToken', 'BackupSchedule']) {
    await db.query(`DELETE FROM "${t}" WHERE "tenantId"=$1`, [tid]).catch(() => {});
  }
  await db.query(`DELETE FROM "Tenant" WHERE id=$1`, [tid]).catch(() => {});
  await db.query('COMMIT').catch(() => {});
  try { rmSync(join(process.cwd(), 'storage', 'backups', tid), { recursive: true, force: true }); } catch {}
}

console.log('Readiness + onboarding smoke @ ' + BASE);

try {
  // pre-clean any residue from a prior aborted run
  await cleanup(T1); await cleanup(T2);

  const regBefore = (await bypass(`SELECT count(*)::int n, max("tenantNo") mx FROM "Tenant" WHERE "tenantNo" IS NOT NULL`)).rows[0];
  ok(regBefore.n === 10 && Number(regBefore.mx) === 10, `registry starts at 10 tenants, max tenantNo 10 (got ${regBefore.n}/${regBefore.mx})`);

  // ---- A. enforcement -------------------------------------------------------
  const denyOnboard = await post('/api/platform/onboard', TENANT_ONLY, { name: 'x', planCode: 'STARTER' });
  ok(denyOnboard.status === 403, `non-platform user DENIED 403 on /onboard (got ${denyOnboard.status})`);
  const denyReadiness = await call('/api/platform/readiness', TENANT_ONLY);
  ok(denyReadiness.status === 403, `non-platform user DENIED 403 on /readiness (got ${denyReadiness.status})`);

  // ---- B. onboard customer #1 → tenantNo 11 --------------------------------
  const on1 = await post('/api/platform/onboard', OP, { name: 'Readiness Customer A', tenantKey: KEY1, industry: 'Retail', planCode: 'STARTER' });
  ok(on1.status === 200 || on1.status === 201, `POST /onboard #1 (got ${on1.status})`);
  ok(on1.body?.tenant?.tenantNo === 11, `allocated tenantNo=11 (got ${on1.body?.tenant?.tenantNo})`);
  ok(on1.body?.tenant?.tenantCode === 'T011', `tenantCode T011 (got ${on1.body?.tenant?.tenantCode})`);
  ok(on1.body?.tenant?.tenantClass === 'CUSTOMER', `registry class CUSTOMER (got ${on1.body?.tenant?.tenantClass})`);
  ok(on1.body?.plan?.code === 'STARTER', `plan STARTER set (got ${on1.body?.plan?.code})`);
  ok(on1.body?.launch?.status === 'COMPLETED', `Launch Factory COMPLETED (got ${on1.body?.launch?.status})`);

  const sched1 = await call(`/api/platform/backup-schedules/${T1}`, OP);
  ok(sched1.status === 200 && sched1.body?.tenantId === T1, `backup schedule created for T011 (got ${sched1.status})`);
  const bkp1 = Number((await bypass(`SELECT count(*)::int n FROM "BackupJob" WHERE "tenantId"=$1`, [T1])).rows[0].n);
  ok(bkp1 >= 1, `T011 has >=1 backup job (got ${bkp1})`);

  // first admin can activate + login (no plaintext stored — token from onboard)
  const token1 = on1.body?.admin?.activation?.token;
  const adminId1 = on1.body?.admin?.userId;
  const pw = 'Readiness!Test123x';
  const act = await post('/api/auth/activate', { 'content-type': 'application/json' }, { token: token1, password: pw });
  ok(act.status === 200 || act.status === 201, `first admin activated (got ${act.status})`);
  const login = await post('/api/auth/login', { 'content-type': 'application/json' }, { userId: adminId1, password: pw });
  ok(login.status === 200 || login.status === 201, `first admin login OK (got ${login.status})`);

  // ---- C. allocator: 2nd onboard → 12 -------------------------------------
  const on2 = await post('/api/platform/onboard', OP, { name: 'Readiness Customer B', tenantKey: KEY2, planCode: 'PROFESSIONAL' });
  ok(on2.body?.tenant?.tenantNo === 12, `2nd onboard → tenantNo=12 (in-lock, never reused; got ${on2.body?.tenant?.tenantNo})`);
  ok(on2.body?.launch?.status === 'COMPLETED', `2nd launch COMPLETED (got ${on2.body?.launch?.status})`);

  // idempotency: re-onboard #1 does NOT allocate a new number
  const on1b = await post('/api/platform/onboard', OP, { name: 'Readiness Customer A', tenantKey: KEY1, planCode: 'STARTER' });
  ok(on1b.body?.tenant?.tenantNo === 11, `re-onboard #1 idempotent → still tenantNo=11 (got ${on1b.body?.tenant?.tenantNo})`);

  // ---- D. isolation (direct DB RLS proof) ---------------------------------
  await db.query("SELECT set_config('app.bypass_rls','off',false)");
  await db.query("SELECT set_config('app.current_tenant',$1,false)", [T1]);
  const c1SeesXtech = Number((await db.query(`SELECT count(*)::int n FROM "OrgUnit" WHERE "tenantId"='tenant-xtech'`)).rows[0].n);
  const c1SeesT2 = Number((await db.query(`SELECT count(*)::int n FROM "OrgUnit" WHERE "tenantId"=$1`, [T2])).rows[0].n);
  await db.query("SELECT set_config('app.current_tenant','tenant-xtech',false)");
  const xtechSeesC1 = Number((await db.query(`SELECT count(*)::int n FROM "OrgUnit" WHERE "tenantId"=$1`, [T1])).rows[0].n);
  ok(c1SeesXtech === 0 && c1SeesT2 === 0 && xtechSeesC1 === 0, `MUST_NOT_LEAK: c1→xtech=${c1SeesXtech}, c1→c2=${c1SeesT2}, xtech→c1=${xtechSeesC1}`);
  await db.query("SELECT set_config('app.bypass_rls','on',false)");

  // ---- E. entitlement enforcement -----------------------------------------
  const appOutside = await post(`/api/platform/tenants/${T1}/apps`, OP, { appCode: 'xweb' }); // STARTER = xoffice+x1
  ok(appOutside.status === 403, `enable app OUTSIDE plan (xweb) → 403 (got ${appOutside.status})`);
  const appInside = await post(`/api/platform/tenants/${T1}/apps`, OP, { appCode: 'xoffice' });
  ok(appInside.status === 200 || appInside.status === 201, `enable plan-allowed app (xoffice) → allowed (got ${appInside.status})`);

  // maxUsers: fill memberships up to the STARTER cap (50), then +1 → rejected
  const ent = await call(`/api/platform/tenants/${T1}/entitlement`, OP);
  const maxUsers = ent.body?.usage?.maxUsers ?? 50;
  const current = ent.body?.usage?.users ?? 1;
  for (let i = current; i < maxUsers; i++) {
    await bypass(`INSERT INTO "Membership" (id,"tenantId","userId",roles,status) VALUES (gen_random_uuid()::text,$1,$2,ARRAY['EMPLOYEE'],'active') ON CONFLICT DO NOTHING`, [T1, `${T1}-filler-${i}`]);
  }
  const overQuota = await post(`/api/platform/tenants/${T1}/users`, OP, { userId: `${T1}-over`, fullName: 'Over Quota' });
  ok(overQuota.status === 403, `add user exceeding maxUsers(${maxUsers}) → 403 (got ${overQuota.status})`);
  // remove fillers so quota is under cap again → add allowed
  await bypass(`DELETE FROM "Membership" WHERE "tenantId"=$1 AND "userId" LIKE $2`, [T1, `${T1}-filler-%`]);
  const underQuota = await post(`/api/platform/tenants/${T1}/users`, OP, { userId: `${T1}-ok`, fullName: 'Under Quota' });
  ok(underQuota.status === 200 || underQuota.status === 201, `add user under quota → allowed (got ${underQuota.status})`);

  // ---- F. readiness all-green ---------------------------------------------
  const rd = await call('/api/platform/readiness', OP);
  ok(rd.status === 200, `GET /readiness (got ${rd.status})`);
  ok(rd.body?.ok === true, `readiness ALL-GREEN (failed=${rd.body?.summary?.failed}, active=${rd.body?.summary?.activeTenants})`);
  ok((rd.body?.summary?.activeTenants ?? 0) >= 12, `readiness covers the 2 new customers (activeTenants=${rd.body?.summary?.activeTenants})`);
} catch (e) {
  console.error('  ✗ smoke threw:', e?.message ?? e);
  failed++;
} finally {
  // ---- G. 0-residue -------------------------------------------------------
  await cleanup(T1); await cleanup(T2);
  const reg = (await bypass(`SELECT count(*)::int n, max("tenantNo") mx FROM "Tenant" WHERE "tenantNo" IS NOT NULL`)).rows[0];
  let residue = 0;
  for (const tid of [T1, T2]) {
    for (const t of ['TenantLaunch', 'OrgUnit', 'Membership', 'BackupJob', 'AuditLog', 'BackupSchedule', 'Tenant']) {
      const col = t === 'TenantLaunch' ? 'targetTenantId' : t === 'Tenant' ? 'id' : 'tenantId';
      residue += Number((await bypass(`SELECT count(*)::int n FROM "${t}" WHERE "${col}"=$1`, [tid])).rows[0].n);
    }
  }
  ok(residue === 0, `0 residue after cleanup (got ${residue})`);
  ok(reg.n === 10 && Number(reg.mx) === 10, `registry back to 10 tenants, allocator max back to 10 (got ${reg.n}/${reg.mx})`);
  await db.end();
  console.log('  · cleaned up 2 throwaway customers');
}

console.log(failed === 0 ? '\nREADINESS SMOKE PASSED' : `\nREADINESS SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
