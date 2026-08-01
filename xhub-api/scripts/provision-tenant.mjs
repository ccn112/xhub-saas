// Generalized, parameter-driven tenant provisioner (SaaS step 6b).
//
// ONE reusable engine for every reserved demo tenant (T002–T010): give it a
// selector (tenantNo | key | id) and it looks up the row from
// demo-tenants.params.mjs, then runs the SAME EXISTING Launch Factory pipeline
// that first-provisioned T002 — no per-tenant branch logic. This is the
// generalization of the original provision-t002.mjs.
//
//   provisionTenant(selector, opts?) → { tenantId, status, skipped, admin, employee }
//
// Idempotent + resumable: a tenant already ACTIVE with a COMPLETED launch and
// both credentials is SKIPPED fast; otherwise every step is a safe re-run
// (registry upsert, found-or-create ONE launch, upsert seed rows, invite/activate).
//
// Steps per tenant:
//   0. verify catalog carries PUBLISHED <blueprint> + <seedPack>
//   1. ensure registry row (tenantNo/class/plan/blueprint/industry) — bypass pg
//   2. found-or-create ONE TenantLaunch (blueprint+seedpack), run 8-step engine
//      → registry ACTIVE (handover step), backup job, isolation assert
//   3. ensure the demo employee Membership (pack seeds the person, not the mbr)
//   4. make admin + employee login-able via the internal auth flow (argon2,
//      NO plaintext in repo — passwords from ENV or a random per-run value)
//
// Requires: DATABASE_URL + an API on :4000. Assumes seed:tenant-registry +
// seed:blueprint-catalog have run.
import 'dotenv/config';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolveTenant } from './demo-tenants.params.mjs';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const PLATFORM = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };

const call = async (path, headers, opts = {}) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const post = (p, h, b) => call(p, h, { method: 'POST', body: b ? JSON.stringify(b) : undefined });

/**
 * Provision one demo tenant. `db` is an already-connected pg.Client. Returns a
 * result object; throws only on a real failure.
 */
