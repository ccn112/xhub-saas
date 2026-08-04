// Work project smoke (X.Office Work v2 — W2, ExecutionProject). Server up on
// :4000. Run: npm run test:work-project
//
// Asserts end to end:
//   create project → create + attach W1 items into a WBS (parent + weighted
//   children) → parent roll-up + project roll-up correct for TASK_WEIGHTED,
//   MILESTONE_WEIGHTED, DELIVERABLE_WEIGHTED, MANUAL → add FS/SS/FF/SF dependency
//   → cycle dependency → 409 → self-dependency → 400 → baseline v1 immutable
//   (mutate → v2, v1 preserved) → rebaseline → v3 → health deterministic (stable
//   across recomputes) → project role assign via AssignmentResolver (snapshot) →
//   CoordinationShare: a SUMMARY-shared viewer gets a SummaryDTO for the parent
//   (title/progress/dates ONLY, children omitted, description/attachments blocked);
//   a non-shared non-member gets NOTHING (404) → tenant isolation → enforcement 403.
// FULLY SELF-CLEANING: every WP-SMOKE- project + WI-WPSMOKE- item (+ deps /
// baselines / roles / shares / events) is removed at the end via Postgres under
// RLS bypass.
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const H = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };
const PPREFIX = 'WP-SMOKE-';
const IPREFIX = 'WI-WPSMOKE-';

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const j = async (path, opts = {}, headers = H) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const post = (path, data, headers) => j(path, { method: 'POST', body: JSON.stringify(data ?? {}) }, headers);
const patch = (path, data, headers) => j(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }, headers);
const del = (path, headers) => j(path, { method: 'DELETE' }, headers);

console.log('Work project smoke @ ' + BASE);
const itemIds = [];
const mkItem = async (o) => {
  const r = await post('/api/work/items', o);
  if (r.body?.id) itemIds.push(r.body.id);
  return r.body?.id;
};

// 1. Create project (TASK_WEIGHTED).
const stamp = Date.now().toString(36);
const created = await post('/api/work/projects', {
  code: `${PPREFIX}${stamp}`,
  name: 'Dự án smoke W2',
  projectKind: 'INTERNAL',
  status: 'ACTIVE',
  progressMethod: 'TASK_WEIGHTED',
  plannedFinish: new Date(Date.now() + 20 * 864e5).toISOString(),
  forecastFinish: new Date(Date.now() + 40 * 864e5).toISOString(),
  tags: ['smoke', 'w2'],
});
ok(created.status === 201 || created.status === 200, 'POST /api/work/projects 200/201');
const pid = created.body?.id;
ok(!!pid, `project created (${pid})`);
ok(created.body?.code === `${PPREFIX}${stamp}`, 'code persisted');

// 2. Create items + attach into a WBS: parent + 2 weighted children.
const parent = await mkItem({ title: `${IPREFIX}parent`, type: 'TASK' });
const child1 = await mkItem({ title: `${IPREFIX}child1`, type: 'SUBTASK', status: 'IN_PROGRESS', progressPercent: 60, weight: 2 });
const child2 = await mkItem({ title: `${IPREFIX}child2`, type: 'SUBTASK', status: 'TODO', progressPercent: 0, weight: 1 });
// child progress via explicit setProgress (create clamps but keep explicit).
await post(`/api/work/items/${child1}/progress`, { progressPercent: 60 });
await post(`/api/work/projects/${pid}/items`, { workItemIds: [parent] });
await post(`/api/work/projects/${pid}/items`, { workItemIds: [child1, child2], parentId: parent });

// 3. TASK_WEIGHTED roll-up: parent = (2*60 + 1*0)/3 = 40.
const detail1 = await j(`/api/work/projects/${pid}`);
const parentRow = (detail1.body?.workItems ?? []).find((w) => w.id === parent);
ok(parentRow?.rolledUpProgress === 40, `parent WBS roll-up TASK_WEIGHTED = 40 (got ${parentRow?.rolledUpProgress})`);
ok(detail1.body?.project?.computedProgress === 40, `project roll-up TASK_WEIGHTED = 40 (got ${detail1.body?.project?.computedProgress})`);

