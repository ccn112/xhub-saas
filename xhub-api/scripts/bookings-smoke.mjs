// Bookings / resource booking smoke (PH-02d — NX-027). Server must be up on :4000.
// Run: npm run test:bookings
//
// Asserts the full lifecycle: add bookable resource (manager) → create booking
// (REQUESTED) → approve → check-in (checkedInAt) → check-out (checkedOutAt);
// CONFLICT: an overlapping booking on the SAME resource → 409 (both while the
// first is REQUESTED and after APPROVED); a NON-overlapping (half-open) slot
// succeeds; no-show path (APPROVED → NO_SHOW, noShow=true); reject + cancel
// paths; illegal transition → 400; comment + attachment (subjectType=Booking)
// round-trip; list scopes/filters (mine/state/resourceId); tenant isolation
// (demo-isolation sees 0); enforcement: non-manager approve → 403, non-manager
// add-resource → 403. FULLY SELF-CLEANING: every smoke booking (+ events /
// attachments) and smoke resource is deleted at the end via direct Postgres
// under RLS bypass, resolving residue by code prefix. The 12 seed bookings + 4
// resource seeds are untouched.
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const H = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };
const BKG_PREFIX = 'BKG-SMOKE-';
const RES_PREFIX = 'RES-SMOKE-';

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const j = async (path, opts = {}, headers = H) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const post = (path, data, headers) => j(path, { method: 'POST', body: JSON.stringify(data ?? {}) }, headers);

console.log('Bookings smoke @ ' + BASE);
const createdBookingIds = [];
const createdResCodes = [];

// 0. Bookable resource: create a smoke resource (manager) via POST.
const resCode = `${RES_PREFIX}${Date.now().toString(36).toUpperCase()}`;
createdResCodes.push(resCode);
const res = await post('/api/bookable-resources', { code: resCode, name: 'Smoke — Phòng họp thử', type: 'ROOM', capacity: 8, location: 'Tầng thử' });
ok(res.status === 200 || res.status === 201, 'POST /api/bookable-resources 200/201');
const resourceId = res.body?.id;
ok(!!resourceId, `bookable resource created (${resourceId})`);
const resList = await j('/api/bookable-resources');
ok(Array.isArray(resList.body?.items) && resList.body.items.some((x) => x.id === resourceId), 'resource appears in list');

// A separate resource for the conflict test (isolated slots).
const resCode2 = `${RES_PREFIX}C-${Date.now().toString(36).toUpperCase()}`;
createdResCodes.push(resCode2);
const res2 = await post('/api/bookable-resources', { code: resCode2, name: 'Smoke — Xe thử', type: 'VEHICLE', capacity: 7 });
const resourceId2 = res2.body?.id;

const T = (h) => `2030-09-01T${String(h).padStart(2, '0')}:00:00+07:00`;

// 1. Create booking → REQUESTED.
const created = await post('/api/bookings', { code: `${BKG_PREFIX}${Date.now().toString(36)}`, title: 'Smoke — họp thử', resourceId, purpose: 'kiểm thử', startAt: T(10), endAt: T(12) });
ok(created.status === 201 || created.status === 200, 'POST /api/bookings 200/201');
const id = created.body?.id;
if (id) createdBookingIds.push(id);
ok(!!id, `booking created (${id})`);
ok(created.body?.state === 'REQUESTED', `initial state REQUESTED (got ${created.body?.state})`);
ok(Array.isArray(created.body?.legalActions) && created.body.legalActions.includes('approve'), 'legalActions include approve');

// 2. Illegal transition: check-in from REQUESTED → 400.
const badCheckin = await post(`/api/bookings/${id}/check-in`, {});
ok(badCheckin.status === 400, `check-in from REQUESTED rejected 400 (got ${badCheckin.status})`);

// 3. CONFLICT while first is REQUESTED: overlapping slot same resource → 409.
const conflictReq = await post('/api/bookings', { code: `${BKG_PREFIX}CFR-${Date.now().toString(36)}`, title: 'Smoke — trùng (pending)', resourceId, startAt: T(11), endAt: T(13) });
if (conflictReq.body?.id) createdBookingIds.push(conflictReq.body.id);
ok(conflictReq.status === 409, `overlapping booking (vs REQUESTED) → 409 (got ${conflictReq.status})`);

// 4. approve → APPROVED.
const approve = await post(`/api/bookings/${id}/approve`, {});
ok(approve.status === 200 || approve.status === 201, 'POST approve 200/201');
ok(approve.body?.booking?.state === 'APPROVED', `state APPROVED (got ${approve.body?.booking?.state})`);

// 5. CONFLICT after APPROVED: overlapping slot same resource → 409.
const conflictApp = await post('/api/bookings', { code: `${BKG_PREFIX}CFA-${Date.now().toString(36)}`, title: 'Smoke — trùng (approved)', resourceId, startAt: T(11), endAt: T(13) });
if (conflictApp.body?.id) createdBookingIds.push(conflictApp.body.id);
ok(conflictApp.status === 409, `overlapping booking (vs APPROVED) → 409 (got ${conflictApp.status})`);

