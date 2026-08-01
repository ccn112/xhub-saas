// Tenant Launch Factory smoke (test:launch-factory) — SaaS step 3 / E4.
// Server up on :4000. FULLY SELF-CLEANING against a throwaway target tenant.
//
// Proves the launch pipeline (non-negotiable #8 — idempotent, retryable,
// audited, resumable):
//   A. create launch → run → all 8 steps DONE → status COMPLETED + registry ACTIVE.
//   B. idempotency: re-run → no step re-executed (attempts unchanged, no dupes).
//   C. retry/resume: inject a transient failure on ONE step → launch FAILED at
//      that step (prior steps DONE) → retry → resumes to COMPLETED WITHOUT
//      re-doing the prior steps (their attempts stay 1).
//   D. isolation: MUST_NOT_LEAK — the launched tenant and tenant-xtech cannot see
//      each other's rows (RLS proof, both via the isolation step and a direct DB check).
//   E. enforcement: a non-platform user → 403 on /api/platform/launches.
// Run: node scripts/launch-factory-smoke.mjs
import 'dotenv/config';
import pg from 'pg';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const TARGET = 'tenant-launch-test'; // throwaway (SYSTEM-LAUNCH-TEST)
const H = (user, extra = {}) => ({
  'content-type': 'application/json',
  'x-tenant-id': 'tenant-xtech',
  'x-user-id': user,
  ...extra,
});
const ENFORCE = { 'x-authz-enforce': 'true' };
const OP = H('user-nam'); // tenant PLATFORM_ADMIN=['*'] — happy path (no enforce)
const LAUNCH_MGR = H('usr-tenant-admin', ENFORCE); // PLT_TENANT_LAUNCH_MANAGER
const TENANT_ONLY = H('user-huyvu', ENFORCE); // tenant role, no platform perm

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
const stepMap = (launch) => Object.fromEntries((launch.steps ?? []).map((s) => [s.stepKey, s]));

console.log('Launch Factory smoke @ ' + BASE);
const createdLaunchIds = [];

async function cleanup() {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  for (const id of createdLaunchIds) {
    await c.query(`DELETE FROM "TenantLaunchStep" WHERE "launchId" = $1`, [id]).catch(() => {});
    await c.query(`DELETE FROM "TenantLaunch" WHERE id = $1`, [id]).catch(() => {});
  }
  for (const t of [
    'AuditLog', 'Membership', 'OrgUnit', 'PersonProfile', 'TenantApplicationInstance',
    'AppAccountBinding', 'ProvisioningCommand', 'RestoreJob', 'BackupJob',
  ]) {
    await c.query(`DELETE FROM "${t}" WHERE "tenantId" = $1`, [TARGET]).catch(() => {});
  }
  await c.query(`DELETE FROM "Tenant" WHERE id = $1`, [TARGET]).catch(() => {});
  await c.query('COMMIT').catch(() => {});
  await c.end();
  // Backup artifacts on disk (storage/backups/<target>/...).
  try { rmSync(join(process.cwd(), 'storage', 'backups', TARGET), { recursive: true, force: true }); } catch {}
}

