// X.Office Management Operating System — MG-03 (KPI/OKR/Scorecard) SMOKE.
// Proves against the running API: KPI tree groups by perspective, a RED KPI is
// never hidden by a blended perspective score, check-in history is append-only,
// and RLS isolation holds. Run: npm run test:manage-okr.
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const TENANT = 'tenant-xtech';
const OTHER = 'tenant-demo-isolation';
const H = (t = TENANT) => ({ 'content-type': 'application/json', 'x-tenant-id': t, 'x-user-id': 'user-nam' });
const MARK = `MG03-SMOKE-${Date.now()}`;

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

const created = { objectiveId: null, metricId: null, cycleId: null, okrId: null, scorecardId: null };
console.log(`manage-okr smoke @ ${BASE} (mark=${MARK})`);
try {
  // 1) Objective + a RED metric (value beyond thresholdRed) --------------------
  let r = await api('POST', '/api/manage/objectives', {
    code: `${MARK}-OBJ`, name: 'MG03-SMOKE Objective', perspective: 'PROCESS', status: 'ACTIVE',
  });
  ok(r.status < 300 && r.json?.id, `objective created (${r.status})`);
  const objectiveId = r.json?.id;
  created.objectiveId = objectiveId;

  r = await api('POST', '/api/manage/metrics', {
    code: `${MARK}-RED`, name: 'MG03-SMOKE red metric', formula: 'fixture', unit: '%', direction: 'UP',
    sourceSystem: 'MANUAL', frequency: 'WEEKLY', target: 90, thresholdAmber: 80, thresholdRed: 70,
  });
  ok(r.status < 300 && r.json?.id, `red metric created (${r.status})`);
  const metricIdRed = r.json?.id;
  created.metricId = metricIdRed;

  r = await api('POST', '/api/manage/metrics', {
    code: `${MARK}-GREEN`, name: 'MG03-SMOKE green metric', formula: 'fixture', unit: '%', direction: 'UP',
    sourceSystem: 'MANUAL', frequency: 'WEEKLY', target: 90, thresholdAmber: 80, thresholdRed: 70,
  });
  ok(r.status < 300 && r.json?.id, `green metric created (${r.status})`);
  const metricIdGreen = r.json?.id;

  // Insert observations directly (MANUAL source has no compute endpoint) — red one BELOW threshold.
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  const now = new Date();
  const ps = new Date(now.getFullYear(), now.getMonth(), 1);
  const pe = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  await c.query(
    `INSERT INTO "MetricObservation" (id,"tenantId","metricId","periodStart","periodEnd",value,source,confidence,"computedAt")
     VALUES ($1,$2,$3,$4,$5,50,'MANUAL',1,now())`,
    [`${MARK}-obs-red`, TENANT, metricIdRed, ps, pe],
  );
  await c.query(
    `INSERT INTO "MetricObservation" (id,"tenantId","metricId","periodStart","periodEnd",value,source,confidence,"computedAt")
     VALUES ($1,$2,$3,$4,$5,95,'MANUAL',1,now())`,
    [`${MARK}-obs-green`, TENANT, metricIdGreen, ps, pe],
  );
  await c.query('COMMIT');
  await c.end();

  await api('PATCH', `/api/manage/objectives/${objectiveId}`, { linkedMetricIds: [metricIdRed, metricIdGreen] });

  // 2) KPI tree groups correctly by perspective ---------------------------------
  r = await api('GET', `/api/manage/kpis?objectiveId=${objectiveId}`);
  ok(r.status < 300 && Array.isArray(r.json?.groups), `kpi tree returned groups (${r.status})`);
  const group = r.json?.groups?.find((g) => g.perspective === 'PROCESS');
  ok(!!group, 'kpi tree groups by perspective (PROCESS group present)');
  const codes = group?.kpis?.map((k) => k.metricCode) ?? [];
  ok(codes.includes(`${MARK}-RED`) && codes.includes(`${MARK}-GREEN`), 'kpi tree group contains both metrics under the objective');

  // 3) A red KPI is never hidden/averaged away by a blended perspective score ---
  const redNode = group?.kpis?.find((k) => k.metricCode === `${MARK}-RED`);
  ok(redNode?.status === 'RED', `red metric derives status RED (got ${redNode?.status})`);
  ok(group?.redCount >= 1, `kpi group surfaces redCount >= 1 (got ${group?.redCount})`);
  ok(!('rollup' in (group ?? {})) || group.rollup !== 'GREEN', 'kpi group has no single GREEN rollup hiding the red item');

  // Scorecard rollup: worst-of must be RED, and redItems must list the red metric explicitly.
  r = await api('POST', '/api/manage/scorecards', {
    name: `${MARK} scorecard`, period: '2099Q1',
    perspectives: [{ code: 'PROCESS', name: 'Process', objectiveIds: [objectiveId] }],
  });
  ok(r.status < 300 && r.json?.id, `scorecard created (${r.status})`);
  const scorecardId = r.json?.id;
  created.scorecardId = scorecardId;
  r = await api('GET', `/api/manage/scorecards/${scorecardId}`);
  const pv = r.json?.perspectiveViews?.[0];
  ok(pv?.rollup === 'RED', `scorecard perspective rollup is worst-of = RED, not blended (got ${pv?.rollup})`);
  ok(Array.isArray(pv?.redItems) && pv.redItems.length >= 1, 'scorecard exposes redItems explicitly alongside the rollup (#5 no blended hide)');

  // 4) OKR cycle + objective + key results + APPEND-ONLY check-in -------------
  r = await api('POST', '/api/manage/okr-cycles', {
    code: `${MARK}-CYCLE`, name: 'MG03-SMOKE cycle', startDate: ps.toISOString(), endDate: pe.toISOString(), status: 'ACTIVE',
  });
  ok(r.status < 300 && r.json?.id, `okr cycle created (${r.status})`);
  const cycleId = r.json?.id;
  created.cycleId = cycleId;

  r = await api('POST', '/api/manage/okrs', {
    cycleId, objective: 'MG03-SMOKE objective', ownerId: 'usr-cfo', status: 'ACTIVE', confidence: 0.5,
    strategicObjectiveIds: [],
    keyResults: [{ description: 'MG03-SMOKE KR', baseline: 0, target: 100, current: 0, unit: '%' }],
  });
  ok(r.status < 300 && r.json?.id, `okr objective created (${r.status})`);
  const okrId = r.json?.id;
  created.okrId = okrId;
  const krId = r.json?.keyResults?.[0]?.id;
  ok(!!krId, 'okr objective has 1 key result (contract minItems=1)');

  // #9 distinctness: KeyResult creation carrying a raw task ref must be rejected.
  r = await api('POST', '/api/manage/okrs', {
    cycleId, objective: 'MG03-SMOKE bad objective', ownerId: 'usr-cfo',
    keyResults: [{ description: 'bad KR', baseline: 0, target: 1, unit: '#', nativeWorkItemId: 'wi-123' }],
  });
  ok(r.status === 400, `KR with a raw task/work-item ref is REJECTED (#9, got ${r.status})`);

  // KR ≥1 validation.
  r = await api('POST', '/api/manage/okrs', { cycleId, objective: 'MG03-SMOKE empty KR', ownerId: 'usr-cfo', keyResults: [] });
  ok(r.status === 400, `okr with empty keyResults[] is REJECTED (contract minItems=1, got ${r.status})`);

  // Check-in #1
  r = await api('POST', `/api/manage/okrs/${okrId}/key-results/${krId}/checkin`, { value: 30, confidence: 0.4, note: 'first check-in' });
  ok(r.status < 300 && r.json?.checkIn?.id, `check-in #1 created (${r.status})`);
  const checkin1Id = r.json?.checkIn?.id;
  ok(r.json?.keyResult?.current === 30, 'key result current updated to check-in value');

  // Check-in #2 — history must survive (APPEND-ONLY).
  r = await api('POST', `/api/manage/okrs/${okrId}/key-results/${krId}/checkin`, { value: 60, confidence: 0.6, note: 'second check-in' });
  ok(r.status < 300 && r.json?.checkIn?.id, `check-in #2 created (${r.status})`);
  ok(r.json?.keyResult?.current === 60, 'key result current updated to the NEW check-in value');
  const historyIds = (r.json?.keyResult?.checkIns ?? []).map((ci) => ci.id);
  ok(historyIds.includes(checkin1Id), 'APPEND-ONLY: the first check-in survives after adding a new one');
  ok((r.json?.keyResult?.checkIns ?? []).length >= 2, `check-in history has >= 2 rows (got ${r.json?.keyResult?.checkIns?.length})`);

  // 5) RLS isolation — MUST_NOT_LEAK -------------------------------------------
  r = await api('GET', '/api/manage/scorecards', undefined, OTHER);
  const leakedSc = (r.json?.items ?? []).some((s) => s.id === scorecardId);
  ok(!leakedSc, `MUST_NOT_LEAK: tenant ${OTHER} does not see the smoke scorecard`);
  r = await api('GET', '/api/manage/okr-cycles', undefined, OTHER);
  const leakedCycle = (r.json?.items ?? []).some((cy) => cy.id === cycleId);
  ok(!leakedCycle, `MUST_NOT_LEAK: tenant ${OTHER} does not see the smoke OKR cycle`);
  r = await api('GET', `/api/manage/okrs/${okrId}`, undefined, OTHER);
  ok(r.status === 404, `MUST_NOT_LEAK: cross-tenant GET of the okr objective is 404 (got ${r.status})`);
} catch (e) {
  console.error('  ✗ smoke threw:', e.message);
  failed++;
}