// 6. NON-overlap (half-open [12,14) touches [10,12) only at the boundary) → OK.
const adjacent = await post('/api/bookings', { code: `${BKG_PREFIX}ADJ-${Date.now().toString(36)}`, title: 'Smoke — liền kề', resourceId, startAt: T(12), endAt: T(14) });
if (adjacent.body?.id) createdBookingIds.push(adjacent.body.id);
ok(adjacent.status === 200 || adjacent.status === 201, `adjacent (non-overlapping) booking accepted (got ${adjacent.status})`);

// 7. check-in → CHECKED_IN (checkedInAt stamped).
const checkin = await post(`/api/bookings/${id}/check-in`, {});
ok(checkin.body?.booking?.state === 'CHECKED_IN', `state CHECKED_IN (got ${checkin.body?.booking?.state})`);
ok(!!checkin.body?.booking?.checkedInAt, 'checkedInAt stamped');

// 8. check-out → CHECKED_OUT (checkedOutAt stamped); illegal after terminal.
const checkout = await post(`/api/bookings/${id}/check-out`, {});
ok(checkout.body?.booking?.state === 'CHECKED_OUT', `state CHECKED_OUT (got ${checkout.body?.booking?.state})`);
ok(!!checkout.body?.booking?.checkedOutAt, 'checkedOutAt stamped');
const badCancel = await post(`/api/bookings/${id}/cancel`, {});
ok(badCancel.status === 400, `cancel from CHECKED_OUT rejected 400 (got ${badCancel.status})`);

// 9. no-show path: create → approve → no-show → NO_SHOW (noShow=true).
const ns = await post('/api/bookings', { code: `${BKG_PREFIX}NS-${Date.now().toString(36)}`, title: 'Smoke — vắng mặt', resourceId: resourceId2, startAt: T(10), endAt: T(12) });
if (ns.body?.id) createdBookingIds.push(ns.body.id);
await post(`/api/bookings/${ns.body?.id}/approve`, {});
const noShow = await post(`/api/bookings/${ns.body?.id}/no-show`, {});
ok(noShow.body?.booking?.state === 'NO_SHOW', `state NO_SHOW (got ${noShow.body?.booking?.state})`);
ok(noShow.body?.booking?.noShow === true, `noShow flag set (got ${noShow.body?.booking?.noShow})`);

// 10. reject path.
const rj = await post('/api/bookings', { code: `${BKG_PREFIX}RJ-${Date.now().toString(36)}`, title: 'Smoke — từ chối', resourceId: resourceId2, startAt: T(14), endAt: T(15) });
if (rj.body?.id) createdBookingIds.push(rj.body.id);
const reject = await post(`/api/bookings/${rj.body?.id}/reject`, { note: 'không phù hợp' });
ok(reject.body?.booking?.state === 'REJECTED', `state REJECTED (got ${reject.body?.booking?.state})`);

// 11. cancel path (requester).
const cx = await post('/api/bookings', { code: `${BKG_PREFIX}CX-${Date.now().toString(36)}`, title: 'Smoke — hủy', resourceId: resourceId2, startAt: T(16), endAt: T(17) });
if (cx.body?.id) createdBookingIds.push(cx.body.id);
const cancel = await post(`/api/bookings/${cx.body?.id}/cancel`, {});
ok(cancel.body?.booking?.state === 'CANCELLED', `state CANCELLED (got ${cancel.body?.booking?.state})`);

// 12. comment + attachment (RecordDocument subjectType=Booking) round-trip.
const c1 = await post(`/api/bookings/${adjacent.body?.id}/comment`, { body: 'ghi chú đặt phòng' });
ok(c1.body?.ok === true, 'comment recorded');
const att = await post(`/api/bookings/${adjacent.body?.id}/attachments`, { title: 'agenda.txt', note: 'chương trình họp', content: 'noi dung' });
ok(att.status === 200 || att.status === 201, 'POST attachment 200/201');
ok(att.body?.document?.subjectType === 'Booking', `attachment subjectType=Booking (got ${att.body?.document?.subjectType})`);
const detail = await j(`/api/bookings/${adjacent.body?.id}`);
ok((detail.body?.attachments ?? []).some((d) => d.id === att.body?.document?.id), 'attachment appears in detail (via records)');
ok((detail.body?.events ?? []).some((e) => e.type === 'comment'), 'comment present in timeline');
ok(detail.body?.resource?.id === resourceId, 'detail carries the resource');