try {
  // Pre-clean any residue from a prior aborted run.
  await cleanup();
  createdLaunchIds.length = 0;

  const registryBefore = (await call('/api/platform/tenants', OP)).body;
  const registryCountBefore = Array.isArray(registryBefore) ? registryBefore.length : -1;

  // ---- E. enforcement -------------------------------------------------------
  const denied = await call('/api/platform/launches', TENANT_ONLY);
  ok(denied.status === 403, `non-platform user DENIED 403 on GET /launches (got ${denied.status})`);
  const mgrList = await call('/api/platform/launches', LAUNCH_MGR);
  ok(mgrList.status === 200, `PLT_ launch-manager passes GET /launches (got ${mgrList.status})`);

  // ---- A. create + run → COMPLETED -----------------------------------------
  const created = await call('/api/platform/launches', OP, {
    method: 'POST',
    body: JSON.stringify({ targetTenantId: TARGET, name: 'Launch Factory Test', tenantKey: 'launch-test' }),
  });
  ok(created.status === 201 || created.status === 200, `POST create launch (got ${created.status})`);
  const launchId = created.body?.id;
  if (launchId) createdLaunchIds.push(launchId);
  ok(created.body?.status === 'QUEUED' && (created.body?.steps ?? []).length === 8, `launch QUEUED with 8 steps (got ${created.body?.status}, ${created.body?.steps?.length})`);

  const ran = await call(`/api/platform/launches/${launchId}/run`, OP, { method: 'POST' });
  ok(ran.body?.status === 'COMPLETED', `run → COMPLETED (got ${ran.body?.status})`);
  const s1 = stepMap(ran.body);
  ok(Object.values(s1).every((s) => s.status === 'DONE') && Object.keys(s1).length === 8, 'all 8 steps DONE');
  ok(s1['isolation-test']?.result?.mustNotLeak === true, 'isolation-test step: mustNotLeak = true');
  ok(s1['handover']?.result?.registryStatus === 'ACTIVE', 'handover step: registryStatus ACTIVE');

  const targetRow = await call(`/api/platform/tenants/${TARGET}`, OP);
  ok(targetRow.body?.status === 'ACTIVE', `registry row status ACTIVE (got ${targetRow.body?.status})`);

  // ---- B. idempotency: re-run does not re-execute --------------------------
  const rerun = await call(`/api/platform/launches/${launchId}/run`, OP, { method: 'POST' });
  const s2 = stepMap(rerun.body);
  ok(rerun.body?.status === 'COMPLETED', 're-run still COMPLETED');
  ok(Object.values(s2).every((s) => s.attempts === 1), 'idempotent: every step attempts still = 1 (no re-execution)');
  // no duplicate backup jobs for the target.
  const dbc = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await dbc.connect();
  await dbc.query("SELECT set_config('app.bypass_rls','on',false)");
  const backupCount = Number((await dbc.query(`SELECT count(*)::int n FROM "BackupJob" WHERE "tenantId"=$1`, [TARGET])).rows[0].n);
  ok(backupCount === 1, `idempotent: exactly 1 backup job for target (got ${backupCount})`);

  // ---- D. isolation: direct DB RLS proof -----------------------------------
  await dbc.query("SELECT set_config('app.bypass_rls','off',false)");
  await dbc.query("SELECT set_config('app.current_tenant',$1,false)", [TARGET]);
  const targetSeesXtech = Number((await dbc.query(`SELECT count(*)::int n FROM "OrgUnit" WHERE "tenantId"='tenant-xtech'`)).rows[0].n);
  await dbc.query("SELECT set_config('app.current_tenant','tenant-xtech',false)");
  const xtechSeesTarget = Number((await dbc.query(`SELECT count(*)::int n FROM "OrgUnit" WHERE "tenantId"=$1`, [TARGET])).rows[0].n);
  ok(targetSeesXtech === 0 && xtechSeesTarget === 0, `MUST_NOT_LEAK direct DB: target→xtech=${targetSeesXtech}, xtech→target=${xtechSeesTarget}`);
  await dbc.end();

  // ---- C. retry/resume via injected transient failure ----------------------
  const failLaunch = await call('/api/platform/launches', OP, {
    method: 'POST',
    body: JSON.stringify({ targetTenantId: TARGET, name: 'Retry Test', tenantKey: 'launch-test', request: { __failSteps: { 'provision-backup': 2 } } }),
  });
  const failId = failLaunch.body?.id;
  if (failId) createdLaunchIds.push(failId);

  const firstRun = await call(`/api/platform/launches/${failId}/run`, OP, { method: 'POST' });
  const f1 = stepMap(firstRun.body);
  ok(firstRun.body?.status === 'FAILED', `injected failure → launch FAILED (got ${firstRun.body?.status})`);
  ok(f1['provision-backup']?.status === 'FAILED', 'failed AT provision-backup step');
  ok(firstRun.body?.currentStepKey === 'provision-backup', 'currentStepKey = provision-backup');
  ok(['register', 'identity-baseline', 'enable-apps', 'apply-blueprint', 'load-seed-pack'].every((k) => f1[k]?.status === 'DONE'), 'prior 5 steps DONE');
  ok(['isolation-test', 'handover'].every((k) => f1[k]?.status === 'PENDING'), 'later steps still PENDING');

  const retried = await call(`/api/platform/launches/${failId}/retry`, OP, { method: 'POST' });
  const f2 = stepMap(retried.body);
  ok(retried.body?.status === 'COMPLETED', `retry → resumes to COMPLETED (got ${retried.body?.status})`);
  ok(f2['provision-backup']?.status === 'DONE' && f2['provision-backup']?.attempts === 2, `provision-backup DONE on attempt 2 (got ${f2['provision-backup']?.attempts})`);
  ok(['register', 'identity-baseline', 'enable-apps', 'apply-blueprint', 'load-seed-pack'].every((k) => f2[k]?.attempts === 1), 'resume did NOT re-do prior steps (attempts still 1)');

  // ---- registry residue sanity (before cleanup) ----------------------------
  const registryDuring = (await call('/api/platform/tenants', OP)).body;
  ok(Array.isArray(registryDuring) && registryDuring.length === registryCountBefore, `commercial registry count unchanged (${registryCountBefore}, target has no tenantNo)`);
} catch (e) {
  console.error('  ✗ smoke threw:', e?.message ?? e);
  failed++;
} finally {
  await cleanup();
  // Verify 0 residue.
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query("SELECT set_config('app.bypass_rls','on',false)");
  let residue = 0;
  for (const t of ['TenantLaunch', 'OrgUnit', 'PersonProfile', 'Membership', 'TenantApplicationInstance', 'BackupJob', 'AuditLog', 'Tenant']) {
    const col = t === 'TenantLaunch' ? 'targetTenantId' : t === 'Tenant' ? 'id' : 'tenantId';
    residue += Number((await c.query(`SELECT count(*)::int n FROM "${t}" WHERE "${col}"=$1`, [TARGET])).rows[0].n);
  }
  await c.end();
  ok(residue === 0, `0 residue after cleanup (got ${residue})`);
  console.log(`  · cleaned up ${createdLaunchIds.length} launch(es) + target tenant`);
}

console.log(failed === 0 ? '\nLAUNCH FACTORY SMOKE PASSED' : `\nLAUNCH FACTORY SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