// 4. Add a root milestone + a root deliverable to exercise the other methods.
const milestone = await mkItem({ title: `${IPREFIX}milestone`, type: 'MILESTONE', status: 'IN_PROGRESS' });
const deliverable = await mkItem({ title: `${IPREFIX}deliverable`, type: 'DELIVERABLE', status: 'IN_PROGRESS', progressPercent: 80 });
await post(`/api/work/items/${deliverable}/progress`, { progressPercent: 80 });
await post(`/api/work/projects/${pid}/items`, { workItemIds: [milestone, deliverable] });

// MILESTONE_WEIGHTED: 1 milestone, not done → 0.
await patch(`/api/work/projects/${pid}`, { progressMethod: 'MILESTONE_WEIGHTED' });
let rc = await post(`/api/work/projects/${pid}/recompute`, {});
ok(rc.body?.metrics?.projectProgress === 0, `MILESTONE_WEIGHTED (0/1 done) = 0 (got ${rc.body?.metrics?.projectProgress})`);
await post(`/api/work/items/${milestone}/status`, { to: 'DONE' });
rc = await post(`/api/work/projects/${pid}/recompute`, {});
ok(rc.body?.metrics?.projectProgress === 100, `MILESTONE_WEIGHTED (1/1 done) = 100 (got ${rc.body?.metrics?.projectProgress})`);

// DELIVERABLE_WEIGHTED: single deliverable @ 80 → 80.
await patch(`/api/work/projects/${pid}`, { progressMethod: 'DELIVERABLE_WEIGHTED' });
rc = await post(`/api/work/projects/${pid}/recompute`, {});
ok(rc.body?.metrics?.projectProgress === 80, `DELIVERABLE_WEIGHTED = 80 (got ${rc.body?.metrics?.projectProgress})`);

// MANUAL: stored value returned verbatim.
await patch(`/api/work/projects/${pid}`, { progressMethod: 'MANUAL', progressPercent: 55 });
rc = await post(`/api/work/projects/${pid}/recompute`, {});
ok(rc.body?.metrics?.projectProgress === 55, `MANUAL = 55 (got ${rc.body?.metrics?.projectProgress})`);
// restore TASK_WEIGHTED for the rest.
await patch(`/api/work/projects/${pid}`, { progressMethod: 'TASK_WEIGHTED' });

// 5. Dependencies. FS child1→child2.
const dep1 = await post(`/api/work/projects/${pid}/dependencies`, { predecessorId: child1, successorId: child2, type: 'FS' });
ok(dep1.status === 200 || dep1.status === 201, `add FS dependency 200/201 (got ${dep1.status})`);
const dep2 = await post(`/api/work/projects/${pid}/dependencies`, { predecessorId: child1, successorId: milestone, type: 'SS' });
ok(dep2.status < 300, 'add SS dependency ok');
const dep3 = await post(`/api/work/projects/${pid}/dependencies`, { predecessorId: child2, successorId: milestone, type: 'FF' });
ok(dep3.status < 300, 'add FF dependency ok');
const dep4 = await post(`/api/work/projects/${pid}/dependencies`, { predecessorId: parent, successorId: deliverable, type: 'SF' });
ok(dep4.status < 300, 'add SF dependency ok');
// cycle: child2→child1 closes the loop child1→child2→child1 → 409.
const cycle = await post(`/api/work/projects/${pid}/dependencies`, { predecessorId: child2, successorId: child1, type: 'FS' });
ok(cycle.status === 409, `cycle dependency rejected → 409 (got ${cycle.status})`);
// self-dep → 400.
const self = await post(`/api/work/projects/${pid}/dependencies`, { predecessorId: child1, successorId: child1, type: 'FS' });
ok(self.status === 400, `self-dependency rejected → 400 (got ${self.status})`);
const depList = await j(`/api/work/projects/${pid}/dependencies`);
ok(Array.isArray(depList.body) && depList.body.length >= 4, `dependency list returns edges (got ${depList.body?.length})`);

