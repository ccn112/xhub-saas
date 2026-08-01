// Announcements / read-acknowledgement smoke (PH-02e — NX-028). Server up on :4000.
// Run: npm run test:announcements
//
// Asserts the full lifecycle: create DRAFT (COMM_ADMIN) → publish (audience
// resolved into receipts, count asserted) → recipient read (readAt) → acknowledge
// (acknowledgedAt, requireAck) → report (delivered/read/acked counts + per-user
// list) → remind (bumps un-acknowledged) → archive; ALL-audience publish resolves
// to every tenant person; acknowledge on a non-requireAck announcement → 400;
// illegal transition (archive a DRAFT / double publish) → 400; list scopes
// (mine / for-me / all + state); tenant isolation (demo-isolation sees 0);
// enforcement: non-COMM_ADMIN create → 403. FULLY SELF-CLEANING: every smoke
// announcement (+ receipts / events / attachments) is deleted at the end via
// direct Postgres under RLS bypass, resolving residue by code prefix. The 6 seed
// announcements + their receipts are untouched.
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const H = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };
const PREFIX = 'ANN-SMOKE-';

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const j = async (path, opts = {}, headers = H) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const post = (path, data, headers) => j(path, { method: 'POST', body: JSON.stringify(data ?? {}) }, headers);

console.log('Announcements smoke @ ' + BASE);
const createdIds = [];

// 1. Create DRAFT — USER audience targeting the acting user (user-nam), requireAck.
const c1 = await post('/api/announcements', {
  code: `${PREFIX}${Date.now().toString(36).toUpperCase()}`,
  title: 'Smoke — thông báo cần xác nhận',
  body: 'Vui lòng đọc và xác nhận.',
  audienceType: 'USER',
  audienceId: 'user-nam',
  requireAck: true,
});
ok(c1.status === 200 || c1.status === 201, 'POST /api/announcements (DRAFT) 200/201');
const id = c1.body?.id;
if (id) createdIds.push(id);
ok(!!id, `announcement created (${id})`);
ok(c1.body?.state === 'DRAFT', `initial state DRAFT (got ${c1.body?.state})`);
ok(Array.isArray(c1.body?.legalActions) && c1.body.legalActions.includes('publish'), 'legalActions include publish');

// 2. Illegal transition: archive a DRAFT → 400.
const badArchive = await post(`/api/announcements/${id}/archive`, {});
ok(badArchive.status === 400, `archive from DRAFT rejected 400 (got ${badArchive.status})`);

// 3. Recipient read BEFORE publish → 400 (no receipt yet).
const earlyRead = await post(`/api/announcements/${id}/read`, {});
ok(earlyRead.status === 400, `read before publish rejected 400 (got ${earlyRead.status})`);

// 4. Publish → PUBLISHED, audience resolved to 1 receipt (the targeted user).
const pub = await post(`/api/announcements/${id}/publish`, {});
ok(pub.status === 200 || pub.status === 201, 'POST publish 200/201');
ok(pub.body?.announcement?.state === 'PUBLISHED', `state PUBLISHED (got ${pub.body?.announcement?.state})`);
ok(pub.body?.recipients === 1, `USER audience resolved to 1 recipient (got ${pub.body?.recipients})`);
ok(pub.body?.receiptsCreated === 1, `1 receipt created (got ${pub.body?.receiptsCreated})`);

// 5. Double publish → 400 (illegal from PUBLISHED).
const doublePub = await post(`/api/announcements/${id}/publish`, {});
ok(doublePub.status === 400, `double publish rejected 400 (got ${doublePub.status})`);

// 6. Recipient read → readAt stamped.
const read = await post(`/api/announcements/${id}/read`, {});
ok(read.body?.ok === true && !!read.body?.receipt?.readAt, 'read stamps readAt');

// 7. Acknowledge → acknowledgedAt stamped (requireAck).
const ack = await post(`/api/announcements/${id}/acknowledge`, {});
ok(ack.body?.ok === true && !!ack.body?.receipt?.acknowledgedAt, 'acknowledge stamps acknowledgedAt');

// 8. Report → delivered/read/acked = 1/1/1.
const rep = await j(`/api/announcements/${id}/report`);
ok(rep.body?.counts?.delivered === 1, `report delivered=1 (got ${rep.body?.counts?.delivered})`);
ok(rep.body?.counts?.read === 1, `report read=1 (got ${rep.body?.counts?.read})`);
ok(rep.body?.counts?.acknowledged === 1, `report acknowledged=1 (got ${rep.body?.counts?.acknowledged})`);
ok(Array.isArray(rep.body?.recipients) && rep.body.recipients.length === 1, 'report has per-user list');

// 9. Remind → 0 un-acknowledged remain (already acked).
const remind0 = await post(`/api/announcements/${id}/remind`, {});
ok(remind0.body?.reminded === 0, `remind after ack reminds 0 (got ${remind0.body?.reminded})`);
ok(remind0.body?.mock === true, 'remind is a mock (no real push/email)');

// 10. Detail carries report + myReceipt + events + attachments.
const detail = await j(`/api/announcements/${id}`);
ok(detail.body?.report?.counts?.acknowledged === 1, 'detail carries the read/ack report');
ok(detail.body?.myReceipt && !!detail.body.myReceipt.acknowledgedAt, 'detail carries myReceipt (acked)');
ok((detail.body?.events ?? []).some((e) => e.type === 'publish'), 'timeline has publish event');

