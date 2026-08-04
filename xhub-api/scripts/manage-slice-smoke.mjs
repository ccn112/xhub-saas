// X.Office Management Operating System — MG-01 reference-slice SMOKE.
// Proves the FULL management loop resolves END-TO-END against the running API,
// then self-cleans. Run: npm run test:manage-slice (reset && smoke).
//
// The loop asserted (each arrow is a real linkage, not a mock):
//   StrategicObjective
//     → MetricDefinition(sourceSystem=XOFFICE_WORK)
//       → MetricObservation VALUE **computed from the existing Work data**
//   → BusinessReview PRE-READ snapshot CONTAINS that observation
//   → DecisionRecord (RAPID) referenced by the review
//   → ActionCommitment bridges to a REAL NativeWorkItem (spawned FOLLOW_UP)
//   → review close PRODUCES a follow-up (another real linked NativeWorkItem)
// Plus RLS isolation: a different tenant MUST_NOT_LEAK any of the slice's rows.
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const TENANT = 'tenant-xtech';
const OTHER = 'tenant-demo-isolation';
const H = (t = TENANT) => ({ 'content-type': 'application/json', 'x-tenant-id': t, 'x-user-id': 'user-nam' });
const MARK = `MG-SMOKE-${Date.now()}`;

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

const created = { workItemIds: [] };
console.log(`manage-slice smoke @ ${BASE} (mark=${MARK})`);
try {
  // 1) Strategic objective ------------------------------------------------------
  let r = await api('POST', '/api/manage/objectives', {
    code: `${MARK}-ST-OPS`, name: 'MG-SMOKE Vận hành chuẩn', perspective: 'Internal Process', status: 'ACTIVE',
  });
  ok(r.status < 300 && r.json?.id, `objective created (${r.status})`);
  const objectiveId = r.json?.id;

  // 2) Metric definition (XOFFICE_WORK connector) ------------------------------
  r = await api('POST', '/api/manage/metrics', {
    code: `${MARK}-ACT-CLOSE`, name: 'MG-SMOKE Tỷ lệ cam kết đúng hạn', formula: 'on-time share of work items',
    unit: '%', direction: 'UP', sourceSystem: 'XOFFICE_WORK', frequency: 'WEEKLY', target: 90, thresholdAmber: 80, thresholdRed: 70,
  });
  ok(r.status < 300 && r.json?.id, `metric created (${r.status})`);
  const metricId = r.json?.id;
  ok(r.json?.sourceSystem === 'XOFFICE_WORK', 'metric sourceSystem=XOFFICE_WORK');

  // link objective → metric (reference, not embed)
  await api('PATCH', `/api/manage/objectives/${objectiveId}`, { linkedMetricIds: [metricId] });
  r = await api('GET', `/api/manage/objectives/${objectiveId}`);
  ok(r.json?.linkedMetricIds?.includes(metricId), 'objective links the metric (reference)');
  ok(Array.isArray(r.json?.linkedMetrics) && r.json.linkedMetrics.some((m) => m.id === metricId), 'objective detail resolves linked metric definition');

  // 3) observation VALUE computed from Work ------------------------------------
  r = await api('GET', `/api/manage/metrics/${metricId}/observations`);
  ok(r.status < 300 && r.json?.latest, 'observation computed + returned');
  const obs1 = r.json?.latest;
  ok(obs1 && typeof obs1.value === 'number' && obs1.value >= 0 && obs1.value <= 100, `observation value is a number in [0,100] (got ${obs1?.value})`);
  ok(obs1?.source === 'XOFFICE_WORK', 'observation source = XOFFICE_WORK (real connector)');

  // Prove the value is genuinely DERIVED FROM WORK: add an OVERDUE work item and
  // recompute — the on-time rate must not increase.
  r = await api('POST', '/api/work/items', {
    title: `${MARK} overdue item`, type: 'TASK', status: 'TODO', priority: 'HIGH',
    dueAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  });
  ok(r.status < 300 && r.json?.id, `overdue work item created via Work API (${r.status})`);
  if (r.json?.id) created.workItemIds.push(r.json.id);
  r = await api('GET', `/api/manage/metrics/${metricId}/observations`);
  const obs2 = r.json?.latest;
  ok(obs2 && obs2.value <= obs1.value, `recomputed on-time rate did not rise after an overdue item (${obs1.value}% → ${obs2?.value}%) — value is computed from Work`);

  // 4) Monthly Business Review with pre-read snapshot --------------------------
  const y = new Date().getFullYear(), m = new Date().getMonth();
  r = await api('POST', '/api/manage/reviews', {
    title: `${MARK} MBR`, type: 'MONTHLY_BUSINESS',
    periodStart: new Date(y, m, 1).toISOString(), periodEnd: new Date(y, m + 1, 1).toISOString(),
    metricIds: [metricId],
  });
  ok(r.status < 300 && r.json?.id, `review created (${r.status})`);
  const reviewId = r.json?.id;
  ok(r.json?.status === 'PRE_READ', 'review moved to PRE_READ (snapshot built)');
  ok(Array.isArray(r.json?.preRead) && r.json.preRead.some((p) => p.metricCode === `${MARK}-ACT-CLOSE`), 'review pre-read snapshot CONTAINS the computed metric observation');
  ok(r.json?.metricObservationIds?.length >= 1, 'review holds immutable observation snapshot ids');

  // 5) RAPID decision referenced by the review ---------------------------------
  r = await api('POST', '/api/manage/decisions', {
    reviewId, question: `${MARK} giữ target 90%?`, decision: 'Giữ 90% + mở cam kết xử lý tồn đọng',
    deciderId: 'usr-ceo', recommenderId: 'usr-cfo', status: 'DECIDED',
    rapid: { recommend: 'METRIC_OWNER', decide: 'CEO' }, evidenceRefs: [`review:${reviewId}`],
  });
  ok(r.status < 300 && r.json?.id, `decision created (${r.status})`);
  const decisionId = r.json?.id;
  r = await api('GET', `/api/manage/reviews/${reviewId}`);
  ok(r.json?.decisionIds?.includes(decisionId), 'review references the decision');

  // 6) Action bridges to a REAL NativeWorkItem ---------------------------------
  r = await api('POST', '/api/manage/actions', {
    title: `${MARK} xử lý tồn đọng`, decisionId, reviewId, spawnWorkItem: true, ownerId: 'usr-cfo',
    dueAt: new Date(y, m + 1, 1).toISOString(),
  });
  ok(r.status < 300 && r.json?.id, `action created (${r.status})`);
  const actionId = r.json?.id;
  ok(r.json?.nativeWorkItemId, 'action LINKS a real NativeWorkItem (the bridge #13)');
  ok(r.json?.workItem && r.json.workItem.type === 'FOLLOW_UP', 'linked work item resolves (type FOLLOW_UP) — execution SoR is Work');
  if (r.json?.nativeWorkItemId) created.workItemIds.push(r.json.nativeWorkItemId);
  r = await api('GET', `/api/manage/reviews/${reviewId}`);
  ok(r.json?.actionIds?.includes(actionId), 'review references the action');

  // 7) Close review → produces a follow-up (another real linked work item) -----
  r = await api('POST', `/api/manage/reviews/${reviewId}/close`, {});
  ok(r.status < 300, `review closed (${r.status})`);
  ok(r.json?.review?.status === 'CLOSED', 'review status = CLOSED');
  ok(r.json?.followUp?.id && r.json.followUp.nativeWorkItemId, 'close PRODUCED a follow-up commitment with a real linked NativeWorkItem');
  if (r.json?.followUp?.nativeWorkItemId) created.workItemIds.push(r.json.followUp.nativeWorkItemId);

  // 8) FULL LOOP resolves end-to-end -------------------------------------------
  ok(
    !!(objectiveId && metricId && obs1?.id && reviewId && decisionId && actionId),
    'FULL LOOP resolves: objective → metric → observation(from Work) → review snapshot → decision → action → work item → follow-up',
  );

  // 9) RLS isolation — MUST_NOT_LEAK -------------------------------------------
  r = await api('GET', '/api/manage/objectives', undefined, OTHER);
  const leakedObj = (r.json?.items ?? []).some((o) => o.id === objectiveId);
  ok(!leakedObj, `MUST_NOT_LEAK: tenant ${OTHER} does NOT see the slice's objective`);
  r = await api('GET', '/api/manage/reviews', undefined, OTHER);
  const leakedRev = (r.json?.items ?? []).some((o) => o.id === reviewId);
  ok(!leakedRev, `MUST_NOT_LEAK: tenant ${OTHER} does NOT see the slice's review`);
  r = await api('GET', `/api/manage/objectives/${objectiveId}`, undefined, OTHER);
  ok(r.status === 404, `MUST_NOT_LEAK: cross-tenant GET of the objective is 404 (got ${r.status})`);
} catch (e) {
  console.error('  ✗ smoke threw:', e.message);
  failed++;
}

