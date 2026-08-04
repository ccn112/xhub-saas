// Solution Delivery Workspace smoke (test:delivery) — SaaS step 5. Server up on
// :4000. FULLY SELF-CLEANING (prefix ENG-SMOKE-) + a throwaway target tenant
// (tenant-delivery-test / SYSTEM-DELIVERY-TEST).
//
// Proves:
//   1. enforcement: non-delivery user → 403; SOLUTION_DELIVERY_MANAGER → 200.
//   2. create engagement (LEAD) → walk the FULL lifecycle to GO_LIVE; illegal
//      transition → 400 (golive from LEAD, and re-qualify from GO_LIVE).
//   3. comment + attachment (RecordDocument subjectType=Engagement) round-trip.
//   4. hold ⇄ resume (status overlay).
//   5. at GO_LIVE trigger a REAL TenantLaunch (Launch Factory) for the throwaway
//      customer → launch runs to COMPLETED (8 steps DONE) → engagement references
//      launchId → detail embeds live launch progress.
//   6. NO DUAL-WRITE proof: the customer tenant's business rows were written ONLY
//      by the launch (under the TARGET tenant); the engagement plane (Engagement/
//      EngagementEvent/engagement.* audit) has ZERO rows under the target tenant.
//   7. tenant isolation: demo-isolation sees 0 xtech engagements.
//   8. cleanup engagement + launch + target tenant → 0 residue.
import 'dotenv/config';
import pg from 'pg';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const TARGET = 'tenant-delivery-test'; // throwaway (SYSTEM-DELIVERY-TEST)
const PREFIX = 'ENG-SMOKE-';
const H = (user, extra = {}) => ({ 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': user, ...extra });
const ENFORCE = { 'x-authz-enforce': 'true' };
const OP = H('user-nam'); // tenant PLATFORM_ADMIN=['*'] — happy path (no enforce)

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const call = async (path, headers, opts = {}) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const post = (path, headers, data) => call(path, headers, { method: 'POST', body: JSON.stringify(data ?? {}) });

console.log('Delivery smoke @ ' + BASE);
const createdEngIds = [];
const createdLaunchIds = [];

async function cleanup() {
  // Phase 1.5 Stage C: Engagement/EngagementEvent/RecordDocument/DocumentVersion
  // now live in the X.Office database; TenantLaunch + the throwaway target
  // tenant's platform-side rows still live in XHub Platform's database (the
  // Launch Factory itself hasn't migrated — Delivery calls it over HTTP).
  const xo = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
  await xo.connect();
  await xo.query('BEGIN');
  await xo.query("SELECT set_config('app.bypass_rls','on',true)");
  const idRows = await xo.query(`SELECT id FROM "Engagement" WHERE id = ANY($1::text[]) OR code LIKE $2`, [createdEngIds, `${PREFIX}%`]);
  const engIds = [...new Set([...createdEngIds, ...idRows.rows.map((r) => r.id)])];
  if (engIds.length) {
    await xo.query(`DELETE FROM "DocumentVersion" WHERE "documentId" IN (SELECT id FROM "RecordDocument" WHERE "subjectType"='Engagement' AND "subjectId" = ANY($1::text[]))`, [engIds]).catch(() => {});
    await xo.query(`DELETE FROM "RecordDocument" WHERE "subjectType"='Engagement' AND "subjectId" = ANY($1::text[])`, [engIds]).catch(() => {});
    await xo.query(`DELETE FROM "EngagementEvent" WHERE "engagementId" = ANY($1::text[])`, [engIds]).catch(() => {});
    await xo.query(`DELETE FROM "Engagement" WHERE id = ANY($1::text[])`, [engIds]).catch(() => {});
  }
  await xo.query('COMMIT').catch(() => {});
  await xo.end();

  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  // Launch + throwaway target tenant plane.
  const launchRows = await c.query(`SELECT id FROM "TenantLaunch" WHERE "targetTenantId" = $1`, [TARGET]);
  const launchIds = [...new Set([...createdLaunchIds, ...launchRows.rows.map((r) => r.id)])];
  for (const id of launchIds) {
    await c.query(`DELETE FROM "TenantLaunchStep" WHERE "launchId" = $1`, [id]).catch(() => {});
    await c.query(`DELETE FROM "TenantLaunch" WHERE id = $1`, [id]).catch(() => {});
  }
  for (const t of ['AuditLog', 'Membership', 'OrgUnit', 'PersonProfile', 'TenantApplicationInstance', 'AppAccountBinding', 'ProvisioningCommand', 'RestoreJob', 'BackupJob']) {
    await c.query(`DELETE FROM "${t}" WHERE "tenantId" = $1`, [TARGET]).catch(() => {});
  }
  await c.query(`DELETE FROM "Tenant" WHERE id = $1`, [TARGET]).catch(() => {});
  await c.query('COMMIT').catch(() => {});
  await c.end();
  try { rmSync(join(process.cwd(), 'storage', 'backups', TARGET), { recursive: true, force: true }); } catch {}
}

try {
  await cleanup();
  createdEngIds.length = 0;
  createdLaunchIds.length = 0;

  // ---- 1. enforcement -------------------------------------------------------
  const denied = await post('/api/delivery/engagements', H('usr-employee-smoke', ENFORCE), { customerName: 'X' });
  ok(denied.status === 403, `non-delivery user DENIED 403 on create (got ${denied.status})`);
  const mgr = await post('/api/delivery/engagements', H('usr-delivery-mgr', ENFORCE), { code: `${PREFIX}MGR-${Date.now().toString(36)}`, customerName: 'SMOKE — role check' });
  ok(mgr.status === 200 || mgr.status === 201, `SOLUTION_DELIVERY_MANAGER passes create (got ${mgr.status})`);
  if (mgr.body?.id) createdEngIds.push(mgr.body.id);

  // ---- 2. create + lifecycle walk ------------------------------------------
  const code = `${PREFIX}${Date.now().toString(36).toUpperCase()}`;
  const created = await post('/api/delivery/engagements', OP, {
    // NOTE: no prospectTenantNo — the throwaway target must not claim a real
    // registry tenantNo (unique) or the launch register step would collide.
    code, customerName: 'SMOKE — Chủ đầu tư BĐS Demo', industry: 'REAL_ESTATE',
    targetTenantId: TARGET, blueprintCode: 'BP-RE-002', seedPackCode: 'SP-RE-DEMO', value: 1000000000,
  });
  ok(created.status === 200 || created.status === 201, `create engagement (got ${created.status})`);
  const id = created.body?.id;
  if (id) createdEngIds.push(id);
  ok(created.body?.stage === 'LEAD' && created.body?.status === 'OPEN', `initial LEAD/OPEN (got ${created.body?.stage}/${created.body?.status})`);

  // illegal: golive from LEAD → 400.
  const badGolive = await post(`/api/delivery/engagements/${id}/golive`, OP);
  ok(badGolive.status === 400, `golive from LEAD rejected 400 (got ${badGolive.status})`);

  const walk = ['qualify', 'survey', 'design', 'propose', 'win', 'implement', 'migrate', 'uat', 'golive'];
  const expected = ['QUALIFIED', 'SURVEY', 'SOLUTION_DESIGN', 'PROPOSAL', 'WON', 'IMPLEMENTATION', 'MIGRATION', 'UAT', 'GO_LIVE'];
  let walkOk = true;
  for (let i = 0; i < walk.length; i++) {
    const res = await post(`/api/delivery/engagements/${id}/${walk[i]}`, OP);
    if (res.body?.engagement?.stage !== expected[i]) { walkOk = false; console.error(`    ! ${walk[i]} → ${res.body?.engagement?.stage} (want ${expected[i]})`); }
  }
  ok(walkOk, 'lifecycle walked LEAD → … → GO_LIVE (all stages correct)');

  // illegal after GO_LIVE: re-qualify → 400.
  const badReQualify = await post(`/api/delivery/engagements/${id}/qualify`, OP);
  ok(badReQualify.status === 400, `qualify from GO_LIVE rejected 400 (got ${badReQualify.status})`);

  // ---- 3. comment + attachment ---------------------------------------------
  const cmt = await post(`/api/delivery/engagements/${id}/comment`, OP, { body: 'Ghi chú triển khai' });
  ok(cmt.body?.ok === true, 'comment recorded');
  const att = await post(`/api/delivery/engagements/${id}/attachments`, OP, { title: 'sow.txt', note: 'SOW', content: 'noi dung SOW' });
  ok((att.status === 200 || att.status === 201) && att.body?.document?.subjectType === 'Engagement', `attachment subjectType=Engagement (got ${att.body?.document?.subjectType})`);
  const detail1 = await call(`/api/delivery/engagements/${id}`, OP);
  ok((detail1.body?.attachments ?? []).some((d) => d.id === att.body?.document?.id), 'attachment appears in detail (via records)');
  ok((detail1.body?.events ?? []).some((e) => e.type === 'comment'), 'comment appears in timeline');

  // ---- 4. hold ⇄ resume -----------------------------------------------------
  const held = await post(`/api/delivery/engagements/${id}/hold`, OP, { note: 'chờ khách' });
  ok(held.body?.engagement?.status === 'ON_HOLD', `hold → ON_HOLD (got ${held.body?.engagement?.status})`);
  const blockedWhileHeld = await post(`/api/delivery/engagements/${id}/hypercare`, OP);
  ok(blockedWhileHeld.status === 400, `transition blocked while ON_HOLD (got ${blockedWhileHeld.status})`);
  const resumed = await post(`/api/delivery/engagements/${id}/resume`, OP);
  ok(resumed.body?.engagement?.status === 'LIVE', `resume → LIVE (stage-derived) (got ${resumed.body?.engagement?.status})`);

  // ---- 5. launch link (non-negotiable #12) ---------------------------------
  const launched = await post(`/api/delivery/engagements/${id}/launch`, OP, { tenantKey: 'delivery-test', name: 'SMOKE — BĐS Demo Launch' });
  ok(launched.status === 200 || launched.status === 201, `POST launch (got ${launched.status})`);
  const launchId = launched.body?.launch?.id;
  if (launchId) createdLaunchIds.push(launchId);
  ok(launched.body?.launch?.status === 'COMPLETED', `launch ran to COMPLETED (got ${launched.body?.launch?.status})`);
  ok((launched.body?.launch?.steps ?? []).length === 8 && (launched.body?.launch?.steps ?? []).every((s) => s.status === 'DONE'), 'all 8 launch steps DONE');
  ok(launched.body?.engagement?.launchId === launchId, `engagement references launchId (got ${launched.body?.engagement?.launchId})`);

  // double-launch rejected.
  const badRelaunch = await post(`/api/delivery/engagements/${id}/launch`, OP, {});
  ok(badRelaunch.status === 400, `re-launch rejected 400 (got ${badRelaunch.status})`);

  // detail embeds live launch progress.
  const detail2 = await call(`/api/delivery/engagements/${id}`, OP);
  ok(detail2.body?.launch?.id === launchId && detail2.body?.launch?.status === 'COMPLETED', 'detail embeds live launch progress');
  ok((detail2.body?.events ?? []).some((e) => e.type === 'launch-triggered'), 'launch-triggered event in timeline');

  // ---- 6. NO DUAL-WRITE proof ----------------------------------------------
  // Phase 1.5 Stage C: OrgUnit + launch.* AuditLog are written by the Launch
  // Factory (XHub Platform's own DB); Engagement/EngagementEvent + engagement.*
  // AuditLog are written by Delivery (X.Office's own DB) — 2 separate
  // connections, each with its own AuditLog copy.
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query("SELECT set_config('app.bypass_rls','on',false)");
  const n = async (q, p) => Number((await db.query(q, p)).rows[0].n);
  const targetOrg = await n(`SELECT count(*)::int n FROM "OrgUnit" WHERE "tenantId"=$1`, [TARGET]);
  ok(targetOrg > 0, `launch wrote customer tenant business rows (OrgUnit=${targetOrg})`);
  const launchAuditUnderTarget = await n(`SELECT count(*)::int n FROM "AuditLog" WHERE "tenantId"=$1 AND action LIKE 'launch.%'`, [TARGET]);
  ok(launchAuditUnderTarget > 0, `customer tenant rows attributed to the LAUNCH only (launch.* audit=${launchAuditUnderTarget})`);
  await db.end();

  const xo2 = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
  await xo2.connect();
  await xo2.query("SELECT set_config('app.bypass_rls','on',false)");
  const nx = async (q, p) => Number((await xo2.query(q, p)).rows[0].n);
  const engUnderTarget = await nx(`SELECT count(*)::int n FROM "Engagement" WHERE "tenantId"=$1`, [TARGET]);
  const engEvtUnderTarget = await nx(`SELECT count(*)::int n FROM "EngagementEvent" WHERE "tenantId"=$1`, [TARGET]);
  ok(engUnderTarget === 0 && engEvtUnderTarget === 0, `NO dual-write: 0 engagement rows under target tenant (Engagement=${engUnderTarget}, EngagementEvent=${engEvtUnderTarget})`);
  const engAuditUnderTarget = await nx(`SELECT count(*)::int n FROM "AuditLog" WHERE "tenantId"=$1 AND action LIKE 'engagement.%'`, [TARGET]);
  ok(engAuditUnderTarget === 0, `NO dual-write: 0 engagement.* audit under target (got ${engAuditUnderTarget})`);
  const engAuditUnderT001 = await nx(`SELECT count(*)::int n FROM "AuditLog" WHERE "tenantId"='tenant-xtech' AND action='engagement.launch-triggered' AND "instanceCode"=$1`, [id]);
  ok(engAuditUnderT001 > 0, 'engagement launch audit lives under T001 (not the customer tenant)');
  await xo2.end();

  // ---- 7. tenant isolation --------------------------------------------------
  const iso = await call('/api/delivery/engagements?pageSize=200', H('user-nam', { 'x-tenant-id': 'tenant-demo-isolation' }));
  const isoLeak = Array.isArray(iso.body?.items) ? iso.body.items.filter((r) => r.tenantId === 'tenant-xtech').length : 0;
  ok(isoLeak === 0, `demo-isolation sees 0 xtech engagements (got ${isoLeak})`);

  // pipeline overview reachable.
  const pipe = await call('/api/delivery/pipeline', OP);
  ok(pipe.status === 200 && typeof pipe.body?.byStage === 'object', 'pipeline overview 200 with byStage KPIs');
} catch (e) {
  console.error('  ✗ smoke threw:', e?.stack ?? e?.message ?? e);
  failed++;
} finally {
  await cleanup();
  let residue = 0;
  const xo3 = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
  await xo3.connect();
  await xo3.query("SELECT set_config('app.bypass_rls','on',false)");
  residue += Number((await xo3.query(`SELECT count(*)::int n FROM "Engagement" WHERE code LIKE $1`, [`${PREFIX}%`])).rows[0].n);
  await xo3.end();

  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query("SELECT set_config('app.bypass_rls','on',false)");
  for (const t of ['TenantLaunch', 'OrgUnit', 'PersonProfile', 'Membership', 'BackupJob', 'AuditLog', 'Tenant']) {
    const col = t === 'TenantLaunch' ? 'targetTenantId' : t === 'Tenant' ? 'id' : 'tenantId';
    residue += Number((await c.query(`SELECT count(*)::int n FROM "${t}" WHERE "${col}"=$1`, [TARGET])).rows[0].n);
  }
  await c.end();
  ok(residue === 0, `0 residue after cleanup (got ${residue})`);
}

console.log(failed === 0 ? '\nDELIVERY SMOKE PASSED' : `\nDELIVERY SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
