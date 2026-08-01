// Tenant Lifecycle smoke (test:lifecycle). Server up on :4000; golive template
// seeded (npm run seed:golive-template). Self-cleaning: creates a throwaway
// DEMO tenant, exercises reset-demo + go-live + guards, then removes all its
// residue. Asserts T002 (a sibling demo) is never touched and the registry ends
// back at 10 numbered tenants with T002–T010 still DEMO + DEMO_BASELINE present.
//
// Run: node scripts/lifecycle-smoke.mjs
import 'dotenv/config';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const PLATFORM = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };
const LOWPRIV = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-huyvu', 'x-authz-enforce': 'true' };

const TID = 'tenant-lifecycle-test';
const SIBLING = 'tenant-realestate-demo'; // T002 — must stay untouched

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const call = async (path, headers, opts = {}) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const post = (p, h, b) => call(p, h, { method: 'POST', body: b ? JSON.stringify(b) : undefined });
const patch = (p, h, b) => call(p, h, { method: 'PATCH', body: b ? JSON.stringify(b) : undefined });

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
// Bypass-RLS query in its OWN transaction (SET LOCAL only holds inside a tx).
const bypass = async (sql, params = []) => {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  const r = await c.query(sql, params);
  await c.query('COMMIT');
  return r;
};
const bypassRows = async (sql, params = []) => (await bypass(sql, params)).rows;
const personCount = async (tid) =>
  Number((await bypass(`SELECT COUNT(*)::int AS n FROM "PersonProfile" WHERE "tenantId"=$1`, [tid])).rows[0].n);

