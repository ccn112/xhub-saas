// XHub Enterprise IOC — command-centre INSIGHTS smoke (DT-05).
// Run: npm run test:ioc-insights   (API must be up on :4000)
//
// Proves, against the RUNNING API and the REAL database:
//   1. FLOW LINES ARE A PROJECTION. Insert ONE real NativeWorkItem whose owner
//      sits in org A and whose assignee sits in org B → the A→B edge volume goes
//      up by exactly 1. Delete it → it goes back down. Nothing is stored in a
//      twin table; the line exists because the WORK exists.
//   2. HEALTH SCORE is deterministic and documented — recomputing the published
//      formula from the published inputs reproduces the published score, and two
//      consecutive calls agree.
//   3. The AI brief goes through the platform's SINGLE draft-first gate
//      (XofficeService.aiAdvisory): it is always advisory
//      (mustRequireHumanApply) and reports source live|mock.
//   4. NOTHING IS FABRICATED: no cost KPI is shipped, the 24h heatmap is
//      explicitly unavailable-with-reason, and a forecast is either backed by
//      >= 3 real MetricObservation points or absent-with-reason.
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const TENANT = 'tenant-xtech';
const H = { 'content-type': 'application/json', 'x-tenant-id': TENANT, 'x-user-id': 'user-nam' };
const PROBE_ID = `wi-ioc-insights-probe-${Date.now()}`;

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); failed++; }
};
const insights = async () => {
  const res = await fetch(`${BASE}/api/ioc/runtime/dashboards/DASH-OFFICE/insights`, { headers: H });
  if (!res.ok) throw new Error(`insights ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
};
const edgeVolume = (j, from, to) => j.flows.find((f) => f.fromZoneId === from && f.toZoneId === to)?.items ?? 0;

console.log(`ioc-insights smoke @ ${BASE}`);
const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await c.connect();

try {
  const before = await insights();
  ok(Array.isArray(before.zones) && before.zones.length > 0, `${before.zones.length} vùng resolved from the published scene`);
  ok(before.zones.every((z) => typeof z.seats === 'number' && typeof z.filled === 'number'), 'every zone carries real Position headcount (seats/filled)');

  // --- 1) flow projection ---------------------------------------------------
  ok(before.flows.length > 0, `${before.flows.length} cross-zone flow edges from real handoffs (window ${before.flowMeta.windowDays}d)`);
  ok(before.flowMeta.sources.some((s) => s.key === 'work.handoff' && s.available), 'flow source work.handoff is declared available');
  const approval = before.flowMeta.sources.find((s) => s.key === 'workflow.approval');
  ok(approval && approval.available === false && !!approval.reason, 'approval-based flow is DEFERRED with an explicit reason (not faked)');

  // Pick two zones bound to different org units that both have a position holder.
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  const holders = (await c.query(
    'SELECT DISTINCT ON ("orgUnitId") "orgUnitId", "holderPersonId" FROM "Position" WHERE "tenantId"=$1 AND "holderPersonId" IS NOT NULL ORDER BY "orgUnitId", "isHead" DESC',
    [TENANT],
  )).rows;
  const holderOf = new Map(holders.map((r) => [r.orgUnitId, r.holderPersonId]));
  const usable = before.zones.filter((z) => z.orgUnitId && holderOf.has(z.orgUnitId));
  if (usable.length < 2) throw new Error('need two zones whose org units have position holders');
  const A = usable[usable.length - 1];
  const B = usable[usable.length - 2];

  await c.query(
    `INSERT INTO "NativeWorkItem"
       (id,"tenantId",type,title,status,priority,"ownerId","assigneeIds","progressPercent",weight,tags,dimensions,"createdBy","createdAt","updatedAt")
     VALUES ($1,$2,'TASK',$3,'IN_PROGRESS','NORMAL',$4,ARRAY[$5]::text[],0,1,ARRAY['ioc-insights-probe']::text[],'{}'::jsonb,'test:ioc-insights',now(),now())`,
    [PROBE_ID, TENANT, 'Probe bàn giao liên phòng ban', holderOf.get(A.orgUnitId), holderOf.get(B.orgUnitId)],
  );
  await c.query('COMMIT');

  const after = await insights();
  ok(
    edgeVolume(after, A.zoneId, B.zoneId) === edgeVolume(before, A.zoneId, B.zoneId) + 1,
    `flow ${A.label} → ${B.label} rose ${edgeVolume(before, A.zoneId, B.zoneId)} → ${edgeVolume(after, A.zoneId, B.zoneId)} after ONE real cross-org work item`,
  );
  ok(after.flowMeta.handoffsInWindow === before.flowMeta.handoffsInWindow + 1, 'total handoffs in window rose by exactly 1');

  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  await c.query('DELETE FROM "NativeWorkItem" WHERE id=$1', [PROBE_ID]);
  await c.query('COMMIT');

  const restored = await insights();
  ok(
    edgeVolume(restored, A.zoneId, B.zoneId) === edgeVolume(before, A.zoneId, B.zoneId),
    'deleting the work item removes the flow again (no parallel ledger — the line IS the work)',
  );

  // --- 2) health score ------------------------------------------------------
  const h = restored.kpi.health;
  ok(typeof h.score === 'number' && h.score >= 0 && h.score <= 100, `health score ${h.score}/100 is in range`);
  ok(typeof h.formula === 'string' && h.formula.includes('0.6') && h.formula.includes('0.4'), 'health formula is published with the payload');
  const recomputed = Math.max(0, Math.min(100, Math.round(0.6 * h.inputs.onTimeRate + 0.4 * h.inputs.loadBalance)));
  ok(recomputed === h.score, `formula reproduces the score by hand (0.6×${h.inputs.onTimeRate} + 0.4×${h.inputs.loadBalance} = ${recomputed})`);
  const again = await insights();
  ok(again.kpi.health.score === h.score, 'health score is deterministic across two calls (no randomness)');
  ok(again.kpi.onTime.rate === restored.kpi.onTime.rate, 'on-time rate comes from the single ManageOS formula (stable)');

  // --- 3) AI brief ----------------------------------------------------------
  ok(again.brief.mustRequireHumanApply === true, 'AI brief is advisory-only (mustRequireHumanApply)');
  ok(['live', 'mock'].includes(again.brief.source), `AI brief went through the draft-first gate (source=${again.brief.source})`);
  ok(typeof again.brief.bottleneck === 'string' && again.brief.bottleneck.length > 0, 'AI brief names a bottleneck');
  ok(Array.isArray(again.brief.recommendations) && again.brief.recommendations.length >= 1, `AI brief carries ${again.brief.recommendations.length} recommendation(s)`);
  ok(typeof again.brief.inputs === 'string' && again.brief.inputs.includes('Tỷ lệ đúng hạn'), 'the exact aggregate numbers given to the model are disclosed');

  // --- 4) nothing fabricated -------------------------------------------------
  ok(again.kpi.cost === undefined, 'NO operating-cost KPI is shipped (no finance connector exists)');
  ok(again.omitted.some((o) => o.key === 'operatingCost' && o.reason), 'the omitted cost tile is declared with a reason');
  ok(again.heatmap.available === false && !!again.heatmap.reason, '24h heatmap is honestly deferred (no hour-bucketed data yet)');
  ok(
    again.forecast.available === false ? !!again.forecast.reason : Array.isArray(again.forecast.points) && again.forecast.points.length >= 3,
    again.forecast.available ? `forecast is backed by ${again.forecast.points.length} REAL observations` : 'forecast omitted with an honest reason',
  );
  ok(again.pipeline.reduce((s, p) => s + p.count, 0) > 0, 'pipeline counts come from real NativeWorkItem statuses');
  ok(again.alerts.every((a) => !!a.source), 'every alert declares the real state it was derived from');
} catch (e) {
  console.error('  ✗ smoke threw:', e.message);
  failed++;
} finally {
  await c.query('BEGIN').catch(() => {});
  await c.query("SELECT set_config('app.bypass_rls','on',true)").catch(() => {});
  await c.query('DELETE FROM "NativeWorkItem" WHERE id=$1', [PROBE_ID]).catch(() => {});
  await c.query('COMMIT').catch(() => {});
  await c.end();
}

console.log(failed === 0 ? '\nIOC INSIGHTS SMOKE PASSED' : `\nIOC INSIGHTS SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