// 6. Baseline v1 (immutable).
const b1 = await post(`/api/work/projects/${pid}/baseline`, { label: 'v1' });
ok(b1.body?.version === 1, `baseline v1 created (got v${b1.body?.version})`);
ok(b1.body?.itemCount >= 1, `baseline v1 snapshotted ${b1.body?.itemCount} items`);
// Mutate an item then baseline again → NEW version 2; v1 preserved.
await patch(`/api/work/items/${child2}`, { dueAt: new Date(Date.now() + 5 * 864e5).toISOString() });
const b2 = await post(`/api/work/projects/${pid}/baseline`, { label: 'v2' });
ok(b2.body?.version === 2, `re-capture → NEW version 2, not overwrite (got v${b2.body?.version})`);
const baselines = await j(`/api/work/projects/${pid}/baselines`);
const versions = (baselines.body ?? []).map((b) => b.version).sort((a, b) => a - b);
ok(versions.includes(1) && versions.includes(2), `both baseline versions preserved (immutable) [${versions.join(',')}]`);

// 7. Rebaseline → version 3.
const reb = await post(`/api/work/projects/${pid}/rebaseline`, { note: 'replan' });
ok(reb.body?.version === 3, `rebaseline → version 3 (got v${reb.body?.version})`);
const afterReb = await j(`/api/work/projects/${pid}`);
ok(afterReb.body?.project?.currentBaselineVersion === 3, `currentBaselineVersion advanced to 3 (got ${afterReb.body?.project?.currentBaselineVersion})`);

// 8. Health deterministic (stable across recomputes).
const h1 = (await post(`/api/work/projects/${pid}/recompute`, {})).body?.metrics?.health;
const h2 = (await post(`/api/work/projects/${pid}/recompute`, {})).body?.metrics?.health;
ok(['GREEN', 'YELLOW', 'RED', 'UNKNOWN'].includes(h1) && h1 === h2, `health deterministic + stable (got ${h1}/${h2})`);

// 9. Project role assign via AssignmentResolver (snapshot, NOT hardcoded).
const roleRes = await post(`/api/work/projects/${pid}/roles`, { role: 'DELIVERY_LEAD', selectorType: 'ORG_UNIT_HEAD', orgUnitId: 'ou-delivery' });
ok(roleRes.status < 300, `role assign via resolver 200/201 (got ${roleRes.status})`);
ok(roleRes.body?.assignmentSnapshot?.via === 'assignment-resolver', `role routed via resolver (got ${roleRes.body?.assignmentSnapshot?.via})`);
ok(roleRes.body?.role === 'DELIVERY_LEAD', 'role persisted');
const roles = await j(`/api/work/projects/${pid}/roles`);
ok(Array.isArray(roles.body) && roles.body.length >= 1, 'role list returns assignment');