console.log('Tenant Lifecycle smoke @ ' + BASE);
try {
  // ---- Setup: throwaway DEMO tenant + a few business rows (no tenantNo) -----
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  await c.query(`DELETE FROM "PersonProfile" WHERE "tenantId"=$1`, [TID]).catch(() => {});
  await c.query(
    `INSERT INTO "Tenant" (id, slug, name, "tenantClass", status, mode, "updatedAt")
     VALUES ($1,$1,'SYSTEM Lifecycle Test','CUSTOMER','ACTIVE','DEMO',CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET mode='DEMO', status='ACTIVE'`, [TID]);
  for (const [id, name] of [['p1', 'Person One'], ['p2', 'Person Two'], ['p3', 'Person Three']]) {
    await c.query(
      `INSERT INTO "PersonProfile" (id, "tenantId", "fullName", status, "updatedAt")
       VALUES ($1,$2,$3,'active',CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING`,
      [`${TID}-${id}`, TID, name]);
  }
  await c.query('COMMIT');

  const siblingBefore = await personCount(SIBLING);

  // ---- 1. Capture DEMO_BASELINE --------------------------------------------
  const bl = await post(`/api/platform/tenants/${TID}/demo-baseline`, PLATFORM);
  ok(bl.status < 400 && bl.body?.job?.id, `DEMO_BASELINE captured (${bl.body?.job?.id})`);
  ok(await personCount(TID) === 3, 'baseline has 3 persons');

  // idempotent: second call does not create a new baseline
  const bl2 = await post(`/api/platform/tenants/${TID}/demo-baseline`, PLATFORM);
  ok(bl2.body?.created === false, 'demo-baseline idempotent (second call skips)');

  // ---- 2. reset-demo restores baseline (added gone, deleted restored) ------
  await c.query('BEGIN'); await c.query("SELECT set_config('app.bypass_rls','on',true)");
  await c.query(`INSERT INTO "PersonProfile" (id,"tenantId","fullName",status,"updatedAt") VALUES ($1,$2,'Rogue Add','active',CURRENT_TIMESTAMP)`, [`${TID}-rogue`, TID]);
  await c.query(`DELETE FROM "PersonProfile" WHERE id=$1`, [`${TID}-p2`]);
  await c.query('COMMIT');
  ok(await personCount(TID) === 3, 'data messed up (still 3: +rogue -p2)');

  const reset = await post(`/api/platform/tenants/${TID}/reset-demo`, PLATFORM);
  ok(reset.status === 200 || reset.status === 201, `reset-demo OK (${reset.status})`);
  const afterIds = (await bypassRows(`SELECT id FROM "PersonProfile" WHERE "tenantId"=$1 ORDER BY id`, [TID])).map((r) => r.id);
  ok(afterIds.length === 3 && !afterIds.includes(`${TID}-rogue`) && afterIds.includes(`${TID}-p2`),
    `reset restored baseline set (rogue gone, p2 back): ${afterIds.map((x) => x.replace(TID + '-', '')).join(',')}`);

  // ---- 3. MUST_NOT_LEAK: sibling T002 untouched ----------------------------
  ok(await personCount(SIBLING) === siblingBefore, `sibling ${SIBLING} person count unchanged (${siblingBefore})`);

  // ---- 4. enforcement: non-platform user → 403 -----------------------------
  const denied = await post(`/api/platform/tenants/${TID}/reset-demo`, LOWPRIV);
  ok(denied.status === 403, `non-platform user DENIED 403 on reset-demo (got ${denied.status})`);

  // ---- 5. Go-Live: create progress -----------------------------------------
  const gl = await post(`/api/platform/tenants/${TID}/go-live`, PLATFORM);
  ok(gl.status < 400 && Array.isArray(gl.body?.steps) && gl.body.steps.length >= 8, `go-live progress created (${gl.body?.steps?.length} steps)`);

  // activate with a required step incomplete → 400
  const early = await post(`/api/platform/tenants/${TID}/go-live/activate`, PLATFORM, {});
  ok(early.status === 400, `activate blocked while required steps incomplete (got ${early.status})`);

  // complete every required step
  const tpl = (await call(`/api/platform/tenants/${TID}/go-live`, PLATFORM)).body?.template;
  const requiredKeys = (tpl?.steps ?? []).filter((s) => s.required).map((s) => s.key);
  for (const k of requiredKeys) {
    await patch(`/api/platform/tenants/${TID}/go-live/steps/${k}`, PLATFORM, { status: 'DONE', assigneeId: 'user-nam' });
  }
  const ready = await call(`/api/platform/tenants/${TID}/go-live`, PLATFORM);
  ok(ready.body?.progress?.status === 'READY', `progress READY after required steps done (got ${ready.body?.progress?.status})`);

  // ---- 6. activate → LIVE + demo data cleared + go-live baseline -----------
  const act = await post(`/api/platform/tenants/${TID}/go-live/activate`, PLATFORM, { clearAll: true });
  ok(act.status < 400 && act.body?.mode === 'LIVE', `activate → LIVE (${act.status})`);
  ok(await personCount(TID) === 0, 'demo business data cleared (persons=0)');
  const glBaseline = Number((await bypass(`SELECT COUNT(*)::int AS n FROM "BackupJob" WHERE "tenantId"=$1 AND kind='GOLIVE_BASELINE'`, [TID])).rows[0].n);
  ok(glBaseline >= 1, `go-live baseline snapshot exists (${glBaseline})`);
  const modeNow = (await bypass(`SELECT mode FROM "Tenant" WHERE id=$1`, [TID])).rows[0].mode;
  ok(modeNow === 'LIVE', `Tenant.mode=LIVE persisted`);

  // ---- 7. reset-demo now blocked (LIVE) → 409 ------------------------------
  const resetLive = await post(`/api/platform/tenants/${TID}/reset-demo`, PLATFORM);
  ok(resetLive.status === 409, `reset-demo on LIVE tenant → 409 (got ${resetLive.status})`);

  // ---- 8. registry + demo siblings intact ----------------------------------
  const list = await call('/api/platform/tenants', PLATFORM);
  ok(Array.isArray(list.body) && list.body.length === 10, `registry still 10 numbered tenants (got ${list.body?.length})`);
  const demos = (await bypass(`SELECT COUNT(*)::int AS n FROM "Tenant" WHERE "tenantNo" BETWEEN 2 AND 10 AND mode='DEMO'`, [])).rows[0].n;
  ok(Number(demos) === 9, `T002–T010 all still DEMO (got ${demos}/9)`);
  const baselines = (await bypass(`SELECT COUNT(DISTINCT "tenantId")::int AS n FROM "BackupJob" WHERE kind='DEMO_BASELINE' AND "tenantId" IN (SELECT id FROM "Tenant" WHERE "tenantNo" BETWEEN 2 AND 10)`, [])).rows[0].n;
  ok(Number(baselines) === 9, `T002–T010 each has a DEMO_BASELINE (got ${baselines}/9)`);
} catch (e) {
  console.error('  ✗ unexpected error:', e?.message ?? e);
  failed++;
} finally {
  // ---- Self-cleaning: remove ALL throwaway residue -------------------------
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('app.bypass_rls','on',true)");
    for (const t of ['PersonProfile', 'AuditLog', 'BackupJob', 'RestoreJob']) {
      await c.query(`DELETE FROM "${t}" WHERE "tenantId"=$1`, [TID]).catch(() => {});
    }
    await c.query(`DELETE FROM "TenantGoLive" WHERE "tenantId"=$1`, [TID]).catch(() => {});
    await c.query(`DELETE FROM "Tenant" WHERE id=$1`, [TID]).catch(() => {});
    await c.query('COMMIT');
  } catch { await c.query('ROLLBACK').catch(() => {}); }
  try {
    const base = process.env.BACKUP_STORAGE_DIR ?? join(process.cwd(), 'storage', 'backups');
    rmSync(join(base, TID), { recursive: true, force: true });
  } catch { /* best-effort */ }
  await c.end();
  console.log('  · cleaned up throwaway tenant + backups');
}

console.log(failed === 0 ? '\nLIFECYCLE SMOKE PASSED' : `\nLIFECYCLE SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
