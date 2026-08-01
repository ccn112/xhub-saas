// Requests smoke (PH-02a — NX-020..024). Self-resetting (creates fresh requests
// each run — no reset script needed). Server must be up on :4000.
// Run: npm run test:requests
//
// Asserts the full lifecycle: create DRAFT → submit (approver resolved via the
// engine assignment resolver, NOT hardcoded) → request-supplement → resubmit →
// approve (amount ABAC plumbed) → execute (MANUAL_TASK, no fake ERP doc) →
// evidence → DONE; illegal transition → 400; withdraw + cancel paths; a comment
// + an attachment (RecordDocument subjectType=Request) round-trip; tenant
// isolation (demo-isolation cannot see xtech requests); enforcement:
// non-approver approve → 403.
import 'dotenv/config';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const H = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const j = async (path, opts = {}, headers = H) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const post = (path, data, headers) => j(path, { method: 'POST', body: JSON.stringify(data ?? {}) }, headers);

console.log('Requests smoke @ ' + BASE);

// 1. Create DRAFT.
const created = await post('/api/requests', { title: 'Smoke — mua thiết bị', procedureCode: 'PILOT-01', amount: 15000000, summary: 'test' });
ok(created.status === 201 || created.status === 200, 'POST /api/requests 200/201');
const id = created.body?.id;
ok(!!id, `request created (${id})`);
ok(created.body?.state === 'DRAFT', `initial state DRAFT (got ${created.body?.state})`);

// 2. Illegal transition: approve a DRAFT → 400.
const badApprove = await post(`/api/requests/${id}/approve`, {});
ok(badApprove.status === 400, `approve from DRAFT rejected 400 (got ${badApprove.status})`);

// 3. Submit → approver resolved via the engine (assignment-resolver, not hardcoded).
const submitted = await post(`/api/requests/${id}/submit`, {});
ok(submitted.status === 201 || submitted.status === 200, 'POST submit 200/201');
ok(submitted.body?.request?.state === 'SUBMITTED', `state SUBMITTED (got ${submitted.body?.request?.state})`);
ok(!!submitted.body?.approver?.role, `approver role assigned via resolver (${submitted.body?.approver?.role})`);

// verify the submitted event carries the resolver provenance (not a hardcoded id)
const detail1 = await j(`/api/requests/${id}`);
const submitEvt = (detail1.body?.events ?? []).find((e) => e.type === 'submitted');
ok(submitEvt?.data?.assignment?.via === 'assignment-resolver', 'submit routed via assignment-resolver (provenance in event)');

// 4. request-supplement → resubmit.
const supp = await post(`/api/requests/${id}/request-supplement`, { note: 'cần báo giá' });
ok(supp.body?.request?.state === 'WAITING_SUPPLEMENT', `state WAITING_SUPPLEMENT (got ${supp.body?.request?.state})`);
const resub = await post(`/api/requests/${id}/resubmit`, {});
ok(resub.body?.request?.state === 'RESUBMITTED', `state RESUBMITTED (got ${resub.body?.request?.state})`);

// 5. approve (amount ABAC plumbed — user-nam=PLATFORM_ADMIN passes).
const appr = await post(`/api/requests/${id}/approve`, { note: 'ok' });
ok(appr.status === 200 || appr.status === 201, 'POST approve 200/201');
ok(appr.body?.request?.state === 'APPROVED', `state APPROVED (got ${appr.body?.request?.state})`);

// 6. execute → MANUAL_TASK ExternalExecution (no fake ERP doc).
const exec = await post(`/api/requests/${id}/execute`, { note: 'thực hiện thủ công' });
ok(exec.body?.request?.state === 'EXECUTING', `state EXECUTING (got ${exec.body?.request?.state})`);
const execId = exec.body?.externalExecution?.id;
ok(!!execId, `ExternalExecution created (${execId})`);
ok(exec.body?.externalExecution?.mode === 'MANUAL_TASK', `execution mode MANUAL_TASK (got ${exec.body?.externalExecution?.mode})`);
ok(exec.body?.externalExecution?.sourceRef == null, 'no fabricated sourceRef at execute time (no fake ERP doc)');

