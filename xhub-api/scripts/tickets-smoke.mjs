// Tickets / Service Desk smoke (PH-02c — NX-026). Server must be up on :4000.
// Run: npm run test:tickets
//
// Asserts the full lifecycle: create (SLA computed from catalog defaultSlaHours)
// → triage → assign (agent routed via the shared AssignmentResolver queue /
// SERVICE_DESK_AGENT role, provenance asserted — NOT hardcoded) → start →
// pending-requester → resume(in-progress) → resolve → CSAT (requester score) →
// close; illegal transition → 400; SLA overdue computed; comment (public/private)
// + attachment RecordDocument (subjectType=Ticket) round-trip; claim (agent
// self-assign); list scopes/filters; tenant isolation (demo-isolation sees 0);
// enforcement: non-manager assign → 403 (ticket.manage), non-resolver resolve →
// 403 (ticket.resolve). FULLY SELF-CLEANING: every smoke-created ticket (+ events
// /attachments) and the smoke catalog item are deleted at the end via direct
// Postgres under RLS bypass. The 15 seed tickets + catalog seeds are untouched.
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const H = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };
const TICKET_PREFIX = 'TKS-SMOKE-';
const CAT_PREFIX = 'SMOKE-';

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const j = async (path, opts = {}, headers = H) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const post = (path, data, headers) => j(path, { method: 'POST', body: JSON.stringify(data ?? {}) }, headers);

console.log('Tickets smoke @ ' + BASE);
const createdTicketIds = [];
const createdCatCodes = [];

// 0. Service catalog: create a smoke catalog item (SLA 4h) via POST.
const catCode = `${CAT_PREFIX}${Date.now().toString(36).toUpperCase()}`;
createdCatCodes.push(catCode);
const cat = await post('/api/service-catalog', { code: catCode, name: 'Smoke — dịch vụ hỗ trợ', category: 'ACCESS', defaultSlaHours: 4, description: 'smoke' });
ok(cat.status === 200 || cat.status === 201, 'POST /api/service-catalog 200/201');
const catId = cat.body?.id;
ok(!!catId, `catalog item created (${catId})`);
const catList = await j('/api/service-catalog');
ok(Array.isArray(catList.body?.items) && catList.body.items.some((c) => c.id === catId), 'catalog item appears in list');

// 1. Create ticket against the catalog item → SLA computed from defaultSlaHours.
const created = await post('/api/tickets', { code: `${TICKET_PREFIX}${Date.now().toString(36)}`, title: 'Smoke — không truy cập được hệ thống', description: 'chi tiết', catalogItemId: catId, priority: 'HIGH' });
ok(created.status === 201 || created.status === 200, 'POST /api/tickets 200/201');
const id = created.body?.id;
if (id) createdTicketIds.push(id);
ok(!!id, `ticket created (${id})`);
ok(created.body?.state === 'NEW', `initial state NEW (got ${created.body?.state})`);
ok(created.body?.category === 'ACCESS', `category derived from catalog (got ${created.body?.category})`);
ok(!!created.body?.slaDueAt, 'slaDueAt computed from catalog defaultSlaHours');
const slaAheadHours = (new Date(created.body?.slaDueAt).getTime() - Date.now()) / 3600000;
ok(slaAheadHours > 3.5 && slaAheadHours < 4.5, `slaDueAt ≈ now + 4h (got ${slaAheadHours.toFixed(2)}h)`);
ok(created.body?.overdue === false, `fresh ticket not overdue (got ${created.body?.overdue})`);

// 2. Illegal transition: resolve a NEW ticket → 400.
const badResolve = await post(`/api/tickets/${id}/resolve`, {});
ok(badResolve.status === 400, `resolve from NEW rejected 400 (got ${badResolve.status})`);

// 3. triage → TRIAGED.
const triage = await post(`/api/tickets/${id}/triage`, {});
ok(triage.body?.ticket?.state === 'TRIAGED', `state TRIAGED (got ${triage.body?.ticket?.state})`);

