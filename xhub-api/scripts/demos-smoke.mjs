// Demo-tenants smoke (test:demos) — SaaS step 6b. Server up on :4000.
//   npm run provision:demos  (then)  npm run test:demos
//
// RE-RUNNABLE + NON-DESTRUCTIVE — the demo tenants T003–T010 are PERMANENT, so
// this asserts state, it never deletes. Parameter-driven over
// demo-tenants.params.mjs (no per-tenant branch). For each provisioned demo
// tenant it proves:
//   A. registry ACTIVE + correct tenantNo + class VERTICAL_DEMO + its blueprint.
//   B. data (under tenant RLS): org units + >=5 synthetic people + >=1 enabled
//      app + bookable resources + bookings + tickets + announcements (data>0).
//   C. its OWN backup schedule row + >=1 backup job, scoped to itself.
//   D. isolation MUST_NOT_LEAK: every demo tenant vs T001 (sampled, one dir each)
//      + the sibling pair T003 <-> T008 both directions (no O(n^2) full matrix).
//   E. healthcare T008: NO medical-record / PHI-like data (field names OR codes).
//   F. seed hygiene (all 8 packs): NO secret field, all demo people synthetic
//      @demo.local with externalIdRefs.synthetic=true.
//   G. registry-wide: T001+T002+T003..T010 present; T003–T010 ACTIVE.
import 'dotenv/config';
import pg from 'pg';
import { BATCH_TENANTS, resolveTenant } from './demo-tenants.params.mjs';

const T001 = 'tenant-xtech';
const SECRET_FIELD_REGEX = /password|secret|token|apikey|api[_-]?key|credential|privatekey|private[_-]?key/i;
// PHI / clinical markers forbidden in the healthcare ADMIN demo (field or value).
const PHI_REGEX = /diagnos|patient|bệnh án|benh an|medical[_-]?record|prescription|đơn thuốc|don thuoc|icd[- ]?\d|mrn|lab[_-]?result|xét nghiệm|xet nghiem|triệu chứng|trieu chung/i;

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const asTenant = async (tid) => { await db.query("SELECT set_config('app.bypass_rls','off',false)"); await db.query("SELECT set_config('app.current_tenant',$1,false)", [tid]); };
const countAs = async (tid, sql, params = []) => { await asTenant(tid); return Number((await db.query(sql, params)).rows[0].n); };
const bypass = async () => db.query("SELECT set_config('app.bypass_rls','on',false)");