// ---- self-clean (DB, bypass RLS) ------------------------------------------
const c2 = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c2.connect();
try {
  await c2.query('BEGIN');
  await c2.query("SELECT set_config('app.bypass_rls','on',true)");
  await c2.query(`DELETE FROM "KeyResultCheckIn" WHERE "tenantId"=$1 AND "keyResultId" IN (SELECT id FROM "KeyResult" WHERE "tenantId"=$1 AND "okrObjectiveId" IN (SELECT id FROM "OKRObjective" WHERE "tenantId"=$1 AND objective LIKE '${MARK}%' OR objective LIKE 'MG03-SMOKE%'))`, [TENANT]);
  await c2.query(`DELETE FROM "KeyResult" WHERE "tenantId"=$1 AND "okrObjectiveId" IN (SELECT id FROM "OKRObjective" WHERE "tenantId"=$1 AND (objective LIKE '${MARK}%' OR objective LIKE 'MG03-SMOKE%'))`, [TENANT]);
  await c2.query(`DELETE FROM "OKRObjective" WHERE "tenantId"=$1 AND (objective LIKE '${MARK}%' OR objective LIKE 'MG03-SMOKE%')`, [TENANT]);
  await c2.query(`DELETE FROM "OKRCycle" WHERE "tenantId"=$1 AND code LIKE '${MARK}%'`, [TENANT]);
  await c2.query(`DELETE FROM "Scorecard" WHERE "tenantId"=$1 AND name LIKE '${MARK}%'`, [TENANT]);
  await c2.query(`DELETE FROM "MetricObservation" WHERE "tenantId"=$1 AND id LIKE '${MARK}%'`, [TENANT]);
  await c2.query(`DELETE FROM "MetricDefinition" WHERE "tenantId"=$1 AND code LIKE '${MARK}%'`, [TENANT]);
  await c2.query(`DELETE FROM "StrategicObjective" WHERE "tenantId"=$1 AND code LIKE '${MARK}%'`, [TENANT]);
  await c2.query('COMMIT');
  const residue = Number((await c2.query(`SELECT (SELECT count(*) FROM "OKRCycle" WHERE "tenantId"=$1 AND code LIKE '${MARK}%')+(SELECT count(*) FROM "Scorecard" WHERE "tenantId"=$1 AND name LIKE '${MARK}%')+(SELECT count(*) FROM "StrategicObjective" WHERE "tenantId"=$1 AND code LIKE '${MARK}%') AS n`, [TENANT])).rows[0].n);
  ok(residue === 0, `self-clean: 0 residue rows (got ${residue})`);
} catch (e) {
  console.error('  ✗ self-clean failed:', e.message);
  failed++;
} finally {
  await c2.end();
}

console.log(failed === 0 ? '\nMANAGE-OKR SMOKE PASSED' : `\nMANAGE-OKR SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