// 10. CoordinationShare — SUMMARY viewer sees parent summary only; non-member none.
const VIEWER = 'usr-coord-viewer-smoke';
const share = await post(`/api/work/projects/${pid}/shares`, { scope: 'PROJECT', audienceType: 'USER', audienceId: VIEWER, tier: 'SUMMARY' });
ok(share.status < 300, `coordination share created (got ${share.status})`);
const viewerH = { ...H, 'x-user-id': VIEWER };
const seen = await j(`/api/work/projects/${pid}`, {}, viewerH);
ok(seen.body?.access === 'SUMMARY', `shared viewer gets SUMMARY access (got ${seen.body?.access})`);
ok(seen.body?.project?.tier === 'SUMMARY', 'shared viewer project is SUMMARY tier');
ok(seen.body?.roles === undefined && seen.body?.dependencies === undefined, 'SUMMARY omits roles/dependencies (no leak)');
const sBars = seen.body?.workItems ?? [];
const sParent = sBars.find((w) => w.id === parent);
ok(!!sParent && sParent.tier === 'SUMMARY', 'SUMMARY viewer sees parent bar');
ok(sParent && sParent.title != null && sParent.progressPercent != null && 'dueAt' in sParent, 'SUMMARY bar exposes title/progress/dates');
ok(sParent && !('description' in sParent), 'SUMMARY bar OMITS description (no leak)');
ok(!sBars.some((w) => w.id === child1 || w.id === child2), 'SUMMARY viewer sees NO child items (children omitted)');
// coordination gantt
const gantt = await j(`/api/work/projects/${pid}/gantt?view=coordination`, {}, viewerH);
ok(gantt.body?.view === 'coordination' && Array.isArray(gantt.body?.bars), 'coordination gantt returns rolled-up bars');
ok(!(gantt.body?.bars ?? []).some((b) => 'description' in b), 'coordination gantt bars carry no description');
// non-shared non-member → nothing.
const nobody = await j(`/api/work/projects/${pid}`, {}, { ...H, 'x-user-id': 'usr-nobody-smoke' });
ok(nobody.status === 404, `non-shared non-member gets nothing → 404 (got ${nobody.status})`);

// 11. Tenant isolation.
const iso = await j('/api/work/projects?pageSize=200', {}, { ...H, 'x-tenant-id': 'tenant-demo-isolation' });
const isoLeak = (iso.body?.items ?? []).filter((p) => (p.code || '').startsWith(PPREFIX)).length;
ok(isoLeak === 0, `demo-isolation sees 0 xtech smoke projects (got ${isoLeak})`);

// 12. Enforcement: no work.project.create → 403.
const forbidden = await post('/api/work/projects', { code: `${PPREFIX}enforce`, name: 'x' }, { ...H, 'x-user-id': 'usr-employee-nobody-smoke', 'x-authz-enforce': 'true' });
ok(forbidden.status === 403, `no work.project.create → 403 (got ${forbidden.status})`);

// ---- self-clean -----------------------------------------------------------
const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  await c.query(`DELETE FROM "BaselineItem" WHERE "baselineId" IN (SELECT id FROM "ProjectBaseline" WHERE "projectId"=$1)`, [pid]);
  await c.query(`DELETE FROM "ProjectBaseline" WHERE "projectId"=$1`, [pid]);
  await c.query(`DELETE FROM "ProjectRoleAssignment" WHERE "projectId"=$1`, [pid]);
  await c.query(`DELETE FROM "CoordinationShare" WHERE "scopeId"=$1`, [pid]);
  await c.query(`DELETE FROM "ExecutionProjectEvent" WHERE "projectId"=$1`, [pid]);
  await c.query(`DELETE FROM "WorkDependency" WHERE "predecessorId" = ANY($1::text[]) OR "successorId" = ANY($1::text[])`, [itemIds]);
  await c.query(`DELETE FROM "WorkItemEvent" WHERE "workItemId" = ANY($1::text[])`, [itemIds]);
  await c.query(`DELETE FROM "NativeWorkItem" WHERE id = ANY($1::text[]) OR title LIKE $2`, [itemIds, `${IPREFIX}%`]);
  const dp = await c.query(`DELETE FROM "ExecutionProject" WHERE id=$1 OR code LIKE $2`, [pid, `${PPREFIX}%`]);
  await c.query('COMMIT');
  ok(dp.rowCount >= 1, `smoke project cleaned (deleted ${dp.rowCount})`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('  ✗ cleanup failed:', e.message);
  failed++;
} finally {
  await c.end();
}
const residue = await j(`/api/work/projects?q=${PPREFIX}&pageSize=200`);
ok((residue.body?.items ?? []).filter((p) => (p.code || '').startsWith(PPREFIX)).length === 0, 'no project residue remains');

console.log(failed === 0 ? '\nWORK PROJECT SMOKE PASSED' : `\nWORK PROJECT SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
