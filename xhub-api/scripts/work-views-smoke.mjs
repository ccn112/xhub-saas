// Work views smoke (X.Office Work v2 — W3, Management Views). Server up on :4000.
// Run: npm run test:work-views
//
// Asserts the W3 read surface the owner's two priorities depend on:
//   1. STATS / PIVOT (owner #2): GET /api/work/stats cross-tab counts are exact
//      for a known dimension (bo_phan) and a known tag, computed from data this
//      smoke creates (deterministic, filtered by a unique tag so seed data does
//      not perturb the counts). count + progress(avg) + overdue metrics + a
//      2-axis cross-tab (bo_phan × giai_doan).
//   2. COORDINATION GANTT (owner #1): a SUMMARY-shared viewer gets SummaryDTO
//      bars ONLY (no description/children); the owner gets FULL (children +
//      description). Enforced server-side.
//   3. PORTFOLIO: GET /api/work/portfolio rolls up health/overdue/blocked.
//   4. KANBAN status PATCH persists (POST /items/:id/status).
//   5. GANTT schedule PATCH with an invalid FS dependency ordering is rejected 400.
// FULLY SELF-CLEANING via Postgres under RLS bypass.
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const H = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };
const TAG = 'WV-SMOKE-TAG';
const IPREFIX = 'WI-WVSMOKE-';
const PPREFIX = 'WV-SMOKE-';

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const j = async (path, opts = {}, headers = H) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const post = (path, data, headers) => j(path, { method: 'POST', body: JSON.stringify(data ?? {}) }, headers);
const patch = (path, data, headers) => j(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }, headers);

console.log('Work views smoke @ ' + BASE);
const itemIds = [];
const mk = async (o) => {
  const r = await post('/api/work/items', { tags: [TAG, ...(o.tags ?? [])], ...o });
  if (r.body?.id) itemIds.push(r.body.id);
  return r.body?.id;
};

// ---- data: 6 items, bo_phan DEV×3 / QA×2 / PMO×1, giai_doan BUILD/UAT/PLAN ----
const A = await mk({ title: `${IPREFIX}a`, status: 'IN_PROGRESS', progressPercent: 40, dimensions: { bo_phan: 'DEV', giai_doan: 'BUILD' } });
const B = await mk({ title: `${IPREFIX}b`, status: 'TODO', progressPercent: 0, dimensions: { bo_phan: 'DEV', giai_doan: 'BUILD' } });
const C = await mk({ title: `${IPREFIX}c`, status: 'DONE', progressPercent: 100, dimensions: { bo_phan: 'DEV', giai_doan: 'UAT' } });
const D = await mk({ title: `${IPREFIX}d`, status: 'IN_PROGRESS', progressPercent: 60, dimensions: { bo_phan: 'QA', giai_doan: 'UAT' } });
const E = await mk({ title: `${IPREFIX}e`, status: 'BLOCKED', priority: 'HIGH', progressPercent: 20, dimensions: { bo_phan: 'QA', giai_doan: 'PLAN' } });
const F = await mk({ title: `${IPREFIX}f`, status: 'BACKLOG', progressPercent: 0, dimensions: { bo_phan: 'PMO', giai_doan: 'PLAN' } });
ok([A, B, C, D, E, F].every(Boolean), 'seeded 6 tagged items');
// one overdue item (dueAt in the past, not DONE) for overdue metric.
await patch(`/api/work/items/${E}`, { dueAt: new Date(Date.now() - 3 * 864e5).toISOString() });

// ---- 1. STATS: groupBy dimension:bo_phan, metric count, filtered by our tag ----
const byDept = await j(`/api/work/stats?groupBy=dimension:bo_phan&metric=count&tags=${TAG}`);
ok(byDept.status === 200, 'GET /api/work/stats 200');
const cell = (rows, k) => rows.find((r) => r.key === k)?.total ?? 0;
const dRows = byDept.body?.rows ?? [];
ok(byDept.body?.itemCount === 6, `stats itemCount = 6 (got ${byDept.body?.itemCount})`);
ok(cell(dRows, 'DEV') === 3, `bo_phan DEV count = 3 (got ${cell(dRows, 'DEV')})`);
ok(cell(dRows, 'QA') === 2, `bo_phan QA count = 2 (got ${cell(dRows, 'QA')})`);
ok(cell(dRows, 'PMO') === 1, `bo_phan PMO count = 1 (got ${cell(dRows, 'PMO')})`);
ok((byDept.body?.rows ?? []).find((r) => r.key === 'DEV')?.label === 'Dev', 'dimension value carries catalog label (Dev)');

// ---- stats: groupBy tag → our tag bucket = 6 ----
const byTag = await j(`/api/work/stats?groupBy=tag&metric=count&tags=${TAG}`);
ok(cell(byTag.body?.rows ?? [], TAG) === 6, `tag '${TAG}' count = 6 (got ${cell(byTag.body?.rows ?? [], TAG)})`);

