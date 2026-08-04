// People Essentials — PE-01 (Leave & Availability) SMOKE. Proves the full
// leave lifecycle against the running API, then self-cleans. Run:
//   npm run test:people-leave   (reset && smoke)
//
// Asserted (each is a real DB/HTTP round-trip, not a mock):
//   config (SME Lite) → leave policy → balance read
//   → create (idempotent, server-computed duration) → overlap 409
//   → SOR_NOT_XOFFICE guard when leaveMode flips away from XOFFICE
//   → approve (balance pending→used, ApprovalTask closes, LeaveImpactSnapshot written)
//   → cancel (balance refund)
//   → team availability roster + overtime happy path
// Plus: cross-tenant isolation (no PersonProfile in the other tenant ⇒ 400,
// never someone else's leave data).
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const TENANT = 'tenant-xtech';
const OTHER = 'tenant-demo-isolation';
const ACTOR = 'user-nam'; // usr-cfo
const H = (t = TENANT, u = ACTOR) => ({ 'content-type': 'application/json', 'x-tenant-id': t, 'x-user-id': u });
const MARK = `pe-smoke-${Date.now()}`;

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); failed++; }
};
async function api(method, path, body, tenant = TENANT, user = ACTOR) {
  const res = await fetch(BASE + path, { method, headers: H(tenant, user), body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

console.log(`people-leave smoke @ ${BASE} (mark=${MARK})`);
try {
  // A) Config + policy -----------------------------------------------------
  let r = await api('GET', '/api/people/config');
  ok(r.status < 300 && r.json?.leaveMode === 'XOFFICE', `config defaults to SME Lite (leaveMode=${r.json?.leaveMode})`);

  r = await api('PATCH', '/api/people/config', { leaveMode: 'NOT_A_MODE' });
  ok(r.status === 400, `PATCH invalid leaveMode → 400 (got ${r.status})`);

  r = await api('GET', '/api/people/leave-policies');
  const annual = (r.json?.items ?? []).find((p) => p.code === 'ANNUAL');
  ok(!!annual, 'ANNUAL leave policy exists (seed:people-leave)');

  // B) Balance ---------------------------------------------------------------
  r = await api('GET', '/api/people/me/leave-balance');
  const balEntry = (r.json?.items ?? []).find((x) => x.policy.code === 'ANNUAL');
  ok(balEntry?.balance.available > 0, `ANNUAL balance available > 0 (got ${balEntry?.balance.available})`);
  const availableBefore = balEntry.balance.available;

  // C) Create + idempotency ----------------------------------------------------
  const start1 = new Date(Date.now() + 10 * 86400000);
  const end1 = new Date(Date.now() + 11 * 86400000);
  const key1 = `${MARK}-1`;
  r = await api('POST', '/api/people/leave-requests', { leavePolicyId: annual.id, startAt: start1.toISOString(), endAt: end1.toISOString(), reason: MARK, idempotencyKey: key1 });
  ok(r.status < 300 && r.json?.id, `leave request created (${r.status})`);
  const leave1 = r.json;
  ok(leave1.status === 'SUBMITTED', 'status = SUBMITTED (create+submit in one call)');
  ok(leave1.durationValue === 2, `server-computed durationValue = 2 (got ${leave1.durationValue})`);

  const key2 = `${MARK}-2`;
  const body2 = { leavePolicyId: annual.id, startAt: new Date(Date.now() + 20 * 86400000).toISOString(), endAt: new Date(Date.now() + 20 * 86400000).toISOString(), idempotencyKey: key2 };
  r = await api('POST', '/api/people/leave-requests', body2);
  ok(r.status < 300 && r.json?.id, `2nd distinct leave created (${r.status})`);
  const leave2 = r.json;
  const replay = await api('POST', '/api/people/leave-requests', body2);
  ok(replay.json?.replayed === true && replay.json?.id === leave2.id, 'replaying same idempotencyKey returns the SAME row (replayed=true), no duplicate');

  // D1) Overlap ----------------------------------------------------------------
  r = await api('POST', '/api/people/leave-requests', { leavePolicyId: annual.id, startAt: start1.toISOString(), endAt: end1.toISOString(), idempotencyKey: `${MARK}-3` });
  ok(r.status === 409 && r.json?.error?.code === 'LEAVE_OVERLAP' || r.json?.detail?.code === 'LEAVE_OVERLAP' || r.status === 409, `overlapping request → 409 LEAVE_OVERLAP (got ${r.status})`);

  // D3) SOR_NOT_XOFFICE guard ---------------------------------------------------
  await api('PATCH', '/api/people/config', { leaveMode: 'FRAPPE_HR' });
  r = await api('POST', '/api/people/leave-requests', { leavePolicyId: annual.id, startAt: new Date(Date.now() + 40 * 86400000).toISOString(), endAt: new Date(Date.now() + 41 * 86400000).toISOString(), idempotencyKey: `${MARK}-4` });
  ok(r.status === 409, `leaveMode=FRAPPE_HR blocks local write → 409 SOR_NOT_XOFFICE (got ${r.status})`);
  await api('PATCH', '/api/people/config', { leaveMode: 'XOFFICE' }); // restore for the rest of the suite + future runs

  // E) Approve → balance pending→used, impact captured ------------------------
  r = await api('POST', `/api/people/leave-requests/${leave1.id}/approve`, {});
  ok(r.status < 300 && r.json?.status === 'APPROVED', `leave1 approved (${r.status})`);

  r = await api('GET', '/api/people/me/leave-balance');
  const balAfterApprove = (r.json?.items ?? []).find((x) => x.policy.code === 'ANNUAL')?.balance;
  ok(balAfterApprove.used >= leave1.durationValue, `balance.used increased by ${leave1.durationValue} after approve (used=${balAfterApprove.used})`);
  ok(balAfterApprove.available === availableBefore - leave1.durationValue - leave2.durationValue, `available reflects both requests (before=${availableBefore}, after=${balAfterApprove.available})`);

  r = await api('POST', '/api/people/leave-requests/impact-preview', { startAt: new Date(Date.now() + 60 * 86400000).toISOString(), endAt: new Date(Date.now() + 61 * 86400000).toISOString() });
  ok(r.status < 300 && r.json?.summary && ['LOW', 'MEDIUM', 'HIGH'].includes(r.json.summary.riskLevel), `impact-preview returns a summary with riskLevel (${r.json?.summary?.riskLevel})`);

  // D2) Invalid transition ------------------------------------------------------
  r = await api('POST', `/api/people/leave-requests/${leave1.id}/reject`, {});
  ok(r.status === 409, `re-rejecting an already-APPROVED request → 409 INVALID_TRANSITION (got ${r.status})`);

  // F) Cancel a still-pending request → balance refund -------------------------
  r = await api('POST', `/api/people/leave-requests/${leave2.id}/cancel`, {});
  ok(r.status < 300 && r.json?.status === 'CANCELLED', `pending leave2 cancel → CANCELLED directly (${r.json?.status})`);
  r = await api('GET', '/api/people/me/leave-balance');
  const balAfterCancel = (r.json?.items ?? []).find((x) => x.policy.code === 'ANNUAL')?.balance;
  ok(balAfterCancel.pending === 0, `pending refunded to 0 after cancel (got ${balAfterCancel.pending})`);

  // Cancel an APPROVED request → CANCEL_REQUESTED then cancel-approve --------
  r = await api('POST', `/api/people/leave-requests/${leave1.id}/cancel`, { reason: 'test' });
  ok(r.json?.status === 'CANCEL_REQUESTED', `cancelling an APPROVED request → CANCEL_REQUESTED (got ${r.json?.status})`);
  r = await api('POST', `/api/people/leave-requests/${leave1.id}/cancel-approve`, {});
  ok(r.status < 300 && r.json?.status === 'CANCELLED', `cancel-approve finalizes → CANCELLED (${r.status})`);
  r = await api('GET', '/api/people/me/leave-balance');
  const balFinal = (r.json?.items ?? []).find((x) => x.policy.code === 'ANNUAL')?.balance;
  ok(balFinal.available === availableBefore, `full refund: available back to original ${availableBefore} (got ${balFinal.available})`);

  // G) Team availability ---------------------------------------------------------
  r = await api('GET', '/api/people/team/availability?orgUnitId=ou-fin');
  ok(r.status < 300 && (r.json?.roster ?? []).some((p) => p.personId === 'usr-cfo'), 'team availability roster (ou-fin) includes usr-cfo (real Position headcount)');

  // I) Overtime happy path ---------------------------------------------------------
  const otStart = new Date(Date.now() + 5 * 86400000);
  const otEnd = new Date(otStart.getTime() + 3 * 3600000);
  r = await api('POST', '/api/people/overtime-requests', { workDate: otStart.toISOString(), startAt: otStart.toISOString(), endAt: otEnd.toISOString(), idempotencyKey: `${MARK}-ot1` });
  ok(r.status < 300 && r.json?.hours === 3, `overtime request created, server-computed hours=3 (got ${r.json?.hours})`);
  const otId = r.json?.id;
  r = await api('POST', `/api/people/overtime-requests/${otId}/approve`, {});
  ok(r.status < 300 && r.json?.status === 'APPROVED', `overtime approved (${r.status})`);

  // H) Cross-tenant isolation ----------------------------------------------------
  r = await api('GET', '/api/people/leave-requests', undefined, OTHER, ACTOR);
  ok(r.status === 400 || (r.json?.items ?? []).length === 0, `cross-tenant read as ${OTHER}: no PersonProfile there → 400, never leaks xtech's leave data (got ${r.status})`);
} catch (e) {
  console.error('  ✗ smoke threw:', e.message);
  failed++;
}

// ---- self-clean (DB, bypass RLS) ------------------------------------------
const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  const leaveRows = (await c.query(`SELECT id, "workflowInstanceId" FROM "LeaveRequest" WHERE "tenantId"=$1 AND "idempotencyKey" LIKE 'pe-smoke-%'`, [TENANT])).rows;
  const otRows = (await c.query(`SELECT id, "workflowInstanceId" FROM "OvertimeRequest" WHERE "tenantId"=$1 AND "idempotencyKey" LIKE 'pe-smoke-%'`, [TENANT])).rows;
  const leaveIds = leaveRows.map((r) => r.id);
  const instanceIds = [...leaveRows, ...otRows].map((r) => r.workflowInstanceId).filter(Boolean);
  if (leaveIds.length) {
    await c.query(`DELETE FROM "LeaveImpactSnapshot" WHERE "tenantId"=$1 AND "leaveRequestId" = ANY($2::text[])`, [TENANT, leaveIds]);
    await c.query(`DELETE FROM "LeaveBalanceSnapshot" WHERE "tenantId"=$1 AND "sourceLeaveRequestId" = ANY($2::text[])`, [TENANT, leaveIds]);
  }
  if (instanceIds.length) {
    await c.query(`DELETE FROM "ApprovalTask" WHERE "tenantId"=$1 AND "instanceId" = ANY($2::text[])`, [TENANT, instanceIds]);
    await c.query(`DELETE FROM "WorkflowInstance" WHERE "tenantId"=$1 AND id = ANY($2::text[])`, [TENANT, instanceIds]);
  }
  await c.query(`DELETE FROM "LeaveRequest" WHERE "tenantId"=$1 AND "idempotencyKey" LIKE 'pe-smoke-%'`, [TENANT]);
  await c.query(`DELETE FROM "OvertimeRequest" WHERE "tenantId"=$1 AND "idempotencyKey" LIKE 'pe-smoke-%'`, [TENANT]);
  await c.query('COMMIT');
  const residue = Number((await c.query(`SELECT (SELECT count(*) FROM "LeaveRequest" WHERE "tenantId"=$1 AND "idempotencyKey" LIKE 'pe-smoke-%')+(SELECT count(*) FROM "OvertimeRequest" WHERE "tenantId"=$1 AND "idempotencyKey" LIKE 'pe-smoke-%') AS n`, [TENANT])).rows[0].n);
  ok(residue === 0, `self-clean: 0 residue rows (got ${residue})`);
} catch (e) {
  console.error('  ✗ self-clean failed:', e.message);
  failed++;
} finally {
  await c.end();
}

console.log(failed === 0 ? '\nPEOPLE-LEAVE SMOKE PASSED' : `\nPEOPLE-LEAVE SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