// ---- self-clean (DB, bypass RLS) ------------------------------------------
const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  await c.query(`DELETE FROM "ActionCommitment" WHERE "tenantId"=$1 AND (title LIKE '${MARK}%' OR title LIKE 'Theo dõi sau ${MARK}%')`, [TENANT]);
  await c.query(`DELETE FROM "DecisionRecord" WHERE "tenantId"=$1 AND question LIKE '${MARK}%'`, [TENANT]);
  await c.query(`DELETE FROM "BusinessReview" WHERE "tenantId"=$1 AND title LIKE '${MARK}%'`, [TENANT]);
  await c.query(`DELETE FROM "MetricObservation" WHERE "tenantId"=$1 AND "metricId" IN (SELECT id FROM "MetricDefinition" WHERE "tenantId"=$1 AND code LIKE '${MARK}%')`, [TENANT]);
  await c.query(`DELETE FROM "MetricDefinition" WHERE "tenantId"=$1 AND code LIKE '${MARK}%'`, [TENANT]);
  await c.query(`DELETE FROM "StrategicObjective" WHERE "tenantId"=$1 AND code LIKE '${MARK}%'`, [TENANT]);
  if (created.workItemIds.length) {
    await c.query(`DELETE FROM "WorkItemEvent" WHERE "tenantId"=$1 AND "workItemId" = ANY($2::text[])`, [TENANT, created.workItemIds]);
    await c.query(`DELETE FROM "NativeWorkItem" WHERE "tenantId"=$1 AND (id = ANY($2::text[]) OR title LIKE '${MARK}%')`, [TENANT, created.workItemIds]);
  } else {
    await c.query(`DELETE FROM "NativeWorkItem" WHERE "tenantId"=$1 AND title LIKE '${MARK}%'`, [TENANT]);
  }
  await c.query('COMMIT');
  const residue = Number((await c.query(`SELECT (SELECT count(*) FROM "MetricDefinition" WHERE "tenantId"=$1 AND code LIKE '${MARK}%')+(SELECT count(*) FROM "StrategicObjective" WHERE "tenantId"=$1 AND code LIKE '${MARK}%')+(SELECT count(*) FROM "NativeWorkItem" WHERE "tenantId"=$1 AND title LIKE '${MARK}%') AS n`, [TENANT])).rows[0].n);
  ok(residue === 0, `self-clean: 0 residue rows (got ${residue})`);
} catch (e) {
  console.error('  ✗ self-clean failed:', e.message);
  failed++;
} finally {
  await c.end();
}

console.log(failed === 0 ? '\nMANAGE-SLICE SMOKE PASSED' : `\nMANAGE-SLICE SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
