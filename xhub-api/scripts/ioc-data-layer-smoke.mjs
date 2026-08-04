// XHub Enterprise IOC — governed data layer + dashboard SMOKE (DT-03 acceptance).
// Run: npm run test:ioc-data-layer
//
// Asserts (data/ACCEPTANCE_TESTS.csv + Constitution):
//   AT-005  a query using an unregistered entity / field / operator / aggregation
//           / groupBy is REJECTED — the frontend can never reach raw SQL or an
//           un-catalogued column (Constitution #6)
//   AT-012  camera / attendance / biometric / presence entity keys are PERMANENTLY
//           banned server-side (403), not merely absent from the docs
//   AT-006  individual drill-down is REFUSED without ioc.people.detail; the
//           default response is department-AGGREGATE (Constitution #7)
//   AT-009  a brand-new tenant dashboard is created, published and rendered with
//           NO code change — pure configuration
//   AT-002/003 dashboard version immutability + rollback
// Plus: the executed numbers are genuinely DERIVED from the existing Work data
//       (add a work item → the workload layer moves), proving IOC is a projection
//       and not a new System of Record.
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const TENANT = 'tenant-xtech';
const OTHER = 'tenant-demo-isolation';
const H = (t = TENANT) => ({ 'content-type': 'application/json', 'x-tenant-id': t, 'x-user-id': 'user-nam' });
const MARK = `IOCDL-SMOKE-${Date.now()}`;

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

const created = { layerId: null, dashboardId: null, workItemIds: [] };
console.log(`ioc-data-layer smoke @ ${BASE} (mark=${MARK})`);