// ---- stats: metric progress (avg) for DEV = (40+0+100)/3 = 47 (rounded) ----
const prog = await j(`/api/work/stats?groupBy=dimension:bo_phan&metric=progress&tags=${TAG}`);
ok(cell(prog.body?.rows ?? [], 'DEV') === 47, `DEV avg progress = 47 (got ${cell(prog.body?.rows ?? [], 'DEV')})`);

// ---- stats: metric overdue → exactly 1 (item E) ----
const over = await j(`/api/work/stats?groupBy=dimension:bo_phan&metric=overdue&tags=${TAG}`);
ok(over.body?.grandTotal === 1, `overdue grandTotal = 1 (got ${over.body?.grandTotal})`);
ok(cell(over.body?.rows ?? [], 'QA') === 1, `overdue in QA = 1 (got ${cell(over.body?.rows ?? [], 'QA')})`);

// ---- stats cross-tab: bo_phan × giai_doan (count) ----
const cross = await j(`/api/work/stats?groupBy=dimension:bo_phan&col=dimension:giai_doan&metric=count&tags=${TAG}`);
const xrow = (rows, k) => rows.find((r) => r.key === k);
const devRow = xrow(cross.body?.rows ?? [], 'DEV');
ok(devRow?.cells?.BUILD === 2, `cross-tab DEV×BUILD = 2 (got ${devRow?.cells?.BUILD})`);
ok(devRow?.cells?.UAT === 1, `cross-tab DEV×UAT = 1 (got ${devRow?.cells?.UAT})`);
ok(Array.isArray(cross.body?.columns) && cross.body.columns.length >= 3, `cross-tab has giai_doan columns (got ${cross.body?.columns?.length})`);

// ---- 2. COORDINATION GANTT: SUMMARY viewer vs FULL owner ----
const stamp = Date.now().toString(36);
const proj = await post('/api/work/projects', {
  code: `${PPREFIX}${stamp}`, name: 'Dự án views smoke', projectKind: 'INTERNAL', status: 'ACTIVE',
  progressMethod: 'TASK_WEIGHTED', plannedFinish: new Date(Date.now() + 20 * 864e5).toISOString(),
  forecastFinish: new Date(Date.now() + 45 * 864e5).toISOString(), tags: ['wv-smoke'],
});
const pid = proj.body?.id;
ok(!!pid, `project created (${pid})`);
// attach parent A + children B (as child of A). E is overdue root for portfolio.
await patch(`/api/work/items/${A}`, { description: 'Chi tiết nội bộ chỉ FULL thấy' });
await post(`/api/work/projects/${pid}/items`, { workItemIds: [A] });
await post(`/api/work/projects/${pid}/items`, { workItemIds: [B], parentId: A });
await post(`/api/work/projects/${pid}/items`, { workItemIds: [E] });

const VIEWER = 'usr-wv-coord-viewer';
await post(`/api/work/projects/${pid}/shares`, { scope: 'PROJECT', audienceType: 'USER', audienceId: VIEWER, tier: 'SUMMARY' });
const vH = { ...H, 'x-user-id': VIEWER };

const cg = await j(`/api/work/projects/${pid}/gantt?view=coordination`, {}, vH);
ok(cg.body?.view === 'coordination', 'coordination gantt view flag');
ok(cg.body?.access === 'SUMMARY', `shared viewer access = SUMMARY (got ${cg.body?.access})`);
const bars = cg.body?.bars ?? [];
ok(bars.length >= 1 && bars.every((b) => b.tier === 'SUMMARY'), 'gantt bars are SUMMARY tier');
ok(bars.every((b) => !('description' in b)), 'gantt SUMMARY bars OMIT description');
ok(!bars.some((b) => b.id === B), 'gantt SUMMARY hides child item B (children absent)');
ok(bars.some((b) => b.id === A), 'gantt SUMMARY shows parent bar A (rolled-up)');
// SUMMARY viewer on detail: no children/description/roles.
const vDetail = await j(`/api/work/projects/${pid}`, {}, vH);
ok(vDetail.body?.access === 'SUMMARY' && vDetail.body?.dependencies === undefined, 'SUMMARY detail omits dependencies (no leak)');

// FULL owner gets children + description.
const oDetail = await j(`/api/work/projects/${pid}`);
ok(oDetail.body?.access === 'FULL', `owner access = FULL (got ${oDetail.body?.access})`);
const aFull = (oDetail.body?.workItems ?? []).find((w) => w.id === A);
ok(!!aFull && aFull.description === 'Chi tiết nội bộ chỉ FULL thấy', 'FULL owner sees description');
ok((oDetail.body?.workItems ?? []).some((w) => w.id === B), 'FULL owner sees child item B');

