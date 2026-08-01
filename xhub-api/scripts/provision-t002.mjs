// Provision T002 — Real-estate demo tenant (SaaS step 6a). Run: npm run provision:t002
//
// FIRST real end-to-end SaaS proof: provisions a running SECOND tenant (T002,
// `tenant-realestate-demo`, tenantNo=2, class VERTICAL_DEMO) via the EXISTING
// Launch Factory (8-step TenantLaunch engine) + BP-RE-002 blueprint + SP-RE-DEMO
// seed pack. Reuses the launch engine / catalog / registry / backup — no new
// provisioning engine. Server MUST be up on :4000 (the launch runs through the
// platform launch API). Idempotent + repeatable on a fresh DB / new machine:
//   - registry T002 row ensured (pg, bypass) — mirrors seed:tenant-registry.
//   - a single TenantLaunch per target is reused (found-or-created) then run.
//   - the SP-RE-DEMO datasets are idempotent upsert-by-id (re-run: no dupes).
//   - two login-able users (T002 admin + a T002 employee) activated via the
//     internal auth flow (argon2 UserCredential — NO plaintext in the repo;
//     passwords come from ENV or a random per-run default, printed once).
//
// Requires: DATABASE_URL. Assumes `npm run seed:tenant-registry` +
// `npm run seed:blueprint-catalog` have run (BP-RE-002 v2 + SP-RE-DEMO v2
// PUBLISHED) — this script verifies and aborts with guidance if they are absent.
import 'dotenv/config';
import pg from 'pg';
import { randomBytes } from 'node:crypto';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const TARGET = 'tenant-realestate-demo';
const TENANT_NO = 2;
const BLUEPRINT = 'BP-RE-002';
const SEED_PACK = 'SP-RE-DEMO';
const ADMIN_ID = `${TARGET}-admin`; // created by the launch identity-baseline step
const EMP_ID = 't002-re-agent-01'; // a synthetic demo person from SP-RE-DEMO

// Passwords: ENV-overridable so the demo operator can pick them; otherwise a
// strong random per-run value (NEVER written to the repo). Printed once below.
const ADMIN_PW = process.env.T002_ADMIN_PASSWORD || `T002-Admin!${randomBytes(6).toString('hex')}`;
const EMP_PW = process.env.T002_EMP_PASSWORD || `T002-Emp!${randomBytes(6).toString('hex')}`;

const H = (user) => ({ 'content-type': 'application/json', 'x-tenant-id': TARGET, 'x-user-id': user });
const PLATFORM = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' }; // PLATFORM_ADMIN

const call = async (path, headers, opts = {}) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const post = (p, h, b) => call(p, h, { method: 'POST', body: b ? JSON.stringify(b) : undefined });