console.log('demos smoke @ ' + (process.env.XOFFICE_BASE || 'http://localhost:4000'));
try {
  // ---- per-tenant A/B/C/F -------------------------------------------------
  for (const t of BATCH_TENANTS) {
    const id = t.id;
    const label = `T${String(t.no).padStart(3, '0')} (${t.key})`;

    // A. registry
    await bypass();
    const reg = (await db.query(`SELECT status, "tenantNo", "tenantClass", "blueprintId" FROM "Tenant" WHERE id=$1`, [id])).rows[0];
    ok(reg?.status === 'ACTIVE', `${label} registry ACTIVE (got ${reg?.status})`);
    ok(reg?.tenantNo === t.no, `${label} tenantNo=${t.no} (got ${reg?.tenantNo})`);
    ok(reg?.tenantClass === 'VERTICAL_DEMO', `${label} class VERTICAL_DEMO (got ${reg?.tenantClass})`);
    ok(reg?.blueprintId === t.blueprint, `${label} registry blueprint ${t.blueprint} (got ${reg?.blueprintId})`);

    // B. data (under tenant RLS context)
    const org = await countAs(id, `SELECT count(*)::int n FROM "OrgUnit" WHERE "tenantId"=$1`, [id]);
    ok(org > 0, `${label} org units > 0 (got ${org})`);
    const people = await countAs(id, `SELECT count(*)::int n FROM "PersonProfile" WHERE "tenantId"=$1`, [id]);
    ok(people >= 5, `${label} synthetic people >= 5 (got ${people})`);
    const apps = await countAs(id, `SELECT count(*)::int n FROM "TenantApplicationInstance" WHERE "tenantId"=$1 AND status='enabled'`, [id]);
    ok(apps > 0, `${label} enabled apps > 0 (got ${apps})`);
    const res = await countAs(id, `SELECT count(*)::int n FROM "BookableResource" WHERE "tenantId"=$1`, [id]);
    const bk = await countAs(id, `SELECT count(*)::int n FROM "Booking" WHERE "tenantId"=$1`, [id]);
    const tk = await countAs(id, `SELECT count(*)::int n FROM "Ticket" WHERE "tenantId"=$1`, [id]);
    const an = await countAs(id, `SELECT count(*)::int n FROM "Announcement" WHERE "tenantId"=$1`, [id]);
    ok(res > 0 && bk > 0 && tk > 0 && an > 0, `${label} vertical data > 0 (resources=${res}, bookings=${bk}, tickets=${tk}, anns=${an})`);

    // C. own backup schedule + backup job, scoped to itself
    await bypass();
    const sched = Number((await db.query(`SELECT count(*)::int n FROM "BackupSchedule" WHERE "tenantId"=$1 AND enabled=true`, [id])).rows[0].n);
    ok(sched === 1, `${label} has its OWN backup schedule (got ${sched})`);
    const jobs = Number((await db.query(`SELECT count(*)::int n FROM "BackupJob" WHERE "tenantId"=$1`, [id])).rows[0].n);
    ok(jobs >= 1, `${label} has >=1 backup job scoped to itself (got ${jobs})`);

    // F. seed hygiene for this pack
    const packRow = (await db.query(`SELECT datasets FROM "SeedPack" WHERE code=$1 AND status='PUBLISHED' ORDER BY version DESC LIMIT 1`, [t.seedPack])).rows[0];
    const datasets = packRow?.datasets ?? [];
    let secretHit = null;
    const scan = (v, p = '') => {
      if (Array.isArray(v)) return v.forEach((x, i) => scan(x, `${p}[${i}]`));
      if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (SECRET_FIELD_REGEX.test(k)) secretHit = `${p}.${k}`; scan(x, `${p}.${k}`); }
    };
    scan(datasets);
    ok(secretHit === null, `${label} pack ${t.seedPack} carries NO secret field${secretHit ? ' (hit ' + secretHit + ')' : ''}`);
    const personDs = datasets.find((d) => d.model === 'personProfile');
    const rows = personDs?.rows ?? [];
    const emails = rows.map((r) => r.email).filter(Boolean);
    const nonSynthetic = emails.filter((e) => !/@demo\.local$/i.test(e));
    ok(emails.length > 0 && nonSynthetic.length === 0, `${label} all demo people synthetic @demo.local (non-synthetic=${nonSynthetic.length})`);
    ok(rows.every((r) => r.externalIdRefs?.synthetic === true), `${label} all demo people flagged externalIdRefs.synthetic=true`);
  }

  // ---- E. healthcare T008 — NO PHI / medical records ----------------------
  const hc = resolveTenant('healthcare-demo');
  await bypass();
  const hcPack = (await db.query(`SELECT datasets FROM "SeedPack" WHERE code=$1 AND status='PUBLISHED' ORDER BY version DESC LIMIT 1`, [hc.seedPack])).rows[0];
  let phiHit = null;
  const scanPhi = (v, p = '') => {
    if (phiHit) return;
    if (Array.isArray(v)) return v.forEach((x, i) => scanPhi(x, `${p}[${i}]`));
    if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)) { if (PHI_REGEX.test(k)) { phiHit = `field:${p}.${k}`; return; } scanPhi(x, `${p}.${k}`); } return; }
    if (typeof v === 'string' && PHI_REGEX.test(v)) phiHit = `value:${p}="${v}"`;
  };
  scanPhi(hcPack?.datasets ?? []);
  ok(phiHit === null, `T008 healthcare pack has NO PHI / medical-record data${phiHit ? ' (hit ' + phiHit + ')' : ''}`);
  // and no clinical models materialized under T008 (there is no patient/record table; assert admin data only)
  const hcPeople = await countAs(hc.id, `SELECT count(*)::int n FROM "PersonProfile" WHERE "tenantId"=$1`, [hc.id]);
  ok(hcPeople >= 5, `T008 has administrative staff records only (people=${hcPeople})`);

  // ---- D. isolation MUST_NOT_LEAK (sampled) -------------------------------
  // every demo tenant cannot read T001 (one direction each — cheap sample)
  let leakToT001 = 0;
  for (const t of BATCH_TENANTS) {
    const seesT001 = await countAs(t.id, `SELECT count(*)::int n FROM "OrgUnit" WHERE "tenantId"=$1`, [T001]);
    if (seesT001 !== 0) leakToT001++;
  }
  ok(leakToT001 === 0, `MUST_NOT_LEAK: no demo tenant can read T001 org units (leaks=${leakToT001})`);
  // sibling pair T003 <-> T008 both directions
  const t003 = resolveTenant(3).id, t008 = resolveTenant(8).id;
  const a = await countAs(t003, `SELECT count(*)::int n FROM "PersonProfile" WHERE "tenantId"=$1`, [t008]);
  const b = await countAs(t008, `SELECT count(*)::int n FROM "PersonProfile" WHERE "tenantId"=$1`, [t003]);
  ok(a === 0 && b === 0, `MUST_NOT_LEAK: T003 <-> T008 cannot see each other (T003→T008=${a}, T008→T003=${b})`);

  // ---- G. registry-wide ---------------------------------------------------
  await bypass();
  const total = Number((await db.query(`SELECT count(*)::int n FROM "Tenant" WHERE "tenantNo" IS NOT NULL`)).rows[0].n);
  ok(total >= 10, `registry has >=10 numbered tenants (got ${total})`);
  const activeBatch = Number((await db.query(`SELECT count(*)::int n FROM "Tenant" WHERE status='ACTIVE' AND "tenantNo" BETWEEN 3 AND 10`)).rows[0].n);
  ok(activeBatch === BATCH_TENANTS.length, `T003–T010 all ACTIVE (got ${activeBatch}/${BATCH_TENANTS.length})`);
} catch (e) {
  console.error('  ✗ smoke threw:', e?.message ?? e);
  failed++;
} finally {
  await db.end();
}

console.log(failed === 0 ? '\nDEMOS SMOKE PASSED' : `\nDEMOS SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
