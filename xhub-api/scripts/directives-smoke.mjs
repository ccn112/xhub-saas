// Directives smoke (PH-02b — NX-025). Server must be up on :4000.
// Run: npm run test:directives
//
// Asserts the full lifecycle: create DRAFT → issue (audience ORG_UNIT resolved
// into DirectiveAssignments via the Org Core / assignment-resolver, provenance
// asserted — NOT hardcoded) → assignee acknowledge → start → submit → issuer
// return → resubmit(start→submit) → accept → complete; illegal transition → 400;
// SLA/overdue computed; evidence RecordDocument (subjectType=Directive)
// round-trip; tenant isolation (demo-isolation sees 0); enforcement: a
// non-executive issue → 403 (directive.issue). FULLY SELF-CLEANING: every
// smoke-created directive (+ assignments/events/evidence docs) is deleted at the
// end via direct Postgres under RLS bypass.
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const H = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };
const SMOKE_PREFIX = 'DIR-SMOKE-';

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const j = async (path, opts = {}, headers = H) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const post = (path, data, headers) => j(path, { method: 'POST', body: JSON.stringify(data ?? {}) }, headers);

console.log('Directives smoke @ ' + BASE);
const createdIds = [];

// 1. Create DRAFT (audience = whole TECH org unit; overdue due date in the past).
const pastDue = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
const created = await post('/api/directives', {
  code: `${SMOKE_PREFIX}${Date.now().toString(36)}`,
  title: 'Smoke — chỉ đạo hoàn thiện tài liệu',
  body: 'Nội dung chỉ đạo',
  audienceType: 'ORG_UNIT',
  audienceId: 'ou-tech',
  priority: 'HIGH',
  dueAt: pastDue,
});
ok(created.status === 201 || created.status === 200, 'POST /api/directives 200/201');
const id = created.body?.id;
if (id) createdIds.push(id);
ok(!!id, `directive created (${id})`);
ok(created.body?.state === 'DRAFT', `initial state DRAFT (got ${created.body?.state})`);

// 2. Illegal transition: complete a DRAFT is legal, but acknowledge before issue → 400 path;
//    assert issuing twice / commitment before assignments. First: try accept a nonexistent assignment path via illegal directive transition (progress on DRAFT is not exposed) — instead assert issue-from-non-draft after issuing.

// 3. Issue → audience resolved into assignments (provenance, NOT hardcoded).
const issued = await post(`/api/directives/${id}/issue`, {});
ok(issued.status === 201 || issued.status === 200, 'POST issue 200/201');
ok(issued.body?.directive?.state === 'ISSUED', `state ISSUED (got ${issued.body?.directive?.state})`);
const assignments = issued.body?.assignments ?? [];
ok(assignments.length >= 1, `audience resolved to >=1 assignment (got ${assignments.length})`);
ok(issued.body?.provenance?.via && issued.body?.provenance?.via !== 'hardcoded', `assignments routed via '${issued.body?.provenance?.via}' (not hardcoded)`);
ok(Array.isArray(issued.body?.provenance?.resolvedPersonIds) && issued.body.provenance.resolvedPersonIds.length >= 1, 'provenance carries resolvedPersonIds from Org Core');

// verify the issued event carries the resolver/org-core provenance
const detail1 = await j(`/api/directives/${id}`);
const issueEvt = (detail1.body?.events ?? []).find((e) => e.type === 'issued');
ok(!!issueEvt?.data?.assignment?.via, 'issue provenance recorded in timeline event');
ok(detail1.body?.directive?.overdue === true, `SLA overdue computed true for past-due directive (got ${detail1.body?.directive?.overdue})`);

// 3b. Illegal: issue again from ISSUED → 400.
const badIssue = await post(`/api/directives/${id}/issue`, {});
ok(badIssue.status === 400, `re-issue from ISSUED rejected 400 (got ${badIssue.status})`);

// 4. Commitment lifecycle on the first assignment.
const aid = assignments[0]?.id;
ok(!!aid, `first assignment id (${aid})`);

// illegal: submit before acknowledge/start → 400.
const badSubmit = await post(`/api/directives/${id}/assignments/${aid}/submit`, {});
ok(badSubmit.status === 400, `submit from ASSIGNED rejected 400 (got ${badSubmit.status})`);

const ack = await post(`/api/directives/${id}/assignments/${aid}/acknowledge`, {});
ok(ack.body?.assignment?.state === 'ACKNOWLEDGED', `commitment ACKNOWLEDGED (got ${ack.body?.assignment?.state})`);

// acknowledging moves directive ISSUED → IN_PROGRESS.
const detail2 = await j(`/api/directives/${id}`);
ok(detail2.body?.directive?.state === 'IN_PROGRESS', `directive IN_PROGRESS after first commitment activity (got ${detail2.body?.directive?.state})`);

const start = await post(`/api/directives/${id}/assignments/${aid}/start`, { progress: 40 });
ok(start.body?.assignment?.state === 'IN_PROGRESS', `commitment IN_PROGRESS (got ${start.body?.assignment?.state})`);

const submit = await post(`/api/directives/${id}/assignments/${aid}/submit`, { note: 'đã xong phần 1' });
ok(submit.body?.assignment?.state === 'SUBMITTED', `commitment SUBMITTED (got ${submit.body?.assignment?.state})`);