// 7. evidence → DONE (real reference + RecordDocument evidence).
const ev = await post(`/api/requests/${id}/execution/${execId}/evidence`, { referenceCode: 'MR-REAL-001', referenceSystem: 'FINERP', note: 'đã mua', evidence: 'hoa don PDF' });
ok(ev.body?.request?.state === 'DONE', `state DONE (got ${ev.body?.request?.state})`);
ok(ev.body?.externalExecution?.status === 'completed', 'execution completed');
ok(ev.body?.externalExecution?.referenceCode === 'MR-REAL-001', 'real reference code recorded');
ok(!!ev.body?.document?.id, `evidence RecordDocument created (${ev.body?.document?.id})`);

// 8. Illegal after terminal: submit a DONE → 400.
const badSubmit = await post(`/api/requests/${id}/submit`, {});
ok(badSubmit.status === 400, `submit from DONE rejected 400 (got ${badSubmit.status})`);

// 9. withdraw path (fresh request).
const r2 = await post('/api/requests', { title: 'Smoke — withdraw', procedureCode: 'PILOT-01' });
await post(`/api/requests/${r2.body.id}/submit`, {});
const wd = await post(`/api/requests/${r2.body.id}/withdraw`, {});
ok(wd.body?.request?.state === 'WITHDRAWN', `withdraw → WITHDRAWN (got ${wd.body?.request?.state})`);

// 10. cancel path (fresh DRAFT).
const r3 = await post('/api/requests', { title: 'Smoke — cancel', procedureCode: 'PILOT-01' });
const cx = await post(`/api/requests/${r3.body.id}/cancel`, {});
ok(cx.body?.request?.state === 'CANCELLED', `cancel → CANCELLED (got ${cx.body?.request?.state})`);

// 11. comment round-trip (with @mention extraction).
const cm = await post(`/api/requests/${id}/comments`, { body: 'Nhờ @user-thuha kiểm tra' });
ok(cm.status === 200 || cm.status === 201, 'POST comment 200/201');
ok((cm.body?.mentions ?? []).includes('user-thuha'), 'inline @mention extracted');
const detail2 = await j(`/api/requests/${id}`);
ok((detail2.body?.comments ?? []).some((c) => c.id === cm.body?.id), 'comment appears in detail');

// 12. attachment round-trip (RecordDocument subjectType=Request).
const at = await post(`/api/requests/${id}/attachments`, { title: 'Bao gia.pdf', content: 'noi dung bao gia', mimeType: 'text/plain' });
ok(at.status === 200 || at.status === 201, 'POST attachment 200/201');
ok(at.body?.document?.subjectType === 'Request', 'attachment subjectType=Request');
const detail3 = await j(`/api/requests/${id}`);
ok((detail3.body?.attachments ?? []).some((d) => d.id === at.body?.document?.id), 'attachment appears in detail (via records)');

// 13. list / seed presence: the 42 seeded requests are visible.
const listed = await j('/api/requests');
ok(Array.isArray(listed.body) && listed.body.length >= 42, `list returns >=42 requests (got ${listed.body?.length})`);

// 14. tenant isolation: demo-isolation must NOT see xtech requests.
const iso = await j('/api/requests', {}, { ...H, 'x-tenant-id': 'tenant-demo-isolation' });
const isoLeak = Array.isArray(iso.body) ? iso.body.filter((r) => r.tenantId === 'tenant-xtech').length : 0;
ok(isoLeak === 0, `demo-isolation sees 0 xtech requests (got ${isoLeak})`);

// 15. enforcement: a non-approver (EMPLOYEE) approve → 403 under x-authz-enforce.
const r4 = await post('/api/requests', { title: 'Smoke — enforce', procedureCode: 'PILOT-01' });
await post(`/api/requests/${r4.body.id}/submit`, {});
const empH = { ...H, 'x-user-id': 'usr-employee-smoke', 'x-authz-enforce': 'true' };
const forbidden = await post(`/api/requests/${r4.body.id}/approve`, {}, empH);
ok(forbidden.status === 403, `non-approver approve → 403 (got ${forbidden.status})`);

console.log(failed === 0 ? '\nREQUESTS SMOKE PASSED' : `\nREQUESTS SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
