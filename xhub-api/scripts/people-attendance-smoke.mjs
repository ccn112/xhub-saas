// People Essentials — PE-02 (Attendance & Correction) SMOKE. Proves the
// import engine (preview → commit → duplicate-checksum → rollback) and the
// correction FSM end-to-end against the running API, then self-cleans.
// Run: npm run test:people-attendance
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const TENANT = 'tenant-xtech';
const OTHER = 'tenant-demo-isolation';
const ACTOR = 'user-nam'; // usr-cfo
const H = (t = TENANT, u = ACTOR) => ({ 'content-type': 'application/json', 'x-tenant-id': t, 'x-user-id': u });
const MARK = `pe02-smoke-${Date.now()}`;

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

// Pick a Tuesday a few weeks in the past — a plain weekday, safely inside the
// ShiftAssignment window (effectiveFrom = now - 1y) and never a WEEKEND.
function pastWeekday() {
  const d = new Date(Date.now() - 21 * 86400000);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
const DATE = pastWeekday();

console.log(`people-attendance smoke @ ${BASE} (mark=${MARK}, date=${DATE})`);
let batchId;
try {
  // A) Preview — 2 valid rows + 2 invalid rows -----------------------------------
  const csv = [
    'personId,date,clockIn,clockOut',
    `usr-cfo,${DATE},08:20,17:40`,
    `usr-accountant,${DATE},09:10,17:00`,
    `usr-does-not-exist,${DATE},08:00,17:00`,
    `usr-sales-01,${DATE},badtime,17:00`,
  ].join('\n');
  let r = await api('POST', '/api/people/imports', { fileName: `${MARK}.csv`, content: csv });
  ok(r.status < 300 && r.json?.id, `import preview created (${r.status})`);
  batchId = r.json?.id;
  ok(r.json?.status === 'PREVIEWED', 'batch status = PREVIEWED (nothing written yet)');
  ok(r.json?.totalRows === 4 && r.json?.validRows === 2 && r.json?.errorRows === 2, `4 rows parsed, 2 valid / 2 error (got total=${r.json?.totalRows} valid=${r.json?.validRows} error=${r.json?.errorRows})`);
  const badPersonRow = r.json?.preview?.find((p) => p.personId === 'usr-does-not-exist');
  ok(badPersonRow?.error === 'unknown personId', 'unknown personId flagged with a clear error');

  let evCount = await api('GET', '/api/people/attendance/me', undefined, TENANT, ACTOR);
  const beforeCommitCount = (evCount.json?.items ?? []).length;

  // B) Duplicate checksum rejected BEFORE commit --------------------------------
  r = await api('POST', '/api/people/imports', { fileName: `${MARK}-again.csv`, content: csv });
  ok(r.status === 409, `re-uploading identical content → 409 duplicate (got ${r.status})`);

  // C) Commit — writes AttendanceEvent, recomputes AttendanceDay -----------------
  r = await api('POST', `/api/people/imports/${batchId}/commit`, {});
  ok(r.status < 300 && r.json?.status === 'COMMITTED', `commit → COMMITTED (${r.status})`);

  r = await api('GET', `/api/people/attendance/me?from=${DATE}&to=${DATE}`, undefined, TENANT, ACTOR);
  const cfoDay = (r.json?.items ?? []).find((d) => d.workDate?.slice(0, 10) === DATE);
  ok(cfoDay?.status === 'PRESENT', `usr-cfo day computed PRESENT (arrived within grace) — got ${cfoDay?.status}`);

  r = await api('GET', `/api/people/team/attendance?orgUnitId=ou-fin&from=${DATE}&to=${DATE}`);
  const accDay = (r.json?.items ?? []).find((d) => d.personId === 'usr-accountant');
  ok(accDay?.status === 'LATE' && accDay?.lateMinutes === 40, `usr-accountant day computed LATE, 40 min late — got status=${accDay?.status} lateMinutes=${accDay?.lateMinutes}`);

  // D) Rollback — reverses exactly what this batch wrote ------------------------
  r = await api('POST', `/api/people/imports/${batchId}/rollback`, {});
  ok(r.status < 300 && r.json?.status === 'ROLLED_BACK', `rollback → ROLLED_BACK (${r.status})`);

  r = await api('GET', `/api/people/attendance/me?from=${DATE}&to=${DATE}`, undefined, TENANT, ACTOR);
  const cfoDayAfter = (r.json?.items ?? []).find((d) => d.workDate?.slice(0, 10) === DATE);
  ok(cfoDayAfter?.status === 'ABSENT', `after rollback, day recomputed back to ABSENT (no events) — got ${cfoDayAfter?.status}`);

  // E) Correction request → approve → overwrites AttendanceDay, freezes it -------
  const key = `${MARK}-corr1`;
  r = await api('POST', '/api/people/attendance-corrections', { workDate: DATE, reason: `${MARK} quên chấm công`, requestedStatus: 'PRESENT', idempotencyKey: key });
  ok(r.status < 300 && r.json?.id, `correction request created (${r.status})`);
  const corrId = r.json.id;
  ok(r.json?.status === 'SUBMITTED', 'correction starts SUBMITTED');

  const replay = await api('POST', '/api/people/attendance-corrections', { workDate: DATE, reason: 'x', idempotencyKey: key });
  ok(replay.json?.replayed === true && replay.json?.id === corrId, 'replaying same idempotencyKey returns the SAME row, no duplicate');

  r = await api('POST', `/api/people/attendance-corrections/${corrId}/approve`, {});
  ok(r.status < 300 && r.json?.status === 'APPROVED', `correction approved (${r.status})`);

  r = await api('GET', `/api/people/attendance/me?from=${DATE}&to=${DATE}`, undefined, TENANT, ACTOR);
  const cfoDayCorrected = (r.json?.items ?? []).find((d) => d.workDate?.slice(0, 10) === DATE);
  ok(cfoDayCorrected?.status === 'PRESENT' && cfoDayCorrected?.correctionApplied === true, `AttendanceDay overwritten by approved correction (status=PRESENT, correctionApplied=true) — got status=${cfoDayCorrected?.status} correctionApplied=${cfoDayCorrected?.correctionApplied}`);

  // F) Cross-tenant isolation -----------------------------------------------------
  r = await api('GET', '/api/people/attendance/me?from=2026-01-01&to=2026-01-02', undefined, OTHER, ACTOR);
  ok(r.status === 400, `cross-tenant read as ${OTHER}: no PersonProfile there → 400 (got ${r.status})`);
} catch (e) {
  console.error('  ✗ smoke threw:', e.message);
  failed++;
}

// ---- self-clean (DB, bypass RLS) ------------------------------------------
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  await c.query(`DELETE FROM "AttendanceEvent" WHERE "tenantId"=$1 AND "importBatchId"=$2`, [TENANT, batchId]);
  await c.query(`DELETE FROM "AttendanceImportBatch" WHERE "tenantId"=$1 AND "fileName" LIKE '${MARK}%'`, [TENANT]);
  const corr = (await c.query(`SELECT id, "workflowInstanceId" FROM "AttendanceCorrectionRequest" WHERE "tenantId"=$1 AND "idempotencyKey" LIKE '${MARK}%'`, [TENANT])).rows;
  const instanceIds = corr.map((r) => r.workflowInstanceId).filter(Boolean);
  if (instanceIds.length) {
    await c.query(`DELETE FROM "ApprovalTask" WHERE "tenantId"=$1 AND "instanceId" = ANY($2::text[])`, [TENANT, instanceIds]);
    await c.query(`DELETE FROM "WorkflowInstance" WHERE "tenantId"=$1 AND id = ANY($2::text[])`, [TENANT, instanceIds]);
  }
  await c.query(`DELETE FROM "AttendanceCorrectionRequest" WHERE "tenantId"=$1 AND "idempotencyKey" LIKE '${MARK}%'`, [TENANT]);
  await c.query(`DELETE FROM "AttendanceDay" WHERE "tenantId"=$1 AND "workDate"=$2 AND "personId" IN ('usr-cfo','usr-accountant','usr-sales-01')`, [TENANT, DATE]);
  await c.query('COMMIT');
  const residue = Number((await c.query(`SELECT (SELECT count(*) FROM "AttendanceImportBatch" WHERE "tenantId"=$1 AND "fileName" LIKE '${MARK}%')+(SELECT count(*) FROM "AttendanceCorrectionRequest" WHERE "tenantId"=$1 AND "idempotencyKey" LIKE '${MARK}%') AS n`, [TENANT])).rows[0].n);
  ok(residue === 0, `self-clean: 0 residue rows (got ${residue})`);
} catch (e) {
  console.error('  ✗ self-clean failed:', e.message);
  failed++;
} finally {
  await c.end();
}

console.log(failed === 0 ? '\nPEOPLE-ATTENDANCE SMOKE PASSED' : `\nPEOPLE-ATTENDANCE SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
