// Blueprint & Seed Pack catalog smoke (test:catalog) — SaaS step 4 / E5.
// Server up on :4000. Catalog seeded first (test:catalog chains the seed).
// FULLY SELF-CLEANING (throwaway tenant + test catalog rows removed).
//
// Proves:
//   A. catalog present: BP-BASE-ENTERPRISE / BP-TECH-001 / SP-XTECH-OPS published (immutable).
//   B. apply via Launch Factory: launch with blueprintId+seedPackId → run → COMPLETED;
//      apps enabled + baseline seed data present on the throwaway tenant; idempotent re-run.
//   C. secret guard: publishing a seed pack with a `password` field → 400 MUST_NOT_LEAK.
//   D. immutability: PATCH a PUBLISHED blueprint → 400 (create a new version instead).
//   E. enforcement: a non-PLT_BLUEPRINT_MANAGER publish → 403; PLT_BLUEPRINT_MANAGER → 200.
// Run: node scripts/catalog-smoke.mjs
import 'dotenv/config';
import pg from 'pg';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const TARGET = 'tenant-catalog-test'; // throwaway
const TEST_BP = 'BP-CATALOG-TEST';
const TEST_SP = 'SP-CATALOG-TEST';
const TEST_SP_GUARD = 'SP-CATALOG-GUARD-TEST';
const H = (user, extra = {}) => ({ 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': user, ...extra });
const ENFORCE = { 'x-authz-enforce': 'true' };
const OP = H('user-nam'); // tenant PLATFORM_ADMIN=['*'] — happy path (no enforce)
const BP_MGR = H('usr-plt-blueprint', ENFORCE); // PLT_BLUEPRINT_MANAGER
const TENANT_ONLY = H('user-huyvu', ENFORCE); // tenant role, no platform perm

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const call = async (path, headers, opts = {}) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const post = (p, h, b) => call(p, h, { method: 'POST', body: b ? JSON.stringify(b) : undefined });

console.log('Catalog smoke @ ' + BASE);
const createdLaunchIds = [];

async function cleanup() {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  for (const id of createdLaunchIds) {
    await c.query(`DELETE FROM "TenantLaunchStep" WHERE "launchId"=$1`, [id]).catch(() => {});
    await c.query(`DELETE FROM "TenantLaunch" WHERE id=$1`, [id]).catch(() => {});
  }
  for (const t of ['AuditLog', 'Membership', 'OrgUnit', 'PersonProfile', 'PositionAssignment', 'TenantApplicationInstance', 'AppAccountBinding', 'ProvisioningCommand', 'RestoreJob', 'BackupJob']) {
    await c.query(`DELETE FROM "${t}" WHERE "tenantId"=$1`, [TARGET]).catch(() => {});
  }
  await c.query(`DELETE FROM "Tenant" WHERE id=$1`, [TARGET]).catch(() => {});
  await c.query(`DELETE FROM "Blueprint" WHERE code=$1`, [TEST_BP]).catch(() => {});
  await c.query(`DELETE FROM "SeedPack" WHERE code=ANY($1)`, [[TEST_SP, TEST_SP_GUARD]]).catch(() => {});
  await c.query('COMMIT').catch(() => {});
  await c.end();
  try { rmSync(join(process.cwd(), 'storage', 'backups', TARGET), { recursive: true, force: true }); } catch {}
}

try {
  await cleanup();
  createdLaunchIds.length = 0;

  // ---- A. catalog present (published, immutable) ---------------------------
  const bps = await call('/api/platform/blueprints', OP);
  ok(bps.status === 200 && Array.isArray(bps.body), `GET /blueprints → 200 array (got ${bps.status})`);
  const bpCodes = (bps.body ?? []).map((b) => b.code);
  ok(['BP-BASE-ENTERPRISE', 'BP-TECH-001', 'BP-RE-002'].every((c) => bpCodes.includes(c)), 'catalog has BP-BASE-ENTERPRISE + BP-TECH-001 + BP-RE-002');
  const base = (bps.body ?? []).find((b) => b.code === 'BP-BASE-ENTERPRISE');
  ok(base?.status === 'PUBLISHED' && !!base?.checksum, `BP-BASE-ENTERPRISE PUBLISHED with checksum`);
  const sps = await call('/api/platform/seed-packs', OP);
  const spCodes = (sps.body ?? []).map((p) => p.code);
  ok(['SP-BASE-ORG', 'SP-XTECH-OPS'].every((c) => spCodes.includes(c)), 'catalog has SP-BASE-ORG + SP-XTECH-OPS');
  const xtechOps = (sps.body ?? []).find((p) => p.code === 'SP-XTECH-OPS');
  ok(xtechOps?.status === 'PUBLISHED', 'SP-XTECH-OPS PUBLISHED');

  // ---- B. apply via Launch Factory -----------------------------------------
  const created = await post('/api/platform/launches', OP, { targetTenantId: TARGET, name: 'Catalog Apply Test', tenantKey: 'catalog-test', blueprintId: 'BP-BASE-ENTERPRISE', seedPackId: 'SP-BASE-ORG' });
  const launchId = created.body?.id;
  if (launchId) createdLaunchIds.push(launchId);
  ok(!!launchId, 'launch created with blueprintId+seedPackId');
  const ran = await post(`/api/platform/launches/${launchId}/run`, OP);
  ok(ran.body?.status === 'COMPLETED', `run → COMPLETED (got ${ran.body?.status})`);
  const steps = Object.fromEntries((ran.body?.steps ?? []).map((s) => [s.stepKey, s]));
  ok(steps['apply-blueprint']?.result?.blueprintCode === 'BP-BASE-ENTERPRISE', `apply-blueprint applied BP-BASE-ENTERPRISE (got ${steps['apply-blueprint']?.result?.blueprintCode})`);
  ok((steps['apply-blueprint']?.result?.appsEnabled ?? []).includes('x1'), 'apply-blueprint enabled app x1');
  ok(steps['load-seed-pack']?.result?.seedPackCode === 'SP-BASE-ORG', `load-seed-pack applied SP-BASE-ORG (got ${steps['load-seed-pack']?.result?.seedPackCode})`);

  // direct DB proof: app enabled + baseline seed org present
  const dbc = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await dbc.connect();
  await dbc.query("SELECT set_config('app.bypass_rls','on',false)");
  const appEnabled = Number((await dbc.query(`SELECT count(*)::int n FROM "TenantApplicationInstance" WHERE "tenantId"=$1 AND "applicationCode"='x1' AND status='enabled'`, [TARGET])).rows[0].n);
  ok(appEnabled === 1, `app x1 enabled for target (got ${appEnabled})`);
  const seedOrg = Number((await dbc.query(`SELECT count(*)::int n FROM "OrgUnit" WHERE id=$1`, [`${TARGET}:seed-org-sales`])).rows[0].n);
  ok(seedOrg === 1, `SP-BASE-ORG baseline org present (got ${seedOrg})`);

  // idempotent re-run
  const rerun = await post(`/api/platform/launches/${launchId}/run`, OP);
  ok(rerun.body?.status === 'COMPLETED' && (rerun.body?.steps ?? []).every((s) => s.attempts === 1), 'idempotent re-run: attempts still 1');
  const seedOrg2 = Number((await dbc.query(`SELECT count(*)::int n FROM "OrgUnit" WHERE id=$1`, [`${TARGET}:seed-org-sales`])).rows[0].n);
  ok(seedOrg2 === 1, `idempotent apply: still exactly 1 baseline org (got ${seedOrg2})`);
  await dbc.end();

  // ---- C. secret guard on publish ------------------------------------------
  const draftSecret = await post('/api/platform/seed-packs', OP, { code: TEST_SP_GUARD, name: 'Secret Test', datasets: [{ model: 'orgUnit', rows: [{ id: 'x', password: 'hunter2' }] }] });
  ok(draftSecret.body?.status === 'DRAFT', 'created DRAFT seed pack with a secret field');
  const pubSecret = await post(`/api/platform/seed-packs/${draftSecret.body?.id}/publish`, OP);
  ok(pubSecret.status === 400 && /MUST_NOT_LEAK/i.test(JSON.stringify(pubSecret.body)), `secret guard: publish rejected 400 MUST_NOT_LEAK (got ${pubSecret.status})`);

  // ---- D. immutability -----------------------------------------------------
  const draftBp = await post('/api/platform/blueprints', OP, { code: TEST_BP, name: 'Catalog Test BP', appsEnabled: ['x1'] });
  ok(draftBp.body?.status === 'DRAFT', 'created DRAFT blueprint');
  const pubBp = await post(`/api/platform/blueprints/${draftBp.body?.id}/publish`, OP);
  ok(pubBp.body?.status === 'PUBLISHED', `published blueprint (got ${pubBp.body?.status})`);
  const mutate = await call(`/api/platform/blueprints/${draftBp.body?.id}`, OP, { method: 'PATCH', body: JSON.stringify({ name: 'hacked' }) });
  ok(mutate.status === 400 && /immutable/i.test(JSON.stringify(mutate.body)), `immutability: PATCH published blueprint → 400 (got ${mutate.status})`);

  // ---- E. enforcement ------------------------------------------------------
  const draftBp2 = await post('/api/platform/blueprints', OP, { code: TEST_BP, version: 2, name: 'Catalog Test BP v2', appsEnabled: ['x1'] });
  const denied = await post(`/api/platform/blueprints/${draftBp2.body?.id}/publish`, TENANT_ONLY);
  ok(denied.status === 403, `enforcement: non-blueprint-manager publish → 403 (got ${denied.status})`);
  const allowed = await post(`/api/platform/blueprints/${draftBp2.body?.id}/publish`, BP_MGR);
  ok(allowed.status === 200 || allowed.status === 201, `enforcement: PLT_BLUEPRINT_MANAGER publish → OK (got ${allowed.status})`);
  ok(allowed.body?.status === 'PUBLISHED', 'PLT_BLUEPRINT_MANAGER publish set PUBLISHED');
} catch (e) {
  console.error('  ✗ smoke threw:', e?.message ?? e);
  failed++;
} finally {
  await cleanup();
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query("SELECT set_config('app.bypass_rls','on',false)");
  let residue = 0;
  for (const [t, col] of [['TenantLaunch', 'targetTenantId'], ['OrgUnit', 'tenantId'], ['TenantApplicationInstance', 'tenantId'], ['BackupJob', 'tenantId'], ['Tenant', 'id']]) {
    residue += Number((await c.query(`SELECT count(*)::int n FROM "${t}" WHERE "${col}"=$1`, [TARGET])).rows[0].n);
  }
  residue += Number((await c.query(`SELECT count(*)::int n FROM "Blueprint" WHERE code=$1`, [TEST_BP])).rows[0].n);
  residue += Number((await c.query(`SELECT count(*)::int n FROM "SeedPack" WHERE code=ANY($1)`, [[TEST_SP, TEST_SP_GUARD]])).rows[0].n);
  await c.end();
  ok(residue === 0, `0 residue after cleanup (got ${residue})`);
}

console.log(failed === 0 ? '\nCATALOG SMOKE PASSED' : `\nCATALOG SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