// ---- 3. PORTFOLIO: our project shows up with overdue/blocked roll-up ----
const pf = await j('/api/work/portfolio');
ok(pf.status === 200 && Array.isArray(pf.body?.projects), 'GET /api/work/portfolio 200 + projects[]');
const mine = (pf.body?.projects ?? []).find((p) => p.id === pid);
ok(!!mine, 'portfolio includes our project');
ok(mine?.overdueItems >= 1, `portfolio overdueItems >= 1 (got ${mine?.overdueItems})`);
ok(mine?.blockedItems >= 1, `portfolio blockedItems >= 1 (item E, got ${mine?.blockedItems})`);
ok(['GREEN', 'YELLOW', 'RED', 'UNKNOWN'].includes(mine?.health), `portfolio health computed (got ${mine?.health})`);
ok(pf.body?.totals && typeof pf.body.totals.byHealth === 'object', 'portfolio totals.byHealth present');

// ---- 4. KANBAN status PATCH persists ----
const st = await post(`/api/work/items/${B}/status`, { to: 'IN_PROGRESS' });
ok(st.status < 300 && st.body?.status === 'IN_PROGRESS', `kanban status change persists (got ${st.body?.status})`);
const bAfter = await j(`/api/work/items/${B}`);
ok(bAfter.body?.item?.status === 'IN_PROGRESS', 'status re-read = IN_PROGRESS');

// ---- 5. GANTT schedule PATCH: invalid FS dependency ordering rejected 400 ----
// A (predecessor) finishes AFTER C's start via FS → moving C to start before A finishes = 400.
await patch(`/api/work/items/${A}`, { dueAt: new Date(Date.now() + 10 * 864e5).toISOString() });
await post(`/api/work/projects/${pid}/items`, { workItemIds: [C] });
await post(`/api/work/projects/${pid}/dependencies`, { predecessorId: A, successorId: C, type: 'FS' });
// valid: C starts after A finishes.
const good = await post(`/api/work/items/${C}/schedule`, { plannedStart: new Date(Date.now() + 12 * 864e5).toISOString(), dueAt: new Date(Date.now() + 14 * 864e5).toISOString() });
ok(good.status < 300, `valid reschedule accepted (got ${good.status})`);
// invalid: C starts BEFORE A's finish (FS violated) → 400.
const bad = await post(`/api/work/items/${C}/schedule`, { plannedStart: new Date(Date.now() + 2 * 864e5).toISOString(), dueAt: new Date(Date.now() + 4 * 864e5).toISOString() });
ok(bad.status === 400, `invalid FS ordering rejected → 400 (got ${bad.status})`);
// invalid: start after finish → 400.
const bad2 = await post(`/api/work/items/${A}/schedule`, { plannedStart: new Date(Date.now() + 30 * 864e5).toISOString(), dueAt: new Date(Date.now() + 1 * 864e5).toISOString() });
ok(bad2.status === 400, `start-after-finish rejected → 400 (got ${bad2.status})`);

// ---- self-clean -----------------------------------------------------------
const cl = new pg.Client({ connectionString: process.env.DATABASE_URL });
await cl.connect();
try {
  await cl.query('BEGIN');
  await cl.query("SELECT set_config('app.bypass_rls','on',true)");
  await cl.query(`DELETE FROM "CoordinationShare" WHERE "scopeId"=$1`, [pid]);
  await cl.query(`DELETE FROM "ExecutionProjectEvent" WHERE "projectId"=$1`, [pid]);
  await cl.query(`DELETE FROM "WorkDependency" WHERE "predecessorId" = ANY($1::text[]) OR "successorId" = ANY($1::text[])`, [itemIds]);
  await cl.query(`DELETE FROM "WorkItemEvent" WHERE "workItemId" = ANY($1::text[])`, [itemIds]);
  await cl.query(`DELETE FROM "NativeWorkItem" WHERE id = ANY($1::text[]) OR title LIKE $2`, [itemIds, `${IPREFIX}%`]);
  const dp = await cl.query(`DELETE FROM "ExecutionProject" WHERE id=$1 OR code LIKE $2`, [pid, `${PPREFIX}%`]);
  await cl.query('COMMIT');
  ok(dp.rowCount >= 1, `smoke project + items cleaned (deleted ${dp.rowCount} project)`);
} catch (e) {
  await cl.query('ROLLBACK').catch(() => {});
  console.error('  ✗ cleanup failed:', e.message);
  failed++;
} finally {
  await cl.end();
}
const residue = await j(`/api/work/items?tags=${TAG}&pageSize=200`);
ok((residue.body?.items ?? []).length === 0, `no tagged item residue (got ${residue.body?.items?.length})`);

console.log(failed === 0 ? '\nWORK VIEWS SMOKE PASSED' : `\nWORK VIEWS SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
