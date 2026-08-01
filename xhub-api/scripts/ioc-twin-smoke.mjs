// XHub Enterprise IOC — Twin Studio SMOKE (DT-01 + DT-02 acceptance).
// Proves the reference slice END-TO-END against the running API, then self-cleans.
// Run: npm run test:ioc-twin
//
// Asserts (data/ACCEPTANCE_TESTS.csv):
//   AT-004  invalid / self-intersecting / degenerate zone geometry is REJECTED
//   AT-002  a published version is IMMUTABLE (byte-identical payload + checksum
//           after a further publish; no mutation endpoint exists)
//   AT-003  rollback re-activates an older version WITHOUT deleting anything
//   AT-001  a second tenant sees NONE of tenant A's IOC config
//   AT-010  the SYSTEM-ISOLATION MUST_NOT_LEAK markers never appear for T001
// Plus: the org binding is validated against the REAL tenant OrgUnit set, the
// runtime read only ever returns a PUBLISHED version, and publish/rollback are
// written to the audit log.
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const TENANT = 'tenant-xtech';
const OTHER = 'tenant-demo-isolation';
const H = (t = TENANT) => ({ 'content-type': 'application/json', 'x-tenant-id': t, 'x-user-id': 'user-nam' });
const MARK = `IOC-SMOKE-${Date.now()}`;

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); failed++; }
};
async function api(method, path, body, tenant = TENANT) {
  const res = await fetch(BASE + path, { method, headers: H(tenant), body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

const created = { siteId: null, floorId: null, planId: null, sceneId: null };
console.log(`ioc-twin smoke @ ${BASE} (mark=${MARK})`);

try {
  // 0) real org units (the binding target must be a REAL entity) ---------------
  let r = await api('GET', '/api/identity/org-units');
  const orgUnits = r.json?.items ?? r.json?.orgUnits ?? (Array.isArray(r.json) ? r.json : []);
  ok(Array.isArray(orgUnits) && orgUnits.length >= 2, `identity exposes ${orgUnits.length} org units for binding`);
  const orgA = orgUnits[0];
  const orgB = orgUnits[1];

  // 1) site + floor -----------------------------------------------------------
  r = await api('POST', '/api/ioc/sites', { code: `${MARK}-SITE`, name: 'IOC smoke site' });
  ok(r.status < 300 && r.json?.id, `site created (${r.status})`);
  created.siteId = r.json?.id;

  r = await api('POST', '/api/ioc/sites/floors', { siteId: created.siteId, code: `${MARK}-F1`, name: 'Tầng thử', level: 1 });
  ok(r.status < 300 && r.json?.id, `floor created (${r.status})`);
  created.floorId = r.json?.id;

  // 2) AT-004 geometry validation --------------------------------------------
  const bowtie = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }]; // self-intersecting
  r = await api('POST', '/api/ioc/floor-plans', {
    floorId: created.floorId, name: 'bad', geometry: { walls: [], zones: [{ id: 'z1', name: 'bad', kind: 'DEPARTMENT', polygon: bowtie }] },
  });
  ok(r.status === 400 && /self-intersecting/i.test(JSON.stringify(r.json)), `AT-004: self-intersecting polygon REJECTED (${r.status})`);

  r = await api('POST', '/api/ioc/floor-plans', {
    floorId: created.floorId, name: 'bad', geometry: { walls: [], zones: [{ id: 'z1', name: 'bad', kind: 'DEPARTMENT', polygon: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }] },
  });
  ok(r.status === 400, `AT-004: polygon with < 3 points REJECTED (${r.status})`);

  r = await api('POST', '/api/ioc/floor-plans', {
    floorId: created.floorId, name: 'bad', geometry: { walls: [], zones: [{ id: 'z1', name: 'bad', kind: 'DEPARTMENT', polygon: [{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 0.1, y: 0.1 }] }] },
  });
  ok(r.status === 400 && /degenerate/i.test(JSON.stringify(r.json)), `AT-004: degenerate (near-zero-area) polygon REJECTED (${r.status})`);

  r = await api('POST', '/api/ioc/floor-plans', {
    floorId: created.floorId, name: 'bad', geometry: { walls: [], zones: [
      { id: 'dup', name: 'a', kind: 'DEPARTMENT', polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }] },
      { id: 'dup', name: 'b', kind: 'DEPARTMENT', polygon: [{ x: 6, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 5 }] },
    ] },
  });
  ok(r.status === 400 && /duplicate zone id/i.test(JSON.stringify(r.json)), `AT-004: duplicate zone id REJECTED (${r.status})`);

  // 3) valid plan -------------------------------------------------------------
  const goodGeometry = {
    walls: [{ id: 'w1', points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }], height: 3, thickness: 0.2 }],
    zones: [
      { id: 'za', name: 'Vùng A', kind: 'DEPARTMENT', polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] },
      { id: 'zb', name: 'Vùng B', kind: 'DEPARTMENT', polygon: [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 10 }] },
    ],
  };
  r = await api('POST', '/api/ioc/floor-plans', { floorId: created.floorId, name: 'Mặt bằng thử', metersPerUnit: 1, geometry: goodGeometry });
  ok(r.status < 300 && r.json?.id, `valid plan created (${r.status})`);
  created.planId = r.json?.id;
  ok(r.json?.unit === 'METER', 'plan geometry unit is METER (coordinates in meters)');

  // optimistic concurrency
  r = await api('PATCH', `/api/ioc/floor-plans/${created.planId}`, { revision: 99, name: 'x' });
  ok(r.status === 409, `stale revision on autosave REJECTED with 409 (${r.status})`);

  // 4) publish plan v1, AT-002 immutability ----------------------------------
  r = await api('POST', `/api/ioc/floor-plans/${created.planId}/publish`, { note: 'v1' });
  ok(r.status < 300 && r.json?.versionNo === 1 && r.json?.checksum, `plan published v1 with checksum (${r.status})`);
  const planV1Checksum = r.json?.checksum;

  // edit the DRAFT then publish again — v1 must be untouched
  r = await api('PATCH', `/api/ioc/floor-plans/${created.planId}`, {
    geometry: { ...goodGeometry, zones: [...goodGeometry.zones, { id: 'zc', name: 'Vùng C', kind: 'COMMON', polygon: [{ x: 0, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 16 }, { x: 0, y: 16 }] }] },
  });
  ok(r.status < 300, `draft edited after publish (${r.status})`);
  r = await api('POST', `/api/ioc/floor-plans/${created.planId}/publish`, { note: 'v2' });
  ok(r.json?.versionNo === 2, `re-publish creates v2, not a mutation of v1 (got v${r.json?.versionNo})`);

  r = await api('GET', `/api/ioc/floor-plans/${created.planId}/versions`);
  const versions = r.json?.items ?? [];
  const v1 = versions.find((v) => v.versionNo === 1);
  const v2 = versions.find((v) => v.versionNo === 2);
  ok(versions.length === 2, `both versions retained (got ${versions.length})`);
  ok(v1?.checksum === planV1Checksum, 'AT-002: v1 checksum unchanged after v2 was published (payload immutable)');
  ok(v1?.status === 'SUPERSEDED' && v2?.status === 'PUBLISHED', 'AT-002: v1 SUPERSEDED, v2 PUBLISHED — history preserved');
  ok((v1?.payload?.zones ?? []).length === 2 && (v2?.payload?.zones ?? []).length === 3, 'AT-002: v1 still holds the OLD geometry (2 zones), v2 the new (3 zones)');

  // there is no update/delete endpoint on a version — prove the route 404s
  r = await api('PATCH', `/api/ioc/floor-plans/${created.planId}/versions/1`, { payload: {} });
  ok(r.status === 404, `AT-002: no mutation endpoint exists for a published version (${r.status})`);

  // 5) AT-003 rollback --------------------------------------------------------
  r = await api('POST', `/api/ioc/floor-plans/${created.planId}/rollback`, { versionNo: 1 });
  ok(r.status < 300 && r.json?.activeVersionNo === 1, `AT-003: rolled back to v1 (${r.status})`);
  ok(r.json?.versionCount === 2 && r.json?.deleted === 0, 'AT-003: rollback deleted nothing (2 versions still present)');
  // roll forward again so the scene can pin the newest plan
  await api('POST', `/api/ioc/floor-plans/${created.planId}/rollback`, { versionNo: 2 });

  // 6) scene + org binding ----------------------------------------------------
  r = await api('POST', '/api/ioc/scenes', { name: `${MARK} scene`, planId: created.planId });
  ok(r.status < 300 && r.json?.id, `scene created (${r.status})`);
  created.sceneId = r.json?.id;

  r = await api('POST', `/api/ioc/scenes/${created.sceneId}/bindings`, { zoneId: 'nope', bindingType: 'ORG_UNIT', bindingId: orgA?.id });
  ok(r.status === 400 && /does not exist in the plan geometry/i.test(JSON.stringify(r.json)), `binding to a non-existent zone REJECTED (${r.status})`);

  r = await api('POST', `/api/ioc/scenes/${created.sceneId}/bindings`, { zoneId: 'za', bindingType: 'ORG_UNIT', bindingId: 'org-does-not-exist' });
  ok(r.status === 400, `binding to a non-existent OrgUnit REJECTED (${r.status})`);

  r = await api('POST', `/api/ioc/scenes/${created.sceneId}/bindings`, { zoneId: 'za', bindingType: 'ORG_UNIT', bindingId: orgA?.id, iconKey: 'department-executive' });
  ok(r.status < 300, `zone za bound to REAL OrgUnit ${orgA?.code} (${r.status})`);
  r = await api('POST', `/api/ioc/scenes/${created.sceneId}/bindings`, { zoneId: 'zb', bindingType: 'ORG_UNIT', bindingId: orgB?.id, iconKey: 'department-sales' });
  ok(r.status < 300, `zone zb bound to REAL OrgUnit ${orgB?.code} (${r.status})`);

  // 7) runtime only serves PUBLISHED -----------------------------------------
  r = await api('GET', `/api/ioc/scenes/${created.sceneId}/runtime`);
  ok(r.status === 404, `runtime refuses an UNPUBLISHED scene (${r.status})`);

  r = await api('POST', `/api/ioc/scenes/${created.sceneId}/publish`, { note: 'v1' });
  ok(r.status < 300 && r.json?.versionNo === 1 && r.json?.checksum, `scene published v1 with checksum (${r.status})`);

  r = await api('GET', `/api/ioc/scenes/${created.sceneId}/runtime`);
  ok(r.status < 300 && Array.isArray(r.json?.zones), `runtime scene resolves (${r.status})`);
  const rtZones = r.json?.zones ?? [];
  ok(rtZones.length === 3, `runtime returns the published geometry (${rtZones.length} zones)`);
  const za = rtZones.find((z) => z.id === 'za');
  ok(za?.orgUnit?.id === orgA?.id, 'runtime resolves the bound OrgUnit LABEL from Identity (no hardcoded department name)');
  ok(typeof za?.areaSqM === 'number' && za.areaSqM > 0, `runtime computes zone area in m² (${za?.areaSqM})`);
  ok(r.json?.checksum && r.json?.versionNo === 1, 'runtime reports the immutable version + checksum it served');

  // 8) AT-001 cross-tenant isolation -----------------------------------------
  r = await api('GET', `/api/ioc/scenes/${created.sceneId}`, null, OTHER);
  ok(r.status === 404, `AT-001: other tenant cannot read the scene (${r.status})`);
  r = await api('GET', `/api/ioc/floor-plans/${created.planId}`, null, OTHER);
  ok(r.status === 404, `AT-001: other tenant cannot read the floor plan (${r.status})`);
  r = await api('GET', '/api/ioc/sites', null, OTHER);
  const otherSites = r.json?.items ?? [];
  ok(!otherSites.some((s) => s.id === created.siteId), 'AT-001: other tenant list does not contain tenant A sites');

  // 9) AT-010 SYSTEM-ISOLATION markers ---------------------------------------
  r = await api('GET', '/api/ioc/dashboards');
  const dashBlob = JSON.stringify(r.json ?? {});
  ok(!/MUST_NOT_LEAK/.test(dashBlob), 'AT-010: MUST_NOT_LEAK marker absent from T001 dashboard list');
  r = await api('GET', '/api/ioc/data-layers');
  ok(!/MUST_NOT_LEAK/.test(JSON.stringify(r.json ?? {})), 'AT-010: MUST_NOT_LEAK marker absent from T001 data layers');
  r = await api('GET', '/api/ioc/sites');
  ok(!/MUST_NOT_LEAK/.test(JSON.stringify(r.json ?? {})), 'AT-010: MUST_NOT_LEAK marker absent from T001 sites');

  // 10) the seeded reference slice is live -----------------------------------
  r = await api('GET', '/api/ioc/runtime/dashboards/DASH-OFFICE');
  ok(r.status < 300 && r.json?.dashboard?.viewType === 'OFFICE_TWIN', `seeded Office Twin dashboard resolves (${r.status})`);
  ok((r.json?.scene?.zones ?? []).length === 8, `seeded scene serves 8 department zones (got ${(r.json?.scene?.zones ?? []).length})`);
  ok(Object.keys(r.json?.dataLayers ?? {}).length >= 3, 'seeded dashboard resolves its 3 data layers');

  // 11) publish/rollback are audited -----------------------------------------
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query("SELECT set_config('app.bypass_rls','on',false)");
  const audits = (await c.query(
    `SELECT action FROM "AuditLog" WHERE "tenantId"=$1 AND action LIKE 'ioc.%' AND "instanceCode" IN ($2,$3)`,
    [TENANT, created.planId, created.sceneId],
  )).rows.map((x) => x.action);
  ok(audits.includes('ioc.plan.publish'), 'audit: ioc.plan.publish recorded');
  ok(audits.includes('ioc.plan.rollback'), 'audit: ioc.plan.rollback recorded');
  ok(audits.includes('ioc.scene.publish'), 'audit: ioc.scene.publish recorded');

  // cleanup ------------------------------------------------------------------
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  await c.query('DELETE FROM "TwinSceneVersion" WHERE "sceneId"=$1', [created.sceneId]);
  await c.query('DELETE FROM "SceneBinding" WHERE "sceneId"=$1', [created.sceneId]);
  await c.query('DELETE FROM "TwinScene" WHERE id=$1', [created.sceneId]);
  await c.query('DELETE FROM "FloorPlanVersion" WHERE "planId"=$1', [created.planId]);
  await c.query('DELETE FROM "FloorPlanDefinition" WHERE id=$1', [created.planId]);
  await c.query('DELETE FROM "TwinFloor" WHERE id=$1', [created.floorId]);
  await c.query('DELETE FROM "TwinSite" WHERE id=$1', [created.siteId]);
  await c.query('DELETE FROM "AuditLog" WHERE "instanceCode" = ANY($1::text[])', [[created.planId, created.sceneId]]);
  await c.query('COMMIT');
  await c.end();
  console.log('  · smoke artifacts cleaned up');
} catch (e) {
  console.error('  ✗ smoke threw:', e.message);
  failed++;
}

console.log(failed === 0 ? '\nIOC TWIN SMOKE PASSED' : `\nIOC TWIN SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