export async function provisionTenant(selector, { db, log = () => {}, force = false } = {}) {
  const t = resolveTenant(selector);
  const TARGET = t.id;
  const ADMIN_ID = `${TARGET}-admin`;
  const EMP_ID = t.empId;
  const envCode = `T${String(t.no).padStart(3, '0')}`; // T003..T010
  const ADMIN_PW = process.env[`${envCode}_ADMIN_PASSWORD`] || `${envCode}-Admin!${randomBytes(6).toString('hex')}`;
  const EMP_PW = process.env[`${envCode}_EMP_PASSWORD`] || `${envCode}-Emp!${randomBytes(6).toString('hex')}`;
  const H = (user) => ({ 'content-type': 'application/json', 'x-tenant-id': TARGET, 'x-user-id': user });

  // ---- 0. Preconditions: PUBLISHED blueprint + seed pack --------------------
  await db.query("SELECT set_config('app.bypass_rls','on',false)");
  const bp = (await db.query(`SELECT version FROM "Blueprint" WHERE code=$1 AND status='PUBLISHED' ORDER BY version DESC LIMIT 1`, [t.blueprint])).rows[0];
  const sp = (await db.query(`SELECT version FROM "SeedPack" WHERE code=$1 AND status='PUBLISHED' ORDER BY version DESC LIMIT 1`, [t.seedPack])).rows[0];
  if (!bp || !sp) throw new Error(`catalog missing PUBLISHED ${!bp ? t.blueprint : ''} ${!sp ? t.seedPack : ''} — run: npm run seed:blueprint-catalog`);

  // ---- resumability: skip a fully-provisioned tenant fast -------------------
  if (!force) {
    const reg = (await db.query(`SELECT status FROM "Tenant" WHERE id=$1`, [TARGET])).rows[0];
    const creds = Number((await db.query(`SELECT count(*)::int n FROM "UserCredential" WHERE "userId"=ANY($1)`, [[ADMIN_ID, EMP_ID]])).rows[0].n);
    if (reg?.status === 'ACTIVE' && creds === 2) {
      log(`${envCode} already ACTIVE + credentials present → skip (idempotent)`);
      return { tenantId: TARGET, tenantNo: t.no, status: 'ACTIVE', skipped: true };
    }
  }

  log(`${envCode} catalog OK — ${t.blueprint}@v${bp.version} + ${t.seedPack}@v${sp.version}`);

  // ---- 1. Ensure registry row (idempotent, bypass) --------------------------
  await db.query('BEGIN');
  await db.query("SELECT set_config('app.bypass_rls','on',true)");
  await db.query(
    `INSERT INTO "Tenant" (id, slug, name, "tenantNo", "tenantCode", "tenantKey", "tenantClass", industry, status, "planId", "blueprintId", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PLANNED',$9,$10,CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET "tenantNo"=EXCLUDED."tenantNo", "tenantClass"=EXCLUDED."tenantClass",
       "planId"=EXCLUDED."planId", "blueprintId"=EXCLUDED."blueprintId", industry=EXCLUDED.industry`,
    [TARGET, t.key, t.name, t.no, envCode, t.key, t.tenantClass, t.industry, t.planId, t.blueprint],
  );
  await db.query('COMMIT');
  log(`${envCode} registry row ensured (tenantNo=${t.no}, class=${t.tenantClass}, plan=${t.planId}, bp=${t.blueprint})`);

  // ---- 2. Found-or-create ONE TenantLaunch, then run ------------------------
  const launches = await call('/api/platform/launches', PLATFORM);
  let launch = (Array.isArray(launches.body) ? launches.body : []).find((l) => l.targetTenantId === TARGET);
  if (!launch) {
    const created = await post('/api/platform/launches', PLATFORM, {
      targetTenantId: TARGET, targetTenantNo: t.no, blueprintId: t.blueprint, seedPackId: t.seedPack,
      name: t.name, tenantKey: t.key, tenantClass: t.tenantClass,
    });
    if (created.status >= 400) throw new Error(`create launch failed ${created.status}: ${JSON.stringify(created.body)}`);
    launch = created.body;
    log(`${envCode} launch created ${launch.id}`);
  } else {
    log(`${envCode} reusing existing launch ${launch.id} (idempotent)`);
  }
  const ran = await post(`/api/platform/launches/${launch.id}/run`, PLATFORM);
  if (ran.body?.status !== 'COMPLETED') throw new Error(`${envCode} launch did not COMPLETE: ${ran.body?.status} @ ${ran.body?.currentStepKey}`);
  const steps = Object.fromEntries((ran.body?.steps ?? []).map((s) => [s.stepKey, s]));
  log(`${envCode} launch COMPLETED — blueprint=${steps['apply-blueprint']?.result?.blueprintCode}, seed=${steps['load-seed-pack']?.result?.seedPackCode}, backup=${steps['provision-backup']?.result?.backupJobId ? 'yes' : 'no'}`);

  // ---- 3. Ensure the demo employee Membership -------------------------------
  await db.query('BEGIN');
  await db.query("SELECT set_config('app.bypass_rls','on',true)");
  await db.query(
    `INSERT INTO "Membership" (id, "tenantId", "userId", roles, status)
     VALUES ($1,$2,$3,$4,'active')
     ON CONFLICT ("tenantId","userId") DO UPDATE SET roles=EXCLUDED.roles, status='active'`,
    [`mbr-${EMP_ID}`, TARGET, EMP_ID, ['STAFF']],
  );
  await db.query('COMMIT');
  log(`${envCode} employee membership ensured (${EMP_ID})`);

  // ---- 4. Make admin + employee login-able (invite → activate → argon2) -----
  for (const [uid, pw, label] of [[ADMIN_ID, ADMIN_PW, 'admin'], [EMP_ID, EMP_PW, 'employee']]) {
    const inv = await post('/api/auth/invite', H(ADMIN_ID), { userId: uid });
    if (!inv.body?.token) throw new Error(`${envCode} invite ${label} (${uid}) failed ${inv.status}: ${JSON.stringify(inv.body)}`);
    const act = await post('/api/auth/activate', { 'content-type': 'application/json' }, { token: inv.body.token, password: pw });
    if (act.status >= 400) throw new Error(`${envCode} activate ${label} (${uid}) failed ${act.status}: ${JSON.stringify(act.body)}`);
    const login = await post('/api/auth/login', { 'content-type': 'application/json' }, { userId: uid, password: pw });
    if (login.status >= 400) throw new Error(`${envCode} login ${label} (${uid}) failed ${login.status}`);
    log(`${envCode} user ${label} activated + login OK: ${uid}`);
  }

  // ---- 5. Golden DEMO_BASELINE snapshot (idempotent) ------------------------
  // Capture ONE immutable DEMO_BASELINE for reset-demo. Skips if one exists.
  const baseline = await post(`/api/platform/tenants/${TARGET}/demo-baseline`, PLATFORM);
  if (baseline.status >= 400) throw new Error(`${envCode} demo-baseline failed ${baseline.status}: ${JSON.stringify(baseline.body)}`);
  log(`${envCode} DEMO_BASELINE ${baseline.body?.created ? 'captured' : 'present'} (${baseline.body?.job?.id ?? '?'})`);

  await db.query("SELECT set_config('app.bypass_rls','on',false)");
  return {
    tenantId: TARGET, tenantNo: t.no, status: 'ACTIVE', skipped: false,
    admin: { userId: ADMIN_ID, password: ADMIN_PW },
    employee: { userId: EMP_ID, password: EMP_PW },
  };
}

// ---- CLI: provision a single tenant --------------------------------------
// Run directly: node scripts/provision-tenant.mjs <tenantNo|key|id>
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly && process.argv[2]) {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  let step = 0;
  const log = (m) => console.log(`  [${++step}] ${m}`);
  try {
    const res = await provisionTenant(process.argv[2], { db, log });
    console.log(`\n${res.tenantId} → ${res.status}${res.skipped ? ' (skipped)' : ''}`);
    if (res.admin) {
      console.log(`  admin    userId=${res.admin.userId}  password=${res.admin.password}`);
      console.log(`  employee userId=${res.employee.userId}  password=${res.employee.password}`);
    }
  } catch (e) {
    console.error('\nprovision-tenant FAILED:', e?.message ?? e);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