// 4. assign → agent routed via resolver queue (provenance, NOT hardcoded).
const assign = await post(`/api/tickets/${id}/assign`, { assigneeId: 'usr-it-support' });
ok(assign.status === 200 || assign.status === 201, 'POST assign 200/201');
ok(assign.body?.ticket?.state === 'ASSIGNED', `state ASSIGNED (got ${assign.body?.ticket?.state})`);
ok(assign.body?.ticket?.assigneeId === 'usr-it-support', `assignee set (got ${assign.body?.ticket?.assigneeId})`);
ok((assign.body?.provenance?.via || '').startsWith('assignment-resolver'), `assignment routed via '${assign.body?.provenance?.via}' (not hardcoded)`);
ok(assign.body?.provenance?.roleCode === 'SERVICE_DESK_AGENT', 'provenance carries SERVICE_DESK_AGENT queue role');
const detailAssign = await j(`/api/tickets/${id}`);
const assignEvt = (detailAssign.body?.events ?? []).find((e) => e.type === 'assign');
ok(!!assignEvt?.data?.assignment?.via, 'assign provenance recorded in timeline event');

// 5. start → IN_PROGRESS.
const start = await post(`/api/tickets/${id}/start`, {});
ok(start.body?.ticket?.state === 'IN_PROGRESS', `state IN_PROGRESS (got ${start.body?.ticket?.state})`);

// 6. pending-requester ⇄ in-progress.
const pending = await post(`/api/tickets/${id}/pending`, { note: 'chờ user cung cấp thông tin' });
ok(pending.body?.ticket?.state === 'PENDING_REQUESTER', `state PENDING_REQUESTER (got ${pending.body?.ticket?.state})`);
const resume = await post(`/api/tickets/${id}/resume`, {});
ok(resume.body?.ticket?.state === 'IN_PROGRESS', `back to IN_PROGRESS after resume (got ${resume.body?.ticket?.state})`);

// 7. comment (public + private note).
const cPub = await post(`/api/tickets/${id}/comment`, { body: 'ghi chú công khai', visibility: 'PUBLIC' });
ok(cPub.body?.ok === true && cPub.body?.visibility === 'PUBLIC', 'public comment recorded');
const cPriv = await post(`/api/tickets/${id}/comment`, { body: 'ghi chú nội bộ', visibility: 'PRIVATE' });
ok(cPriv.body?.visibility === 'PRIVATE', 'private comment recorded');

// 8. attachment → RecordDocument subjectType=Ticket round-trip.
const att = await post(`/api/tickets/${id}/attachments`, { title: 'log.txt', note: 'nhật ký lỗi', content: 'noi dung log' });
ok(att.status === 200 || att.status === 201, 'POST attachment 200/201');
ok(att.body?.document?.subjectType === 'Ticket', `attachment subjectType=Ticket (got ${att.body?.document?.subjectType})`);
const detailAtt = await j(`/api/tickets/${id}`);
ok((detailAtt.body?.attachments ?? []).some((d) => d.id === att.body?.document?.id), 'attachment appears in detail (via records)');
ok((detailAtt.body?.events ?? []).some((e) => e.type === 'comment' && e.data?.visibility === 'PRIVATE'), 'private note present in timeline');

// 9. resolve → RESOLVED.
const resolve = await post(`/api/tickets/${id}/resolve`, { note: 'đã xử lý' });
ok(resolve.body?.ticket?.state === 'RESOLVED', `state RESOLVED (got ${resolve.body?.ticket?.state})`);
ok(!!resolve.body?.ticket?.resolvedAt, 'resolvedAt stamped');

// 10. CSAT: bad score rejected; non-requester forbidden; requester score stored.
const badCsat = await post(`/api/tickets/${id}/csat`, { score: 6 });
ok(badCsat.status === 400, `CSAT score 6 rejected 400 (got ${badCsat.status})`);
const foreignCsat = await post(`/api/tickets/${id}/csat`, { score: 5 }, { ...H, 'x-user-id': 'usr-someone-else' });
ok(foreignCsat.status === 403, `non-requester CSAT rejected 403 (got ${foreignCsat.status})`);
const csat = await post(`/api/tickets/${id}/csat`, { score: 5, comment: 'hài lòng' });
ok(csat.body?.ticket?.csatScore === 5, `CSAT score stored (got ${csat.body?.ticket?.csatScore})`);