// 13. list scopes + filters.
const mine = await j('/api/bookings?scope=mine&pageSize=200');
ok(Array.isArray(mine.body?.items) && mine.body.items.some((b) => b.id === id), 'scope=mine contains requester booking');
const byRes = await j(`/api/bookings?resourceId=${resourceId2}&pageSize=200`);
ok(Array.isArray(byRes.body?.items) && byRes.body.items.every((b) => b.resourceId === resourceId2), 'resourceId filter returns only that resource');
const byState = await j('/api/bookings?state=CANCELLED&pageSize=200');
ok(Array.isArray(byState.body?.items) && byState.body.items.every((b) => b.state === 'CANCELLED'), 'state filter returns only CANCELLED');

// 14. tenant isolation.
const iso = await j('/api/bookings', {}, { ...H, 'x-tenant-id': 'tenant-demo-isolation' });
const isoLeak = Array.isArray(iso.body?.items) ? iso.body.items.filter((r) => r.tenantId === 'tenant-xtech').length : 0;
ok(isoLeak === 0, `demo-isolation sees 0 xtech bookings (got ${isoLeak})`);

// 15. enforcement: non-manager approve → 403; non-manager add resource → 403.
const empH = { ...H, 'x-user-id': 'usr-employee-smoke', 'x-authz-enforce': 'true' };
const en = await post('/api/bookings', { code: `${BKG_PREFIX}EN-${Date.now().toString(36)}`, title: 'Smoke — enforce', resourceId: resourceId2, startAt: T(18), endAt: T(19) });
if (en.body?.id) createdBookingIds.push(en.body.id);
const forbidApprove = await post(`/api/bookings/${en.body?.id}/approve`, {}, empH);
ok(forbidApprove.status === 403, `non-manager approve → 403 (got ${forbidApprove.status})`);
const forbidRes = await post('/api/bookable-resources', { name: 'Smoke — cấm', type: 'ROOM' }, empH);
ok(forbidRes.status === 403, `non-manager add resource → 403 (got ${forbidRes.status})`);

// ---- self-clean: delete every smoke booking + children + smoke resources -----
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  const idRows = await c.query(`SELECT id FROM "Booking" WHERE id = ANY($1::text[]) OR code LIKE $2`, [createdBookingIds, `${BKG_PREFIX}%`]);
  const allSmokeIds = [...new Set([...createdBookingIds, ...idRows.rows.map((r) => r.id)])];
  await c.query(
    `DELETE FROM "DocumentVersion" WHERE "documentId" IN (
       SELECT id FROM "RecordDocument" WHERE "subjectType"='Booking' AND "subjectId" = ANY($1::text[]))`,
    [allSmokeIds],
  );
  await c.query(`DELETE FROM "RecordDocument" WHERE "subjectType"='Booking' AND "subjectId" = ANY($1::text[])`, [allSmokeIds]);
  await c.query(`DELETE FROM "BookingEvent" WHERE "bookingId" = ANY($1::text[])`, [allSmokeIds]);
  const del = await c.query(`DELETE FROM "Booking" WHERE id = ANY($1::text[])`, [allSmokeIds]);
  const delRes = await c.query(`DELETE FROM "BookableResource" WHERE code LIKE $1`, [`${RES_PREFIX}%`]);
  await c.query('COMMIT');
  ok(del.rowCount >= createdBookingIds.length, `smoke bookings cleaned (deleted ${del.rowCount})`);
  ok(delRes.rowCount >= createdResCodes.length, `smoke resources cleaned (deleted ${delRes.rowCount})`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('  ✗ cleanup failed:', e.message);
  failed++;
} finally {
  await c.end();
}

// verify no residue + seed data intact (12 bookings + 4 resources remain).
const after = await j('/api/bookings?scope=all&pageSize=500');
const residue = Array.isArray(after.body?.items) ? after.body.items.filter((b) => (b.code || '').startsWith(BKG_PREFIX)).length : 0;
ok(residue === 0, `no smoke booking residue remains (got ${residue})`);
const seedRemain = Array.isArray(after.body?.items) ? after.body.items.filter((b) => (b.code || '').startsWith('BOOK-2026-')).length : 0;
ok(seedRemain === 12, `12 seed bookings intact (got ${seedRemain})`);
const resAfter = await j('/api/bookable-resources');
const resResidue = Array.isArray(resAfter.body?.items) ? resAfter.body.items.filter((r) => (r.code || '').startsWith(RES_PREFIX)).length : 0;
ok(resResidue === 0, `no smoke resource residue (got ${resResidue})`);
const resSeedRemain = Array.isArray(resAfter.body?.items) ? resAfter.body.items.filter((r) => ['ROOM-8F', 'ROOM-PRJ', 'VEH-7S', 'ASSET-PROJ'].includes(r.code)).length : 0;
ok(resSeedRemain === 4, `4 seed resources intact (got ${resSeedRemain})`);

console.log(failed === 0 ? '\nBOOKINGS SMOKE PASSED' : `\nBOOKINGS SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