// 11. Comment + attachment (RecordDocument subjectType=Announcement) round-trip.
const cm = await post(`/api/announcements/${id}/comment`, { body: 'ghi chú nội bộ' });
ok(cm.body?.ok === true, 'comment recorded');
const att = await post(`/api/announcements/${id}/attachments`, { title: 'policy.txt', note: 'chính sách', content: 'noi dung' });
ok(att.body?.document?.subjectType === 'Announcement', `attachment subjectType=Announcement (got ${att.body?.document?.subjectType})`);
const detail2 = await j(`/api/announcements/${id}`);
ok((detail2.body?.attachments ?? []).some((d) => d.id === att.body?.document?.id), 'attachment appears in detail');

// 12. Archive → ARCHIVED.
const arch = await post(`/api/announcements/${id}/archive`, {});
ok(arch.body?.announcement?.state === 'ARCHIVED', `state ARCHIVED (got ${arch.body?.announcement?.state})`);

// 13. ALL-audience publish → resolves to every tenant person; remind bumps un-read.
const cAll = await post('/api/announcements', {
  code: `${PREFIX}ALL-${Date.now().toString(36).toUpperCase()}`,
  title: 'Smoke — toàn công ty',
  audienceType: 'ALL',
  requireAck: false,
});
if (cAll.body?.id) createdIds.push(cAll.body.id);
const pubAll = await post(`/api/announcements/${cAll.body?.id}/publish`, {});
ok(pubAll.body?.recipients >= 1, `ALL audience resolved to >=1 recipient (got ${pubAll.body?.recipients})`);
const bypassAckAll = await post(`/api/announcements/${cAll.body?.id}/acknowledge`, {});
ok(bypassAckAll.status === 400, `acknowledge on non-requireAck announcement → 400 (got ${bypassAckAll.status})`);
const remindAll = await post(`/api/announcements/${cAll.body?.id}/remind`, {});
ok(remindAll.body?.reminded >= 1, `remind (un-read basis) bumps >=1 (got ${remindAll.body?.reminded})`);

// 14. List scopes + filters.
const mine = await j('/api/announcements?scope=mine&pageSize=200');
ok(Array.isArray(mine.body?.items) && mine.body.items.some((a) => a.id === id), 'scope=mine contains authored announcement');
const forMe = await j('/api/announcements?scope=for-me&pageSize=200');
ok(Array.isArray(forMe.body?.items) && forMe.body.items.some((a) => a.id === id), 'scope=for-me contains announcement with my receipt');
const byState = await j('/api/announcements?state=ARCHIVED&pageSize=200');
ok(Array.isArray(byState.body?.items) && byState.body.items.every((a) => a.state === 'ARCHIVED'), 'state filter returns only ARCHIVED');

// 15. Tenant isolation.
const iso = await j('/api/announcements?pageSize=200', {}, { ...H, 'x-tenant-id': 'tenant-demo-isolation' });
const isoLeak = Array.isArray(iso.body?.items) ? iso.body.items.filter((r) => r.tenantId === 'tenant-xtech').length : 0;
ok(isoLeak === 0, `demo-isolation sees 0 xtech announcements (got ${isoLeak})`);

// 16. Enforcement: non-COMM_ADMIN create → 403.
const empH = { ...H, 'x-user-id': 'usr-employee-smoke', 'x-authz-enforce': 'true' };
const forbid = await post('/api/announcements', { title: 'Smoke — cấm', audienceType: 'ALL' }, empH);
ok(forbid.status === 403, `non-COMM_ADMIN create → 403 (got ${forbid.status})`);

// ---- self-clean: delete every smoke announcement + children -----------------
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  const idRows = await c.query(`SELECT id FROM "Announcement" WHERE id = ANY($1::text[]) OR code LIKE $2`, [createdIds, `${PREFIX}%`]);
  const allSmokeIds = [...new Set([...createdIds, ...idRows.rows.map((r) => r.id)])];
  await c.query(
    `DELETE FROM "DocumentVersion" WHERE "documentId" IN (
       SELECT id FROM "RecordDocument" WHERE "subjectType"='Announcement' AND "subjectId" = ANY($1::text[]))`,
    [allSmokeIds],
  );
  await c.query(`DELETE FROM "RecordDocument" WHERE "subjectType"='Announcement' AND "subjectId" = ANY($1::text[])`, [allSmokeIds]);
  await c.query(`DELETE FROM "AnnouncementReceipt" WHERE "announcementId" = ANY($1::text[])`, [allSmokeIds]);
  await c.query(`DELETE FROM "AnnouncementEvent" WHERE "announcementId" = ANY($1::text[])`, [allSmokeIds]);
  const del = await c.query(`DELETE FROM "Announcement" WHERE id = ANY($1::text[])`, [allSmokeIds]);
  await c.query('COMMIT');
  ok(del.rowCount >= createdIds.length, `smoke announcements cleaned (deleted ${del.rowCount})`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('  ✗ cleanup failed:', e.message);
  failed++;
} finally {
  await c.end();
}

// verify no residue + seed data intact (6 announcements remain).
const after = await j('/api/announcements?scope=all&pageSize=500');
const residue = Array.isArray(after.body?.items) ? after.body.items.filter((a) => (a.code || '').startsWith(PREFIX)).length : 0;
ok(residue === 0, `no smoke announcement residue remains (got ${residue})`);
const seedRemain = Array.isArray(after.body?.items) ? after.body.items.filter((a) => (a.code || '').startsWith('ANN-2026-')).length : 0;
ok(seedRemain === 6, `6 seed announcements intact (got ${seedRemain})`);

console.log(failed === 0 ? '\nANNOUNCEMENTS SMOKE PASSED' : `\nANNOUNCEMENTS SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