let step = 0;
const log = (m) => console.log(`  [${++step}] ${m}`);

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  console.log(`Provision T002 (${TARGET}) @ ${BASE}`);

  // ---- 0. Preconditions: catalog must carry PUBLISHED BP-RE-002 + SP-RE-DEMO --
  await db.query("SELECT set_config('app.bypass_rls','on',false)");
  const bp = (await db.query(`SELECT version FROM "Blueprint" WHERE code=$1 AND status='PUBLISHED' ORDER BY version DESC LIMIT 1`, [BLUEPRINT])).rows[0];
  const sp = (await db.query(`SELECT version FROM "SeedPack" WHERE code=$1 AND status='PUBLISHED' ORDER BY version DESC LIMIT 1`, [SEED_PACK])).rows[0];
  if (!bp || !sp) {
    throw new Error(`catalog missing PUBLISHED ${!bp ? BLUEPRINT : ''} ${!sp ? SEED_PACK : ''} — run: npm run seed:blueprint-catalog`);
  }
  log(`catalog OK — ${BLUEPRINT}@v${bp.version} + ${SEED_PACK}@v${sp.version} PUBLISHED`);

  // ---- 1. Ensure the registry T002 row (idempotent, bypass) ------------------
  await db.query('BEGIN');
  await db.query("SELECT set_config('app.bypass_rls','on',true)");
  await db.query(
    `INSERT INTO "Tenant" (id, slug, name, "tenantNo", "tenantCode", "tenantKey", "tenantClass", industry, status, "planId", "blueprintId", "updatedAt")
     VALUES ($1,'realestate-demo','Chủ đầu tư Bất động sản Demo',$2,'T002','realestate-demo','VERTICAL_DEMO','Chủ đầu tư và phát triển bất động sản','PLANNED','ENTERPRISE_VERTICAL_DEMO','REAL_ESTATE_DEVELOPER',CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET "tenantNo"=EXCLUDED."tenantNo", "tenantClass"=EXCLUDED."tenantClass"`,
    [TARGET, TENANT_NO],
  );
  await db.query('COMMIT');
  log(`registry T002 row ensured (tenantNo=${TENANT_NO}, class=VERTICAL_DEMO)`);

  // ---- 2. Found-or-create a single TenantLaunch, then run --------------------
  const launches = await call('/api/platform/launches', PLATFORM);
  let launch = (Array.isArray(launches.body) ? launches.body : []).find((l) => l.targetTenantId === TARGET);
  if (!launch) {
    const created = await post('/api/platform/launches', PLATFORM, {
      targetTenantId: TARGET,
      targetTenantNo: TENANT_NO,
      blueprintId: BLUEPRINT,
      seedPackId: SEED_PACK,
      name: 'Chủ đầu tư Bất động sản Demo',
      tenantKey: 'realestate-demo',
      tenantClass: 'VERTICAL_DEMO',
    });
    if (created.status >= 400) throw new Error(`create launch failed ${created.status}: ${JSON.stringify(created.body)}`);
    launch = created.body;
    log(`launch created ${launch.id} (blueprint ${BLUEPRINT}, seed ${SEED_PACK})`);
  } else {
    log(`reusing existing launch ${launch.id} (idempotent)`);
  }
  const ran = await post(`/api/platform/launches/${launch.id}/run`, PLATFORM);
  if (ran.body?.status !== 'COMPLETED') throw new Error(`launch did not COMPLETE: ${ran.body?.status} @ ${ran.body?.currentStepKey}`);
  const steps = Object.fromEntries((ran.body?.steps ?? []).map((s) => [s.stepKey, s]));
  log(`launch COMPLETED — apply-blueprint=${steps['apply-blueprint']?.result?.blueprintCode}@v${steps['apply-blueprint']?.result?.version}, load-seed-pack=${steps['load-seed-pack']?.result?.seedPackCode}@v${steps['load-seed-pack']?.result?.version}, backup=${steps['provision-backup']?.result?.backupJobId ? 'yes' : 'no'}`);

  // ---- 3. Ensure a T002 employee Membership (admin made by identity-baseline) -
  // The SP-RE-DEMO pack seeds the PersonProfile t002-re-agent-01 but not a
  // Membership (composite key — not an id-upsert dataset). Add it here so the
  // employee is invitable/login-able. Idempotent upsert-by (tenantId,userId).
  await db.query('BEGIN');
  await db.query("SELECT set_config('app.bypass_rls','on',true)");
  await db.query(
    `INSERT INTO "Membership" (id, "tenantId", "userId", roles, status)
     VALUES ($1,$2,$3,$4,'active')
     ON CONFLICT ("tenantId","userId") DO UPDATE SET roles=EXCLUDED.roles, status='active'`,
    [`mbr-${EMP_ID}`, TARGET, EMP_ID, ['SALES_MANAGER', 'STAFF']],
  );
  await db.query('COMMIT');
  log(`T002 employee membership ensured (${EMP_ID} → SALES_MANAGER)`);

  // ---- 4. Make the two users login-able via the internal auth flow ----------
  // invite (idempotent, supersedes) → activate with a password → argon2
  // UserCredential. NO plaintext in the repo; passwords are ENV/random.
  for (const [uid, pw, label] of [[ADMIN_ID, ADMIN_PW, 'admin'], [EMP_ID, EMP_PW, 'employee']]) {
    const inv = await post('/api/auth/invite', H(ADMIN_ID), { userId: uid });
    if (!inv.body?.token) throw new Error(`invite ${label} (${uid}) failed ${inv.status}: ${JSON.stringify(inv.body)}`);
    const act = await post('/api/auth/activate', { 'content-type': 'application/json' }, { token: inv.body.token, password: pw });
    if (act.status >= 400) throw new Error(`activate ${label} (${uid}) failed ${act.status}: ${JSON.stringify(act.body)}`);
    // confirm login works
    const login = await post('/api/auth/login', { 'content-type': 'application/json' }, { userId: uid, password: pw });
    if (login.status >= 400) throw new Error(`login ${label} (${uid}) failed ${login.status}`);
    log(`user ${label} activated + login OK: ${uid}`);
  }

  // ---- 5. Summary ------------------------------------------------------------
  await db.query("SELECT set_config('app.bypass_rls','on',false)");
  const row = (await db.query(`SELECT status, "tenantNo" FROM "Tenant" WHERE id=$1`, [TARGET])).rows[0];
  console.log('\nT002 PROVISIONED');
  console.log(`  registry: status=${row.status} tenantNo=${row.tenantNo}`);
  console.log('  login (x-tenant-id: tenant-realestate-demo):');
  console.log(`    admin    userId=${ADMIN_ID}  password=${ADMIN_PW}`);
  console.log(`    employee userId=${EMP_ID}  password=${EMP_PW}`);
  console.log('  (passwords are ENV-overridable: T002_ADMIN_PASSWORD / T002_EMP_PASSWORD; not stored in repo)');
} catch (e) {
  await db.query('ROLLBACK').catch(() => {});
  console.error('\nprovision:t002 FAILED:', e?.message ?? e);
  process.exitCode = 1;
} finally {
  await db.end();
}