try {
  // 0) the catalog is a SERVER constant --------------------------------------
  let r = await api('GET', '/api/ioc/data-layers/catalog');
  ok(r.status < 300 && Array.isArray(r.json?.entities), `catalog served (${r.status})`);
  const entities = r.json?.entities ?? [];
  ok(entities.length >= 4, `catalog exposes ${entities.length} registered entities`);
  const blob = JSON.stringify(entities).toLowerCase();
  ok(!/camera|attendance|biometric|presence|cctv|badge|keystroke/.test(blob),
    'AT-012: catalog contains NO camera/attendance/biometric/presence entity');
  const work = entities.find((e) => e.entityKey === 'NativeWorkItem');
  ok(work?.ownedBy?.includes('Work'), `NativeWorkItem is declared as owned by ${work?.ownedBy} (IOC is a projection, not the SoR)`);

  // 1) AT-005 rejection matrix -----------------------------------------------
  const base = {
    code: `${MARK}-BAD`, name: 'bad', entityKey: 'NativeWorkItem',
    query: { filters: [], timeWindow: 'LIVE', groupBy: ['orgUnitId'] },
    aggregation: { op: 'COUNT', field: null }, visualMapping: { mode: 'CARD', thresholds: [] },
  };
  r = await api('POST', '/api/ioc/data-layers', { ...base, entityKey: 'SecretTable' });
  ok(r.status === 400 && /unregistered entityKey/i.test(JSON.stringify(r.json)), `AT-005: unregistered entityKey REJECTED (${r.status})`);

  r = await api('POST', '/api/ioc/data-layers', { ...base, query: { ...base.query, filters: [{ field: 'salary', operator: 'GT', value: 1 }] } });
  ok(r.status === 400 && /unregistered field/i.test(JSON.stringify(r.json)), `AT-005: unregistered FIELD REJECTED (${r.status})`);

  r = await api('POST', '/api/ioc/data-layers', { ...base, query: { ...base.query, filters: [{ field: 'status', operator: 'LIKE', value: '%x%' }] } });
  ok(r.status === 400 && /not allowed/i.test(JSON.stringify(r.json)), `AT-005: unregistered OPERATOR (LIKE) REJECTED (${r.status})`);

  r = await api('POST', '/api/ioc/data-layers', { ...base, query: { ...base.query, filters: [{ field: 'status', operator: 'EQ', value: "DONE'; DROP TABLE \"NativeWorkItem\"; --" }] } });
  ok(r.status === 400 && /not a registered member/i.test(JSON.stringify(r.json)), `AT-005: SQL-injection-shaped enum value REJECTED (${r.status})`);

  r = await api('POST', '/api/ioc/data-layers', { ...base, query: { ...base.query, groupBy: ['assigneeIds'] } });
  ok(r.status === 400 && /unregistered groupBy/i.test(JSON.stringify(r.json)), `AT-005: unregistered groupBy REJECTED (${r.status})`);

  r = await api('POST', '/api/ioc/data-layers', { ...base, aggregation: { op: 'SUM', field: 'title' } });
  ok(r.status === 400, `AT-005: SUM over a non-measure field REJECTED (${r.status})`);

  r = await api('POST', '/api/ioc/data-layers', { ...base, visualMapping: { mode: 'DANCE', thresholds: [] } });
  ok(r.status === 400 && /invalid visual mode/i.test(JSON.stringify(r.json)), `AT-005: unregistered visual mode REJECTED (${r.status})`);

  // 2) AT-012 hard ban --------------------------------------------------------
  for (const banned of ['CameraEvent', 'AttendanceRecord', 'BiometricScan', 'PersonPresence', 'BadgeSwipe']) {
    r = await api('POST', '/api/ioc/data-layers', { ...base, entityKey: banned });
    ok(r.status === 403 && /banned/i.test(JSON.stringify(r.json)), `AT-012: entityKey "${banned}" hard-banned server-side (${r.status})`);
  }
  r = await api('POST', '/api/ioc/data-layers/preview', { ...base, entityKey: 'CameraProductivityScore' });
  ok(r.status === 403, `AT-012: the ban also covers the ad-hoc preview path (${r.status})`);

  // 3) a valid governed layer, executed --------------------------------------
  r = await api('POST', '/api/ioc/data-layers', {
    code: `${MARK}-WORKLOAD`, name: 'IOC smoke — tải công việc', entityKey: 'NativeWorkItem',
    query: { filters: [{ field: 'status', operator: 'NOT_IN', value: ['DONE', 'CANCELLED'] }], timeWindow: 'LIVE', groupBy: ['orgUnitId'] },
    aggregation: { op: 'SUM', field: 'weightedDemand' },
    visualMapping: { mode: 'ZONE_COLOR', thresholds: [{ min: 0, max: 10, state: 'NORMAL' }, { min: 10, max: null, state: 'BUSY' }] },
  });
  ok(r.status < 300 && r.json?.id, `valid data layer created (${r.status})`);
  created.layerId = r.json?.id;
  ok(r.json?.sourceKey === 'xoffice-work', 'sourceKey is derived from the catalog, not from the request body');

  r = await api('GET', `/api/ioc/data-layers/${created.layerId}/execute`);
  ok(r.status < 300 && Array.isArray(r.json?.rows), `layer executed (${r.status})`);
  ok(r.json?.scope === 'aggregate', 'AT-006: default execution scope is AGGREGATE');
  ok(r.json?.groupBy === 'orgUnitId', 'rows are grouped by department');
  const blob2 = JSON.stringify(r.json);
  ok(!/personId|holderPersonId|assigneeIds|ownerId/.test(blob2), 'AT-006: aggregate response carries NO person identifier');
  ok(r.json.rows.every((x) => typeof x.label === 'string'), 'department labels are resolved from Identity (not hardcoded)');
  const totalBefore = r.json?.total ?? 0;
  ok(typeof totalBefore === 'number', `aggregate total computed (${totalBefore})`);

  // 4) the number is genuinely DERIVED from the Work SoR ----------------------
  r = await api('POST', '/api/work/items', { title: `${MARK} extra load`, type: 'TASK', status: 'TODO', priority: 'URGENT' });
  ok(r.status < 300 && r.json?.id, `work item created via the Work API (${r.status})`);
  if (r.json?.id) created.workItemIds.push(r.json.id);
  r = await api('GET', `/api/ioc/data-layers/${created.layerId}/execute`);
  ok((r.json?.total ?? 0) > totalBefore, `workload total ROSE after adding a work item (${totalBefore} → ${r.json?.total}) — value is projected from Work, not stored by IOC`);

  // 5) AT-006 privacy gate ----------------------------------------------------
  // `user-nam` maps to usr-cfo, who holds PLATFORM_ADMIN ['*'] in the demo, so it
  // is NOT a valid negative subject. Use an ordinary employee (user-huyvu →
  // usr-it-support) who genuinely lacks ioc.people.detail.
  const PLAIN = { 'content-type': 'application/json', 'x-tenant-id': TENANT, 'x-user-id': 'user-huyvu' };
  let res = await fetch(`${BASE}/api/ioc/data-layers/${created.layerId}/execute?scope=individual`, { headers: PLAIN });
  let body = await res.text();
  ok(res.status === 403 && /ioc\.people\.detail/.test(body),
    `AT-006: individual drill-down REFUSED for an actor without ioc.people.detail (${res.status})`);
  ok(!/"ownerId"|usr-cfo|usr-ceo/.test(body), 'AT-006: the refusal leaks no individual data');

  // The same actor still gets the AGGREGATE view — the gate narrows scope, not access.
  res = await fetch(`${BASE}/api/ioc/data-layers/${created.layerId}/execute`, { headers: PLAIN });
  body = await res.text();
  ok(res.status === 200 && /"scope":"aggregate"/.test(body), `AT-006: the same actor still reads the department AGGREGATE (${res.status})`);
  ok(!/holderPersonId|assigneeIds/.test(body), 'AT-006: aggregate view carries no person identifier for the unprivileged actor');

  // A privileged actor (PLATFORM_ADMIN '*') IS allowed — and it is AUDITED.
  r = await api('GET', `/api/ioc/data-layers/${created.layerId}/execute?scope=individual`);
  ok(r.status === 200 && r.json?.scope === 'individual', `AT-006: privileged actor is permitted individual scope (${r.status})`);
  {
    const c0 = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
    await c0.connect();
    await c0.query("SELECT set_config('app.bypass_rls','on',false)");
    const n = Number((await c0.query(
      `SELECT count(*)::int AS n FROM "AuditLog" WHERE "tenantId"=$1 AND action='ioc.datalayer.people_detail' AND detail LIKE $2`,
      [TENANT, `%${created.layerId}%`],
    )).rows[0].n);
    await c0.end();
    ok(n >= 1, `AT-006: the permitted individual drill-down wrote an audit row (${n})`);
  }

  // 6) AT-009 no-code dashboard ----------------------------------------------
  r = await api('POST', '/api/ioc/dashboards', {
    code: `${MARK}-DASH`, name: 'IOC smoke — dashboard tự cấu hình', viewType: 'CUSTOM',
    widgets: [
      { id: 'w1', type: 'KPI', title: 'Tải', dataLayerId: created.layerId, layout: { x: 0, y: 0, w: 3, h: 1 } },
      { id: 'w2', type: 'HEATMAP', title: 'Nhiệt', dataLayerId: created.layerId, layout: { x: 0, y: 1, w: 6, h: 3 } },
    ],
  });
  ok(r.status < 300 && r.json?.id, `AT-009: dashboard created purely via API — no code change (${r.status})`);
  created.dashboardId = r.json?.id;

  r = await api('POST', '/api/ioc/dashboards', { code: `${MARK}-EVIL`, name: 'evil', viewType: 'CUSTOM', widgets: [{ id: 'w1', type: 'KPI', sql: 'SELECT 1', layout: { x: 0, y: 0, w: 1, h: 1 } }] });
  ok(r.status === 400 && /script\/SQL\/HTML is not allowed/i.test(JSON.stringify(r.json)), `raw SQL in widget config REJECTED (${r.status})`);
  r = await api('POST', '/api/ioc/dashboards', { code: `${MARK}-EVIL2`, name: 'evil', viewType: 'CUSTOM', widgets: [{ id: 'w1', type: 'IFRAME', layout: { x: 0, y: 0, w: 1, h: 1 } }] });
  ok(r.status === 400, `unregistered widget type REJECTED (${r.status})`);
  r = await api('POST', '/api/ioc/dashboards', { code: `${MARK}-EVIL3`, name: 'evil', viewType: 'CUSTOM', widgets: [{ id: 'w1', type: 'KPI', dataLayerId: 'not-a-layer', layout: { x: 0, y: 0, w: 1, h: 1 } }] });
  ok(r.status === 400, `widget referencing an unknown data layer REJECTED (${r.status})`);

  // publish + runtime
  r = await api('GET', `/api/ioc/runtime/dashboards/${created.dashboardId}`);
  ok(r.status === 404, `runtime refuses an UNPUBLISHED dashboard (${r.status})`);
  r = await api('POST', `/api/ioc/dashboards/${created.dashboardId}/publish`, { note: 'v1' });
  ok(r.status < 300 && r.json?.versionNo === 1, `dashboard published v1 (${r.status})`);
  const dashV1Checksum = r.json?.checksum;

  r = await api('GET', `/api/ioc/runtime/dashboards/${created.dashboardId}`);
  ok(r.status < 300 && (r.json?.widgets ?? []).length === 2, `AT-009: the new dashboard RENDERS from config alone (${r.status})`);
  ok(r.json?.dataLayers?.[created.layerId]?.rows, 'runtime executed the referenced data layer and returned rows');

  // AT-002/003 for dashboards
  await api('PATCH', `/api/ioc/dashboards/${created.dashboardId}`, {
    widgets: [{ id: 'w1', type: 'KPI', title: 'Tải', dataLayerId: created.layerId, layout: { x: 0, y: 0, w: 3, h: 1 } }],
  });
  r = await api('POST', `/api/ioc/dashboards/${created.dashboardId}/publish`, { note: 'v2' });
  ok(r.json?.versionNo === 2, `dashboard re-publish creates v2 (got v${r.json?.versionNo})`);
  r = await api('GET', `/api/ioc/dashboards/${created.dashboardId}/versions`);
  const dv1 = (r.json?.items ?? []).find((v) => v.versionNo === 1);
  ok(dv1?.checksum === dashV1Checksum && (dv1?.payload?.widgets ?? []).length === 2,
    'AT-002: dashboard v1 payload + checksum unchanged after v2 (immutable)');
  r = await api('POST', `/api/ioc/dashboards/${created.dashboardId}/rollback`, { versionNo: 1 });
  ok(r.json?.activeVersionNo === 1 && r.json?.deleted === 0, 'AT-003: dashboard rollback re-activates v1 without deleting v2');
  r = await api('GET', `/api/ioc/runtime/dashboards/${created.dashboardId}`);
  ok((r.json?.widgets ?? []).length === 2, 'AT-003: runtime now serves the rolled-back v1 layout');

  // 7) AT-001 isolation on layers/dashboards ---------------------------------
  r = await api('GET', `/api/ioc/data-layers/${created.layerId}`, null, OTHER);
  ok(r.status === 404, `AT-001: other tenant cannot read the data layer (${r.status})`);
  r = await api('GET', `/api/ioc/runtime/dashboards/${created.dashboardId}`, null, OTHER);
  ok(r.status === 404, `AT-001: other tenant cannot resolve the dashboard (${r.status})`);

  // cleanup -------------------------------------------------------------------
  const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
  await c.connect();
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  await c.query('DELETE FROM "DashboardVersion" WHERE "dashboardId"=$1', [created.dashboardId]);
  await c.query('DELETE FROM "DashboardDefinition" WHERE id=$1', [created.dashboardId]);
  await c.query('DELETE FROM "DataLayerDefinition" WHERE id=$1', [created.layerId]);
  if (created.workItemIds.length) {
    await c.query('DELETE FROM "WorkItemEvent" WHERE "workItemId" = ANY($1::text[])', [created.workItemIds]);
    await c.query('DELETE FROM "NativeWorkItem" WHERE id = ANY($1::text[])', [created.workItemIds]);
  }
  await c.query(`DELETE FROM "AuditLog" WHERE "tenantId"=$1 AND "instanceCode" LIKE $2`, [TENANT, `${MARK}%`]);
  await c.query('COMMIT');
  await c.end();
  console.log('  · smoke artifacts cleaned up');
} catch (e) {
  console.error('  ✗ smoke threw:', e.message);
  failed++;
}

console.log(failed === 0 ? '\nIOC DATA-LAYER SMOKE PASSED' : `\nIOC DATA-LAYER SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