// 11. close → CLOSED; illegal after terminal.
const close = await post(`/api/tickets/${id}/close`, {});
ok(close.body?.ticket?.state === 'CLOSED', `state CLOSED (got ${close.body?.ticket?.state})`);
const badClose = await post(`/api/tickets/${id}/close`, {});
ok(badClose.status === 400, `close from CLOSED rejected 400 (got ${badClose.status})`);

// 12. SLA overdue computed: catalog SLA 0h → ticket immediately overdue.
const cat0Code = `${CAT_PREFIX}0-${Date.now().toString(36).toUpperCase()}`;
createdCatCodes.push(cat0Code);
const cat0 = await post('/api/service-catalog', { code: cat0Code, name: 'Smoke — SLA 0', category: 'NETWORK', defaultSlaHours: 0 });
const t2 = await post('/api/tickets', { code: `${TICKET_PREFIX}OD-${Date.now().toString(36)}`, title: 'Smoke — quá hạn', catalogItemId: cat0.body?.id });
if (t2.body?.id) createdTicketIds.push(t2.body.id);
const t2detail = await j(`/api/tickets/${t2.body?.id}`);
ok(t2detail.body?.ticket?.overdue === true, `SLA overdue computed true for 0h-SLA ticket (got ${t2detail.body?.ticket?.overdue})`);

// 13. claim (agent self-assign).
const t3 = await post('/api/tickets', { code: `${TICKET_PREFIX}CL-${Date.now().toString(36)}`, title: 'Smoke — claim', category: 'DEVICE' });
if (t3.body?.id) createdTicketIds.push(t3.body.id);
const claim = await post(`/api/tickets/${t3.body?.id}/claim`, {}, { ...H, 'x-user-id': 'usr-it-support' });
ok(claim.body?.ticket?.state === 'ASSIGNED', `claim → ASSIGNED (got ${claim.body?.ticket?.state})`);
ok(claim.body?.ticket?.assigneeId === 'usr-it-support', `claim self-assigns acting agent (got ${claim.body?.ticket?.assigneeId})`);

// 14. list scopes + filters.
const mine = await j('/api/tickets?scope=mine&pageSize=100');
ok(Array.isArray(mine.body?.items) && mine.body.items.some((t) => t.id === id), 'scope=mine contains requester ticket');
const assigned = await j('/api/tickets?scope=assigned&pageSize=100', {}, { ...H, 'x-user-id': 'usr-it-support' });
ok(Array.isArray(assigned.body?.items) && assigned.body.items.some((t) => t.id === t3.body?.id), 'scope=assigned (agent) contains claimed ticket');
const queue = await j('/api/tickets?scope=queue&pageSize=100');
ok(Array.isArray(queue.body?.items) && queue.body.items.every((t) => t.assigneeId == null), 'scope=queue returns only unassigned');
const byCat = await j('/api/tickets?category=DEVICE&pageSize=100');
ok(Array.isArray(byCat.body?.items) && byCat.body.items.every((t) => t.category === 'DEVICE'), 'category filter returns only DEVICE');
const byState = await j('/api/tickets?state=CLOSED&pageSize=100');
ok(Array.isArray(byState.body?.items) && byState.body.items.every((t) => t.state === 'CLOSED'), 'state filter returns only CLOSED');

// 15. tenant isolation.
const iso = await j('/api/tickets', {}, { ...H, 'x-tenant-id': 'tenant-demo-isolation' });
const isoLeak = Array.isArray(iso.body?.items) ? iso.body.items.filter((r) => r.tenantId === 'tenant-xtech').length : 0;
ok(isoLeak === 0, `demo-isolation sees 0 xtech tickets (got ${isoLeak})`);

