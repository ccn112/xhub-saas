// Work item smoke (X.Office Work v2 — W1, NativeWorkItem). Server must be up on
// :4000. Run: npm run test:work-item
//
// Asserts, end to end:
//   create → assign via AssignmentResolver (assignmentSnapshot, NOT hardcoded) →
//   status + progress transitions (illegal transition → 400) → comment / checklist
//   (+toggle) / attachment (RecordDocument subjectType=WorkItem) round-trip →
//   filter by tag + by dimension returns the correct subset → VISIBILITY: an actor
//   with only work.view.summary gets a SummaryDTO (NO description/comments/
//   attachments/children) while the owner gets a FullDTO → tenant isolation
//   (demo-isolation sees 0) → enforcement (no work.item.create → 403).
// FULLY SELF-CLEANING: every WI-SMOKE-* item (+ children/comments/checklist/events
// + attachment RecordDocuments) is deleted at the end via Postgres under RLS bypass.
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const H = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };
const PREFIX = 'WI-SMOKE-';

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const j = async (path, opts = {}, headers = H) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const post = (path, data, headers) => j(path, { method: 'POST', body: JSON.stringify(data ?? {}) }, headers);
const patch = (path, data, headers) => j(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }, headers);

console.log('Work item smoke @ ' + BASE);
const createdIds = [];
const tag = `${PREFIX}${Date.now().toString(36)}`; // unique smoke tag for isolation of the query set

// 1. Create (with a description so SUMMARY-strip is observable).
const created = await post('/api/work/items', {
  title: `${PREFIX}task-alpha`,
  description: 'Chi tiết nội bộ — chỉ FULL viewer thấy.',
  type: 'TASK',
  priority: 'HIGH',
  tags: [tag, 'alpha'],
  dimensions: { loai_viec: 'BUG', giai_doan: 'UAT', bo_phan: 'QA' },
});
ok(created.status === 201 || created.status === 200, 'POST /api/work/items 200/201');
const id = created.body?.id;
if (id) createdIds.push(id);
ok(!!id, `work item created (${id})`);
ok(created.body?.tier === 'FULL', `creator gets FULL tier (got ${created.body?.tier})`);
ok(created.body?.status === 'BACKLOG', `initial status BACKLOG (got ${created.body?.status})`);
ok(Array.isArray(created.body?.tags) && created.body.tags.includes(tag), 'tags persisted');
ok(created.body?.dimensions?.loai_viec === 'BUG', 'dimensions persisted (first-class)');

// 2. Assign via AssignmentResolver (ORG_UNIT_HEAD of ou-delivery) — snapshot, NOT hardcoded.
const assigned = await post(`/api/work/items/${id}/assign`, { selectorType: 'ORG_UNIT_HEAD', orgUnitId: 'ou-delivery' });
ok(assigned.status === 200 || assigned.status === 201, 'POST assign 200/201');
ok(assigned.body?.assignmentSnapshot?.via === 'assignment-resolver', `assignment routed via resolver (got ${assigned.body?.assignmentSnapshot?.via})`);
ok(Array.isArray(assigned.body?.assigneeIds) && assigned.body.assigneeIds.length >= 1, `resolver produced >=1 assignee (got ${assigned.body?.assigneeIds?.length})`);
ok(Array.isArray(assigned.body?.assignmentSnapshot?.resolvedPersonIds) && assigned.body.assignmentSnapshot.resolvedPersonIds.length >= 1, 'snapshot carries resolvedPersonIds from Org Core');

// 3. Status transitions. Illegal first (BACKLOG → DONE not allowed) → 400.
const badStatus = await post(`/api/work/items/${id}/status`, { to: 'DONE' });
ok(badStatus.status === 400, `illegal transition BACKLOG→DONE → 400 (got ${badStatus.status})`);
const s1 = await post(`/api/work/items/${id}/status`, { to: 'IN_PROGRESS' });
ok(s1.body?.status === 'IN_PROGRESS', `status → IN_PROGRESS (got ${s1.body?.status})`);
ok(!!s1.body?.actualStart, 'actualStart set on first IN_PROGRESS');

// 4. Progress.
const prog = await post(`/api/work/items/${id}/progress`, { progressPercent: 65 });
ok(prog.body?.progressPercent === 65, `progress set 65 (got ${prog.body?.progressPercent})`);

// 5. Comment + checklist (+toggle) + attachment round-trip.
const comment = await post(`/api/work/items/${id}/comment`, { body: 'Bình luận smoke' });
ok(comment.status === 200 || comment.status === 201, 'POST comment 200/201');
const chk = await post(`/api/work/items/${id}/checklist`, { label: 'Việc con checklist' });
ok(!!chk.body?.id, 'checklist item created');
const toggled = await post(`/api/work/items/${id}/checklist/${chk.body?.id}/toggle`, { done: true });
ok(toggled.body?.done === true, 'checklist item toggled done');
const att = await post(`/api/work/items/${id}/attachments`, { title: 'bien-ban.txt', content: 'noi dung' });
ok(att.status === 200 || att.status === 201, 'POST attachment 200/201');
ok(att.body?.document?.subjectType === 'WorkItem', `attachment subjectType=WorkItem (got ${att.body?.document?.subjectType})`);

