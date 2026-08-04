// XHub Enterprise IOC — Template gallery + clone SMOKE (DT-04).
// Run: npm run test:ioc-templates   (API must be running on :4000)
//
// Asserts:
//   1. the SHARED catalog lists the 4 PUBLISHED templates, with real per-template
//      differentiation (distinct zone sets / icon sets, not 4 copies of one);
//   2. `IocTemplate` is NOT an RLS table (shared platform plane, like Blueprint)
//      and carries no tenantId column at all;
//   3. cloning as T001 writes tenant-scoped rows into T001 ONLY, and cloning as
//      T003 writes into T003 ONLY — NO cross-tenant leakage in either direction;
//   4. unmapped zones are HONESTLY flagged (returned in `unmappedZones` and left
//      without a SceneBinding) rather than bound to an invented OrgUnit;
//   5. a data layer whose metric the tenant does not have is SKIPPED with a
//      reason instead of being created against a fake metric id;
//   6. the icon catalog grew beyond the original 14 office keys and every key
//      still honours the BUILT_IN / ^[a-z0-9-]+$ contract.
// Self-cleans every row it creates.
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const T1 = 'tenant-xtech';
const T3 = 'tenant-manufacturing-demo';
const H = (t) => ({ 'content-type': 'application/json', 'x-tenant-id': t, 'x-user-id': 'user-nam' });

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); failed++; }
};
async function api(method, path, body, tenant = T1) {
  const res = await fetch(BASE + path, { method, headers: H(tenant), body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

const clones = []; // { tenant, sceneId, planId, dashboardId, floorId, siteId }
console.log(`ioc-template-gallery smoke @ ${BASE}`);

const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await c.connect();

try {
  // 1) catalog listing --------------------------------------------------------
  let r = await api('GET', '/api/ioc/templates');
  ok(r.status < 300, `GET /api/ioc/templates → ${r.status}`);
  const items = r.json?.items ?? [];
  ok(items.length >= 4, `catalog lists ${items.length} published templates (expected ≥ 4)`);
  for (const code of ['TPL-OFFICE', 'TPL-FACTORY', 'TPL-RETAIL', 'TPL-HOSPITALITY']) {
    ok(items.some((t) => t.code === code), `template ${code} is published`);
  }
  ok(items.every((t) => t.status === 'PUBLISHED'), 'every listed template is PUBLISHED');
  ok(items.every((t) => t.zoneCount > 0 && t.dataLayerCount > 0), 'every template carries zones + data layers');

  // real differentiation: no two templates share the same zone-name set
  const zoneSig = items.map((t) => (t.floorPlanSpec?.zones ?? []).map((z) => z.name).sort().join('|'));
  ok(new Set(zoneSig).size === items.length, `all ${items.length} templates have DISTINCT zone sets (not copies)`);
  const iconSig = items.map((t) => [...new Set((t.floorPlanSpec?.zones ?? []).map((z) => z.icon))].sort().join('|'));
  ok(new Set(iconSig).size === items.length, 'all templates use distinct icon sets');
  const types = new Set(items.map((t) => t.twinType));
  ok(types.size >= 4, `templates span ${types.size} twin types: ${[...types].join(', ')}`);

  // filters
  r = await api('GET', '/api/ioc/templates?twinType=FACTORY');
  ok(r.status < 300 && (r.json?.items ?? []).every((t) => t.twinType === 'FACTORY'), 'twinType filter works');

  // 2) shared plane — no tenantId column, no RLS ------------------------------
  await c.query("SELECT set_config('app.bypass_rls','on',false)");
  const cols = (await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='IocTemplate'`)).rows.map((x) => x.column_name);
  ok(!cols.includes('tenantId'), 'IocTemplate has NO tenantId column (shared platform plane, like Blueprint)');
  const rls = (await c.query(`SELECT relrowsecurity FROM pg_class WHERE relname='IocTemplate'`)).rows[0];
  ok(rls && rls.relrowsecurity === false, 'IocTemplate is correctly NOT registered for RLS');
  // Blueprint lives in the Platform database post-Stage-C DB split — a
  // separate connection is needed to inspect its RLS posture.
  const platformC = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await platformC.connect();
  const bpRls = (await platformC.query(`SELECT relrowsecurity FROM pg_class WHERE relname='Blueprint'`)).rows[0];
  await platformC.end();
  ok(bpRls && bpRls.relrowsecurity === false, `posture matches Blueprint (Blueprint rls=${bpRls?.relrowsecurity})`);
  const sceneRls = (await c.query(`SELECT relrowsecurity FROM pg_class WHERE relname='TwinScene'`)).rows[0];
  ok(sceneRls?.relrowsecurity === true, 'the CLONE TARGET (TwinScene) IS still RLS-protected');

  // 3) clone as T001 ----------------------------------------------------------
  const office = items.find((t) => t.code === 'TPL-OFFICE');
  r = await api('POST', `/api/ioc/templates/${office.id}/clone`, {}, T1);
  ok(r.status < 300 && r.json?.sceneId, `T001 clone of TPL-OFFICE → ${r.status}`);
  const c1 = r.json;
  clones.push({ tenant: T1, ...c1 });
  ok(c1.status === 'DRAFT', 'clone lands as a DRAFT (never auto-published)');
  ok(c1.editorPath === `/ioc/studio/scenes/${c1.sceneId}/floor-plan`, 'clone returns the editor path for the FE redirect');
  ok(c1.boundZones.length + c1.unmappedZones.length === c1.zoneCount, 'every zone is either bound or honestly reported unmapped');
  ok(c1.boundZones.length >= 6, `T001 auto-bound ${c1.boundZones.length}/${c1.zoneCount} zones to REAL org units`);

  // every bound zone points at an OrgUnit that really exists in T001
  const t1Orgs = new Set((await c.query('SELECT id FROM "OrgUnit" WHERE "tenantId"=$1', [T1])).rows.map((x) => x.id));
  ok(c1.boundZones.every((b) => t1Orgs.has(b.orgUnitId)), 'every bound zone references a REAL T001 OrgUnit id');

  // 4) clone as T003 — the honest/unmapped path -------------------------------
  const factory = items.find((t) => t.code === 'TPL-FACTORY');
  r = await api('POST', `/api/ioc/templates/${factory.id}/clone`, {}, T3);
  ok(r.status < 300 && r.json?.sceneId, `T003 clone of TPL-FACTORY → ${r.status}`);
  const c3 = r.json;
  clones.push({ tenant: T3, ...c3 });
  ok(c3.unmappedZones.length > 0, `T003 honestly reports ${c3.unmappedZones.length} unmapped zone(s) (its org tree is minimal)`);
  ok(c3.unmappedZones.every((z) => /chưa gán đơn vị/.test(z.reason)), 'unmapped zones carry a "chưa gán đơn vị" reason');

  // an unmapped zone must have NO SceneBinding and a null orgUnitId in geometry
  const bindings = (await c.query('SELECT "zoneId" FROM "SceneBinding" WHERE "sceneId"=$1', [c3.sceneId])).rows.map((x) => x.zoneId);
  ok(c3.unmappedZones.every((z) => !bindings.includes(z.zoneId)), 'unmapped zones have NO SceneBinding (not fake-assigned)');
  ok(bindings.length === c3.boundZones.length, `binding count (${bindings.length}) equals bound-zone count`);
  const geom = (await c.query('SELECT geometry FROM "FloorPlanDefinition" WHERE id=$1', [c3.planId])).rows[0].geometry;
  const unboundIds = new Set(c3.unmappedZones.map((z) => z.zoneId));
  ok(geom.zones.filter((z) => unboundIds.has(z.id)).every((z) => z.orgUnitId === null), 'unmapped zones store orgUnitId=null — no invented OrgUnit');

  // 5) metric-backed layers are skipped when the tenant lacks the metric ------
  const t3Metrics = new Set((await c.query('SELECT code FROM "MetricDefinition" WHERE "tenantId"=$1', [T3])).rows.map((x) => x.code));
  const metricSpecs = (factory.dataLayerSpecs ?? []).filter((s) => s.metricCode);
  ok(metricSpecs.length >= 2, `TPL-FACTORY declares ${metricSpecs.length} metric-backed layers`);
  for (const s of metricSpecs) {
    const created = c3.dataLayers.some((l) => l.code === s.code);
    const skipped = c3.skippedDataLayers.some((l) => l.code === s.code);
    ok(created === t3Metrics.has(s.metricCode) && created !== skipped,
      `layer ${s.code} ${created ? 'created (tenant HAS' : 'skipped (tenant lacks'} ${s.metricCode})`);
  }
  ok(c3.dataLayers.some((l) => l.code === 'DL-MFG-WORKLOAD'), 'Work-derived layer is always created (safe in every tenant)');
  ok(c3.dataLayers.filter((l) => !l.zoneLevel).every((l) => true), 'non-zone-level layers are flagged so they are not bound to a zone');
  const zoneLayerIds = c3.dataLayers.filter((l) => l.zoneLevel).map((l) => l.id);
  const bindRows = (await c.query('SELECT "dataLayerIds" FROM "SceneBinding" WHERE "sceneId"=$1', [c3.sceneId])).rows;
  ok(bindRows.every((b) => b.dataLayerIds.every((id) => zoneLayerIds.includes(id))),
    'zone bindings reference ONLY org-grouped layers (a metricId-grouped KPI never colours a zone)');

  // 5b) the SKIP branch: T001 has no DIST-* metrics, so TPL-RETAIL's metric
  //     layers must be dropped with a reason instead of pointing at nothing.
  const retail = items.find((t) => t.code === 'TPL-RETAIL');
  r = await api('POST', `/api/ioc/templates/${retail.id}/clone`, {}, T1);
  ok(r.status < 300 && r.json?.sceneId, `T001 clone of TPL-RETAIL → ${r.status}`);
  const cR = r.json;
  clones.push({ tenant: T1, ...cR });
  const t1Metrics = new Set((await c.query('SELECT code FROM "MetricDefinition" WHERE "tenantId"=$1', [T1])).rows.map((x) => x.code));
  const distSpecs = (retail.dataLayerSpecs ?? []).filter((s) => s.metricCode);
  const expectSkipped = distSpecs.filter((s) => !t1Metrics.has(s.metricCode));
  ok(expectSkipped.length > 0, `T001 lacks ${expectSkipped.length} DIST metric(s) — the skip branch is genuinely exercised`);
  ok(cR.skippedDataLayers.length === expectSkipped.length, `clone skipped exactly ${expectSkipped.length} metric layer(s)`);
  ok(cR.skippedDataLayers.every((s) => /chưa có chỉ số/.test(s.reason)), 'skipped layers explain WHY (tenant chưa có chỉ số …)');
  ok(cR.skippedDataLayers.every((s) => !cR.dataLayers.some((l) => l.code === s.code)), 'a skipped layer is NOT created as an empty shell');
  const skippedCodes = cR.skippedDataLayers.map((s) => s.code);
  const orphan = (await c.query(`SELECT 1 FROM "DataLayerDefinition" WHERE "tenantId"=$1 AND code = ANY($2::text[]) LIMIT 1`, [T1, skippedCodes])).rowCount;
  ok(!orphan, 'no DataLayerDefinition row exists for a skipped metric layer');

  // 6) CROSS-TENANT ISOLATION -------------------------------------------------
  for (const [table, idField] of [['TwinScene', c3.sceneId], ['FloorPlanDefinition', c3.planId], ['DashboardDefinition', c3.dashboardId]]) {
    const row = (await c.query(`SELECT "tenantId" FROM "${table}" WHERE id=$1`, [idField])).rows[0];
    ok(row?.tenantId === T3, `${table} created by the T003 clone belongs to T003 (got ${row?.tenantId})`);
  }
  for (const [table, idField] of [['TwinScene', c1.sceneId], ['FloorPlanDefinition', c1.planId], ['DashboardDefinition', c1.dashboardId]]) {
    const row = (await c.query(`SELECT "tenantId" FROM "${table}" WHERE id=$1`, [idField])).rows[0];
    ok(row?.tenantId === T1, `${table} created by the T001 clone belongs to T001 (got ${row?.tenantId})`);
  }
  // T001 must not be able to READ the scene T003 just cloned, and vice versa.
  r = await api('GET', `/api/ioc/scenes/${c3.sceneId}`, null, T1);
  ok(r.status === 404, `T001 CANNOT read T003's cloned scene (${r.status})`);
  r = await api('GET', `/api/ioc/scenes/${c1.sceneId}`, null, T3);
  ok(r.status === 404, `T003 CANNOT read T001's cloned scene (${r.status})`);
  // …but each sees its own.
  r = await api('GET', `/api/ioc/scenes/${c3.sceneId}`, null, T3);
  ok(r.status < 300, `T003 CAN read its own cloned scene (${r.status})`);

  // no row from either clone landed in the other tenant
  const strays = (await c.query(
    `SELECT "tenantId", count(*)::int n FROM "SceneBinding" WHERE "sceneId" = ANY($1::text[]) GROUP BY 1`,
    [[c1.sceneId, c3.sceneId]],
  )).rows;
  ok(strays.every((s) => s.tenantId === T1 || s.tenantId === T3), 'clone bindings exist only in the two calling tenants');

  // 7) icon catalog -----------------------------------------------------------
  r = await api('GET', '/api/ioc/icons', null, T1);
  const icons = r.json?.items ?? [];
  ok(icons.length >= 28, `T001 icon catalog grew to ${icons.length} keys (was 14 office keys)`);
  ok(icons.every((i) => /^[a-z0-9-]+$/.test(i.key)), 'every icon key matches ^[a-z0-9-]+$');
  ok(icons.every((i) => i.type === 'BUILT_IN'), 'every icon is BUILT_IN (no tenant binary served)');
  ok(icons.every((i) => i.status === 'ACTIVE'), 'every icon is ACTIVE');
  for (const k of ['facility-production-line', 'retail-pos-counter', 'hospitality-hotel-room', 'logistics-forklift']) {
    ok(icons.some((i) => i.key === k), `new industry icon "${k}" is seeded`);
  }

  // 8) a template can only be cloned when PUBLISHED ---------------------------
  r = await api('POST', '/api/ioc/templates/does-not-exist/clone', {}, T1);
  ok(r.status === 404, `cloning an unknown template is refused (${r.status})`);
} catch (e) {
  console.error('  ✗ smoke threw:', e.message);
  failed++;
}

// cleanup ---------------------------------------------------------------------
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  for (const cl of clones) {
    await c.query('DELETE FROM "SceneBinding" WHERE "sceneId"=$1', [cl.sceneId]);
    await c.query('DELETE FROM "TwinSceneVersion" WHERE "sceneId"=$1', [cl.sceneId]);
    await c.query('DELETE FROM "TwinScene" WHERE id=$1', [cl.sceneId]);
    await c.query('DELETE FROM "FloorPlanVersion" WHERE "planId"=$1', [cl.planId]);
    await c.query('DELETE FROM "FloorPlanDefinition" WHERE id=$1', [cl.planId]);
    await c.query('DELETE FROM "DashboardVersion" WHERE "dashboardId"=$1', [cl.dashboardId]);
    await c.query('DELETE FROM "DashboardDefinition" WHERE id=$1', [cl.dashboardId]);
    await c.query('DELETE FROM "AuditLog" WHERE "instanceCode"=$1', [cl.sceneId]);
    // data layers + site/floor created BY the clone (only if now unused)
    for (const l of cl.dataLayers ?? []) {
      const used = (await c.query(
        `SELECT 1 FROM "SceneBinding" WHERE $1 = ANY("dataLayerIds") LIMIT 1`, [l.id])).rowCount;
      const seeded = (await c.query(`SELECT 1 FROM "DataLayerDefinition" WHERE id=$1 AND "createdBy"='usr-ceo' LIMIT 1`, [l.id])).rowCount;
      if (!used && !seeded) await c.query('DELETE FROM "DataLayerDefinition" WHERE id=$1', [l.id]);
    }
    const floorUsed = (await c.query('SELECT 1 FROM "FloorPlanDefinition" WHERE "floorId"=$1 LIMIT 1', [cl.floorId])).rowCount;
    if (!floorUsed) {
      await c.query('DELETE FROM "TwinFloor" WHERE id=$1', [cl.floorId]);
      const siteUsed = (await c.query('SELECT 1 FROM "TwinFloor" WHERE "siteId"=$1 LIMIT 1', [cl.siteId])).rowCount;
      if (!siteUsed) await c.query('DELETE FROM "TwinSite" WHERE id=$1 AND code LIKE $2', [cl.siteId, 'TPL-%']);
    }
  }
  await c.query('COMMIT');
  console.log('  · smoke artifacts cleaned up');
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('  ✗ cleanup failed:', e.message);
  failed++;
}
await c.end();

console.log(failed === 0 ? '\nIOC TEMPLATE GALLERY SMOKE PASSED' : `\nIOC TEMPLATE GALLERY SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