// 5. issuer returns → rework loop → resubmit.
const ret = await post(`/api/directives/${id}/assignments/${aid}/return`, { note: 'cần bổ sung' });
ok(ret.body?.assignment?.state === 'RETURNED', `commitment RETURNED (got ${ret.body?.assignment?.state})`);
const restart = await post(`/api/directives/${id}/assignments/${aid}/start`, {});
ok(restart.body?.assignment?.state === 'IN_PROGRESS', `commitment back to IN_PROGRESS after return (got ${restart.body?.assignment?.state})`);
const resubmit = await post(`/api/directives/${id}/assignments/${aid}/submit`, {});
ok(resubmit.body?.assignment?.state === 'SUBMITTED', `commitment re-SUBMITTED (got ${resubmit.body?.assignment?.state})`);

// 6. issuer accepts.
const accept = await post(`/api/directives/${id}/assignments/${aid}/accept`, {});
ok(accept.body?.assignment?.state === 'ACCEPTED', `commitment ACCEPTED (got ${accept.body?.assignment?.state})`);
ok(accept.body?.assignment?.progress === 100, `accepted commitment progress=100 (got ${accept.body?.assignment?.progress})`);

// 7. evidence RecordDocument round-trip (subjectType=Directive).
const ev = await post(`/api/directives/${id}/evidence`, { title: 'Bien ban.pdf', note: 'bằng chứng hoàn thành', content: 'noi dung bien ban', assignmentId: aid });
ok(ev.status === 200 || ev.status === 201, 'POST evidence 200/201');
ok(ev.body?.document?.subjectType === 'Directive', `evidence subjectType=Directive (got ${ev.body?.document?.subjectType})`);
const detail3 = await j(`/api/directives/${id}`);
ok((detail3.body?.evidence ?? []).some((d) => d.id === ev.body?.document?.id), 'evidence appears in detail (via records)');

// 8. complete the directive.
const complete = await post(`/api/directives/${id}/complete`, { note: 'hoàn tất' });
ok(complete.body?.directive?.state === 'COMPLETED', `directive COMPLETED (got ${complete.body?.directive?.state})`);
// illegal after terminal: issue a COMPLETED → 400.
const badComplete = await post(`/api/directives/${id}/complete`, {});
ok(badComplete.status === 400, `complete from COMPLETED rejected 400 (got ${badComplete.status})`);

// 9. list: issued-by-me + assigned filters.
const listMine = await j('/api/directives?scope=issued');
ok(Array.isArray(listMine.body?.items) && listMine.body.items.some((d) => d.id === id), 'issued-by-me list contains the directive');
const listState = await j('/api/directives?state=COMPLETED');
ok(Array.isArray(listState.body?.items) && listState.body.items.every((d) => d.state === 'COMPLETED'), 'state filter returns only COMPLETED');

// 10. tenant isolation: demo-isolation must NOT see xtech directives.
const iso = await j('/api/directives', {}, { ...H, 'x-tenant-id': 'tenant-demo-isolation' });
const isoLeak = Array.isArray(iso.body?.items) ? iso.body.items.filter((r) => r.tenantId === 'tenant-xtech').length : 0;
ok(isoLeak === 0, `demo-isolation sees 0 xtech directives (got ${isoLeak})`);

// 11. enforcement: a non-executive (no directive.issue) create → 403 under x-authz-enforce.
const empH = { ...H, 'x-user-id': 'usr-employee-smoke', 'x-authz-enforce': 'true' };
const forbidden = await post('/api/directives', { title: 'Smoke — enforce', audienceType: 'ORG_UNIT', audienceId: 'ou-tech' }, empH);
ok(forbidden.status === 403, `non-executive issue → 403 (got ${forbidden.status})`);

// ---- self-clean: delete every smoke-created directive + children ----------
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  // Evidence RecordDocuments attached to smoke directives (+ their versions).
  await c.query(
    `DELETE FROM "DocumentVersion" WHERE "documentId" IN (
       SELECT id FROM "RecordDocument" WHERE "subjectType"='Directive' AND "subjectId" = ANY($1::text[]))`,
    [createdIds],
  );
  await c.query(
    `DELETE FROM "RecordDocument" WHERE "subjectType"='Directive' AND "subjectId" = ANY($1::text[])`,
    [createdIds],
  );
  await c.query(`DELETE FROM "DirectiveEvent" WHERE "directiveId" = ANY($1::text[])`, [createdIds]);
  await c.query(`DELETE FROM "DirectiveAssignment" WHERE "directiveId" = ANY($1::text[])`, [createdIds]);
  const del = await c.query(`DELETE FROM "Directive" WHERE id = ANY($1::text[]) OR code LIKE $2`, [createdIds, `${SMOKE_PREFIX}%`]);
  await c.query('COMMIT');
  ok(del.rowCount >= createdIds.length, `smoke directives cleaned (deleted ${del.rowCount})`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('  ✗ cleanup failed:', e.message);
  failed++;
} finally {
  await c.end();
}

// verify nothing left behind
const after = await j('/api/directives?scope=issued&pageSize=100');
const residue = Array.isArray(after.body?.items) ? after.body.items.filter((d) => (d.code || '').startsWith(SMOKE_PREFIX)).length : 0;
ok(residue === 0, `no smoke residue remains (got ${residue})`);

console.log(failed === 0 ? '\nDIRECTIVES SMOKE PASSED' : `\nDIRECTIVES SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