// 6. Detail as OWNER → FULL (has description/comments/checklist/attachments).
const full = await j(`/api/work/items/${id}`);
ok(full.body?.item?.tier === 'FULL', `owner detail is FULL (got ${full.body?.item?.tier})`);
ok(full.body?.item?.description === 'Chi tiết nội bộ — chỉ FULL viewer thấy.', 'FULL carries description');
ok(Array.isArray(full.body?.comments) && full.body.comments.length >= 1, 'FULL carries comments');
ok(Array.isArray(full.body?.checklist) && full.body.checklist.length >= 1, 'FULL carries checklist');
ok(Array.isArray(full.body?.attachments) && full.body.attachments.some((a) => a.subjectType === 'WorkItem'), 'FULL carries attachments');

// 7. VISIBILITY (owner requirement #1): a summary-only viewer (unmapped, not
//    owner/assignee/creator, no work.view.full) gets SUMMARY with NO leak.
const summaryH = { ...H, 'x-user-id': 'usr-work-summary-smoke' };
const summ = await j(`/api/work/items/${id}`, {}, summaryH);
ok(summ.body?.item?.tier === 'SUMMARY', `summary viewer gets SUMMARY (got ${summ.body?.item?.tier})`);
ok(summ.body?.item?.title != null && summ.body?.item?.progressPercent != null, 'SUMMARY exposes title + progressPercent');
ok('dueAt' in (summ.body?.item ?? {}) && 'plannedStart' in (summ.body?.item ?? {}), 'SUMMARY exposes planned dates');
ok(!('description' in (summ.body?.item ?? {})), 'SUMMARY OMITS description (no leak)');
ok(summ.body?.comments === undefined, 'SUMMARY OMITS comments (no leak)');
ok(summ.body?.attachments === undefined, 'SUMMARY OMITS attachments (no leak)');
ok(summ.body?.children === undefined, 'SUMMARY OMITS children (no leak)');

// 8. Tag + dimension FILTER returns the correct subset. Seed 2 more items.
const beta = await post('/api/work/items', { title: `${PREFIX}task-beta`, tags: [tag, 'beta'], dimensions: { loai_viec: 'FEATURE', bo_phan: 'DEV' } });
if (beta.body?.id) createdIds.push(beta.body.id);
const gamma = await post('/api/work/items', { title: `${PREFIX}task-gamma`, tags: ['gamma'], dimensions: { loai_viec: 'BUG', bo_phan: 'DEV' } });
if (gamma.body?.id) createdIds.push(gamma.body.id);

const byTag = await j(`/api/work/items?tags=${tag}&pageSize=200`);
const tagSet = (byTag.body?.items ?? []).map((r) => r.id);
ok(tagSet.includes(id) && tagSet.includes(beta.body?.id) && !tagSet.includes(gamma.body?.id), `tag filter returns exactly the tagged subset (${tagSet.length})`);

const byDim = await j(`/api/work/items?dimensions=${encodeURIComponent(JSON.stringify({ loai_viec: 'BUG' }))}&tags=${tag}&pageSize=200`);
const dimIds = (byDim.body?.items ?? []).map((r) => r.id);
ok(dimIds.includes(id) && !dimIds.includes(beta.body?.id), `dimension filter (loai_viec=BUG) returns correct subset (${dimIds.length})`);

// 9. Tenant isolation: demo-isolation sees 0 xtech items.
const iso = await j('/api/work/items?pageSize=200', {}, { ...H, 'x-tenant-id': 'tenant-demo-isolation' });
const isoLeak = (iso.body?.items ?? []).filter((r) => (r.title || '').startsWith(PREFIX)).length;
ok(isoLeak === 0, `demo-isolation sees 0 xtech smoke items (got ${isoLeak})`);

// 10. Enforcement: a caller without work.item.create → 403 under x-authz-enforce.
const empH = { ...H, 'x-user-id': 'usr-employee-nobody-smoke', 'x-authz-enforce': 'true' };
const forbidden = await post('/api/work/items', { title: `${PREFIX}enforce` }, empH);
ok(forbidden.status === 403, `no work.item.create → 403 (got ${forbidden.status})`);

// ---- self-clean -----------------------------------------------------------
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  await c.query(
    `DELETE FROM "DocumentVersion" WHERE "documentId" IN (
       SELECT id FROM "RecordDocument" WHERE "subjectType"='WorkItem' AND "subjectId" = ANY($1::text[]))`,
    [createdIds],
  );
  await c.query(`DELETE FROM "RecordDocument" WHERE "subjectType"='WorkItem' AND "subjectId" = ANY($1::text[])`, [createdIds]);
  await c.query(`DELETE FROM "WorkItemEvent" WHERE "workItemId" = ANY($1::text[])`, [createdIds]);
  await c.query(`DELETE FROM "WorkItemComment" WHERE "workItemId" = ANY($1::text[])`, [createdIds]);
  await c.query(`DELETE FROM "WorkItemChecklistItem" WHERE "workItemId" = ANY($1::text[])`, [createdIds]);
  const del = await c.query(`DELETE FROM "NativeWorkItem" WHERE id = ANY($1::text[]) OR title LIKE $2`, [createdIds, `${PREFIX}%`]);
  await c.query('COMMIT');
  ok(del.rowCount >= createdIds.length, `smoke items cleaned (deleted ${del.rowCount})`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('  ✗ cleanup failed:', e.message);
  failed++;
} finally {
  await c.end();
}

const after = await j(`/api/work/items?q=${PREFIX}&pageSize=200`);
const residue = (after.body?.items ?? []).filter((r) => (r.title || '').startsWith(PREFIX)).length;
ok(residue === 0, `no smoke residue remains (got ${residue})`);

console.log(failed === 0 ? '\nWORK ITEM SMOKE PASSED' : `\nWORK ITEM SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