// 16. enforcement: non-manager assign → 403; non-resolver resolve → 403.
const empH = { ...H, 'x-user-id': 'usr-employee-smoke', 'x-authz-enforce': 'true' };
const t4 = await post('/api/tickets', { code: `${TICKET_PREFIX}EN-${Date.now().toString(36)}`, title: 'Smoke — enforce', category: 'ACCESS' });
if (t4.body?.id) createdTicketIds.push(t4.body.id);
const forbidAssign = await post(`/api/tickets/${t4.body?.id}/assign`, { assigneeId: 'usr-it-support' }, empH);
ok(forbidAssign.status === 403, `non-manager assign → 403 (got ${forbidAssign.status})`);
const forbidResolve = await post(`/api/tickets/${t4.body?.id}/resolve`, {}, empH);
ok(forbidResolve.status === 403, `non-resolver resolve → 403 (got ${forbidResolve.status})`);

// ---- self-clean: delete every smoke ticket + children + smoke catalog -------
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  // Resolve the FULL set of smoke ticket ids first — this run's created ids PLUS
  // any residue from earlier interrupted runs (matched by code prefix) — so we
  // delete every child row before removing the tickets (TicketEvent FK is
  // RESTRICT). Deleting only createdTicketIds would leak residue and trip the FK.
  const idRows = await c.query(`SELECT id FROM "Ticket" WHERE id = ANY($1::text[]) OR code LIKE $2`, [createdTicketIds, `${TICKET_PREFIX}%`]);
  const allSmokeTicketIds = [...new Set([...createdTicketIds, ...idRows.rows.map((r) => r.id)])];
  await c.query(
    `DELETE FROM "DocumentVersion" WHERE "documentId" IN (
       SELECT id FROM "RecordDocument" WHERE "subjectType"='Ticket' AND "subjectId" = ANY($1::text[]))`,
    [allSmokeTicketIds],
  );
  await c.query(`DELETE FROM "RecordDocument" WHERE "subjectType"='Ticket' AND "subjectId" = ANY($1::text[])`, [allSmokeTicketIds]);
  await c.query(`DELETE FROM "TicketEvent" WHERE "ticketId" = ANY($1::text[])`, [allSmokeTicketIds]);
  const del = await c.query(`DELETE FROM "Ticket" WHERE id = ANY($1::text[])`, [allSmokeTicketIds]);
  const delCat = await c.query(`DELETE FROM "ServiceCatalogItem" WHERE code LIKE $1`, [`${CAT_PREFIX}%`]);
  await c.query('COMMIT');
  ok(del.rowCount >= createdTicketIds.length, `smoke tickets cleaned (deleted ${del.rowCount})`);
  ok(delCat.rowCount >= createdCatCodes.length, `smoke catalog cleaned (deleted ${delCat.rowCount})`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('  ✗ cleanup failed:', e.message);
  failed++;
} finally {
  await c.end();
}

// verify no residue + seed data intact (15 tickets + 5 catalog remain).
const after = await j('/api/tickets?scope=all&pageSize=200');
const residue = Array.isArray(after.body?.items) ? after.body.items.filter((t) => (t.code || '').startsWith(TICKET_PREFIX)).length : 0;
ok(residue === 0, `no smoke ticket residue remains (got ${residue})`);
const seedRemain = Array.isArray(after.body?.items) ? after.body.items.filter((t) => (t.code || '').startsWith('IT-2026-')).length : 0;
ok(seedRemain === 15, `15 seed tickets intact (got ${seedRemain})`);
const catAfter = await j('/api/service-catalog');
const catResidue = Array.isArray(catAfter.body?.items) ? catAfter.body.items.filter((c) => (c.code || '').startsWith(CAT_PREFIX)).length : 0;
ok(catResidue === 0, `no smoke catalog residue (got ${catResidue})`);
const catSeedRemain = Array.isArray(catAfter.body?.items) ? catAfter.body.items.filter((c) => ['ACCESS', 'DEVICE', 'NETWORK', 'APPLICATION', 'SECURITY'].includes(c.code)).length : 0;
ok(catSeedRemain === 5, `5 seed catalog items intact (got ${catSeedRemain})`);

console.log(failed === 0 ? '\nTICKETS SMOKE PASSED' : `\nTICKETS SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
