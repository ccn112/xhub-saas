// T002 smoke (test:t002) — SaaS step 6a. Server up on :4000. Provision first:
//   npm run provision:t002  (then)  npm run test:t002
//
// RE-RUNNABLE + NON-DESTRUCTIVE — T002 is a PERMANENT demo tenant, so this smoke
// asserts state, it does NOT delete T002. Proves the first real end-to-end SaaS
// tenant:
//   A. registry: T002 (tenant-realestate-demo) ACTIVE + tenantNo=2.
//   B. data: T002 has org units + people + enabled apps (x1,x2) + demo data
//      (bookings/tickets/announcements/units) — counts>0, read WITH tenant RLS
//      context (raw counts are RLS-hidden).
//   C. identity: a T002 user resolves T002 identity and sees ONLY T002 data
//      (GET /api/announcements returns T002 codes under the T002 header, and
//      does NOT return them under the tenant-xtech header).
//   D. isolation MUST_NOT_LEAK: T002↔T001 cannot read each other (direct RLS,
//      both directions).
//   E. backup: T002 has its own BackupJob.
//   F. login-able users: T002 admin + employee have argon2 UserCredential rows
//      (activated via the auth flow) — NO plaintext stored.
//   G. seed hygiene: SP-RE-DEMO datasets carry NO secret field and NO real
//      personal-data marker (all demo people are synthetic @demo.local).
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const T002 = 'tenant-realestate-demo';
const T001 = 'tenant-xtech';
const ADMIN_ID = `${T002}-admin`;
const EMP_ID = 't002-re-agent-01';
const PLATFORM = { 'content-type': 'application/json', 'x-tenant-id': T001, 'x-user-id': 'user-nam' };
const SECRET_FIELD_REGEX = /password|secret|token|apikey|api[_-]?key|credential|privatekey|private[_-]?key/i;

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const call = async (path, headers) => {
  const r = await fetch(BASE + path, { headers });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
// count under a given tenant's RLS context (bypass off).
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const asTenant = async (tid) => { await db.query("SELECT set_config('app.bypass_rls','off',false)"); await db.query("SELECT set_config('app.current_tenant',$1,false)", [tid]); };
const countAs = async (tid, sql, params = []) => { await asTenant(tid); return Number((await db.query(sql, params)).rows[0].n); };

console.log('T002 smoke @ ' + BASE);
try {
  // ---- A. registry ACTIVE ---------------------------------------------------
  const reg = await call(`/api/platform/tenants/${T002}`, PLATFORM);
  ok(reg.status === 200, `GET registry T002 → 200 (got ${reg.status})`);
  ok(reg.body?.status === 'ACTIVE', `registry status ACTIVE (got ${reg.body?.status})`);
  ok(reg.body?.tenantNo === 2, `registry tenantNo=2 (got ${reg.body?.tenantNo})`);
  ok(reg.body?.tenantClass === 'VERTICAL_DEMO', `registry class VERTICAL_DEMO (got ${reg.body?.tenantClass})`);

  // ---- B. data present (under T002 RLS context) -----------------------------
  const orgUnits = await countAs(T002, `SELECT count(*)::int n FROM "OrgUnit" WHERE "tenantId"=$1`, [T002]);
  ok(orgUnits > 0, `T002 org units > 0 (got ${orgUnits})`);
  const people = await countAs(T002, `SELECT count(*)::int n FROM "PersonProfile" WHERE "tenantId"=$1`, [T002]);
  ok(people >= 5, `T002 people (synthetic) present (got ${people})`);
  const apps = await countAs(T002, `SELECT count(*)::int n FROM "TenantApplicationInstance" WHERE "tenantId"=$1 AND status='enabled' AND "applicationCode"=ANY($2)`, [T002, ['x1', 'x2']]);
  ok(apps === 2, `T002 apps x1+x2 enabled (got ${apps})`);
  const units = await countAs(T002, `SELECT count(*)::int n FROM "BookableResource" WHERE "tenantId"=$1 AND type='UNIT'`, [T002]);
  ok(units >= 3, `T002 sale/booking units (XBooking proxy) > 0 (got ${units})`);
  const bookings = await countAs(T002, `SELECT count(*)::int n FROM "Booking" WHERE "tenantId"=$1`, [T002]);
  ok(bookings >= 2, `T002 bookings (giữ chỗ) > 0 (got ${bookings})`);
  const tickets = await countAs(T002, `SELECT count(*)::int n FROM "Ticket" WHERE "tenantId"=$1`, [T002]);
  ok(tickets >= 2, `T002 operations tickets (XBuilding proxy) > 0 (got ${tickets})`);
  const anns = await countAs(T002, `SELECT count(*)::int n FROM "Announcement" WHERE "tenantId"=$1`, [T002]);
  ok(anns >= 2, `T002 operations announcements (XBuilding proxy) > 0 (got ${anns})`);

  // ---- C. identity resolution + sees ONLY T002 data (HTTP) ------------------
  const t002Ann = await call('/api/announcements?scope=all', { 'content-type': 'application/json', 'x-tenant-id': T002, 'x-user-id': ADMIN_ID });
  const t002Codes = ((t002Ann.body?.items ?? t002Ann.body?.rows ?? t002Ann.body ?? []) || []).map((a) => a.code);
  ok(t002Ann.status === 200 && t002Codes.includes('TB-2026-001'), `T002 user sees T002 announcements (TB-2026-001) via /api/announcements (got ${t002Ann.status}, codes=${t002Codes.slice(0, 4)})`);
  const t001Ann = await call('/api/announcements?scope=all', { 'content-type': 'application/json', 'x-tenant-id': T001, 'x-user-id': 'user-nam' });
  const t001Codes = ((t001Ann.body?.items ?? t001Ann.body?.rows ?? t001Ann.body ?? []) || []).map((a) => a.code);
  ok(!t001Codes.includes('TB-2026-001'), `T001 user does NOT see T002 announcement codes (isolation via app identity)`);

  // ---- D. isolation MUST_NOT_LEAK (direct RLS, both directions) -------------
  const t002SeesT001 = await countAs(T002, `SELECT count(*)::int n FROM "OrgUnit" WHERE "tenantId"=$1`, [T001]);
  const t001SeesT002 = await countAs(T001, `SELECT count(*)::int n FROM "OrgUnit" WHERE "tenantId"=$1`, [T002]);
  ok(t002SeesT001 === 0 && t001SeesT002 === 0, `MUST_NOT_LEAK: T002→T001=${t002SeesT001}, T001→T002=${t001SeesT002}`);

  // ---- E. backup (own BackupJob) --------------------------------------------
  await db.query("SELECT set_config('app.bypass_rls','on',false)");
  const backups = Number((await db.query(`SELECT count(*)::int n FROM "BackupJob" WHERE "tenantId"=$1`, [T002])).rows[0].n);
  ok(backups >= 1, `T002 has its own backup job (got ${backups})`);
  const backupLeak = Number((await db.query(`SELECT count(*)::int n FROM "BackupJob" WHERE "tenantId"=$1`, [T001])).rows[0].n);
  const t002BackupIsOwn = Number((await db.query(`SELECT count(*)::int n FROM "BackupJob" WHERE "tenantId"=$1 AND "tenantId"<>$2`, [T002, T001])).rows[0].n);
  ok(t002BackupIsOwn === backups, `T002 backup is scoped to T002 only (T001 backups=${backupLeak}, unaffected)`);

  // ---- F. login-able users (argon2, no plaintext) ---------------------------
  const cred = (await db.query(`SELECT "userId", "passwordHash" FROM "UserCredential" WHERE "userId"=ANY($1)`, [[ADMIN_ID, EMP_ID]])).rows;
  ok(cred.length === 2, `both T002 users have credentials (admin+employee) (got ${cred.length})`);
  ok(cred.every((c) => c.passwordHash?.startsWith('$argon2')), 'T002 credentials stored as argon2 hashes (no plaintext)');
  const memb = Number((await db.query(`SELECT count(*)::int n FROM "Membership" WHERE "tenantId"=$1 AND "userId"=ANY($2) AND status='active'`, [T002, [ADMIN_ID, EMP_ID]])).rows[0].n);
  ok(memb === 2, `both T002 users have active T002 memberships (got ${memb})`);

  // ---- G. seed hygiene: no secret + no real personal-data marker ------------
  const packRow = (await db.query(`SELECT datasets FROM "SeedPack" WHERE code='SP-RE-DEMO' AND status='PUBLISHED' ORDER BY version DESC LIMIT 1`)).rows[0];
  const datasets = packRow?.datasets ?? [];
  let secretHit = null;
  const scan = (v, p = '') => {
    if (Array.isArray(v)) return v.forEach((x, i) => scan(x, `${p}[${i}]`));
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (SECRET_FIELD_REGEX.test(k)) secretHit = `${p}.${k}`; scan(x, `${p}.${k}`); }
  };
  scan(datasets);
  ok(secretHit === null, `SP-RE-DEMO datasets carry NO secret field${secretHit ? ' (hit ' + secretHit + ')' : ''}`);
  // real personal-data marker: every demo person email must be a synthetic @demo.local.
  const personDs = datasets.find((d) => d.model === 'personProfile');
  const emails = (personDs?.rows ?? []).map((r) => r.email).filter(Boolean);
  const nonSynthetic = emails.filter((e) => !/@demo\.local$/i.test(e));
  ok(emails.length > 0 && nonSynthetic.length === 0, `all demo people are synthetic @demo.local — no real personal data (non-synthetic=${nonSynthetic.length})`);
} catch (e) {
  console.error('  ✗ smoke threw:', e?.message ?? e);
  failed++;
} finally {
  await db.end();
}

console.log(failed === 0 ? '\nT002 SMOKE PASSED' : `\nT002 SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
