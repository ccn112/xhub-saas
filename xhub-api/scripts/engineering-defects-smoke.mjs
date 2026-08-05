// Engineering Governance — Defect smoke (test:engineering-defects, DG-05).
// Server must be up on :4000 with products+test suites seeded.
// Proves: defect auto-code (DEF-<PRODUCT>-NNNN); idempotent create-from-
// testResultId (repeat "báo lỗi" click doesn't duplicate); FSM guard (illegal
// jump rejected, legal chain accepted); P0 defect cannot close without
// rootCause, P2 can; write routes gated, reads open.
// Run: node scripts/engineering-defects-smoke.mjs
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const ADMIN = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };
const LOWPRIV = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-huyvu', 'x-authz-enforce': 'true' };

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const j = async (path, opts = {}, headers = ADMIN) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};

console.log('Engineering Defects smoke @ ' + BASE);

let caseId;
const defectIds = [];
try {
  const prod = await j('/api/engineering/products/PRD-XHUB');
  const productId = prod.body.id;
  const versionId = prod.body.versions?.[0]?.id;

  const suites = await j('/api/engineering/test-suites?productId=' + productId);
  const suite = suites.body.find((s) => s.name === 'Xác thực');
  ok(!!suite, "Module 'Xác thực' present");

  const newCase = await j('/api/engineering/test-cases', { method: 'POST', body: JSON.stringify({ testSuiteId: suite.id, code: 'TST-SMOKE-DEFECT', title: 'Smoke case for defect' }) });
  caseId = newCase.body.id;
  const fail = await j('/api/engineering/test-results', { method: 'POST', body: JSON.stringify({ testCaseId: caseId, productVersionId: versionId, status: 'FAIL', actualResult: 'smoke: forced fail' }) });
  const testResultId = fail.body.id;
  ok(!!testResultId, 'throwaway FAIL result created to file a defect from');

  const def1 = await j('/api/engineering/defects', { method: 'POST', body: JSON.stringify({ productId, productVersionId: versionId, testCaseId: caseId, testResultId, title: 'Smoke: forced fail defect' }) });
  ok(def1.status === 201 || def1.status === 200, `defect created (got ${def1.status})`);
  ok(/^DEF-PRD-XHUB-\d{4}$/.test(def1.body.code), `auto-generated code matches DEF-<PRODUCT>-NNNN (got ${def1.body.code})`);
  ok(def1.body.status === 'NEW' && def1.body.severity === 'P2', `defaults status=NEW severity=P2 (got ${def1.body.status}/${def1.body.severity})`);
  defectIds.push(def1.body.id);

  const def2 = await j('/api/engineering/defects', { method: 'POST', body: JSON.stringify({ productId, testResultId, title: 'duplicate click' }) });
  ok(def2.body.id === def1.body.id, 'repeat create with same testResultId is idempotent (returns existing defect)');

  const illegal = await j(`/api/engineering/defects/${def1.body.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'CLOSED' }) });
  ok(illegal.status === 400, `NEW -> CLOSED (skip) rejected 400 (got ${illegal.status})`);

  const step1 = await j(`/api/engineering/defects/${def1.body.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'TRIAGED' }) });
  ok(step1.status === 200 && step1.body.status === 'TRIAGED', `NEW -> TRIAGED accepted (got ${step1.status}/${step1.body.status})`);
  for (const s of ['IN_PROGRESS', 'FIX_READY', 'VERIFYING']) {
    const r = await j(`/api/engineering/defects/${def1.body.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: s }) });
    ok(r.status === 200 && r.body.status === s, `-> ${s} accepted (got ${r.status}/${r.body.status})`);
  }
  const closeP2 = await j(`/api/engineering/defects/${def1.body.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'CLOSED' }) });
  ok(closeP2.status === 200 && closeP2.body.status === 'CLOSED', `P2 defect closes without rootCause (got ${closeP2.status})`);

  // P0 defect: must have rootCause before CLOSED.
  const p0 = await j('/api/engineering/defects', { method: 'POST', body: JSON.stringify({ productId, title: 'Smoke: P0 defect', severity: 'P0' }) });
  defectIds.push(p0.body.id);
  for (const s of ['TRIAGED', 'IN_PROGRESS', 'FIX_READY', 'VERIFYING']) {
    await j(`/api/engineering/defects/${p0.body.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: s }) });
  }
  const closeNoRca = await j(`/api/engineering/defects/${p0.body.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'CLOSED' }) });
  ok(closeNoRca.status === 400, `P0 defect cannot CLOSE without rootCause (got ${closeNoRca.status})`);
  const closeWithRca = await j(`/api/engineering/defects/${p0.body.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'CLOSED', rootCause: 'smoke: root cause text' }) });
  ok(closeWithRca.status === 200 && closeWithRca.body.status === 'CLOSED', `P0 defect closes once rootCause supplied (got ${closeWithRca.status})`);

  // create() is intentionally OPEN (see defects.controller.ts docblock) — a
  // non-admin tester can file a defect straight off their own FAIL result.
  const lowCreate = await j('/api/engineering/defects', { method: 'POST', body: JSON.stringify({ productId, title: 'non-admin filed defect' }) }, LOWPRIV);
  ok(lowCreate.status === 201 || lowCreate.status === 200, `non-admin CAN create a defect (open by design, got ${lowCreate.status})`);
  defectIds.push(lowCreate.body.id);
  const lowRead = await j('/api/engineering/defects?productId=' + productId, {}, LOWPRIV);
  ok(lowRead.status === 200, `non-admin read defects -> 200 (got ${lowRead.status})`);
  // But triaging/closing (the FSM transition) IS gated — governance action.
  const lowTransition = await j(`/api/engineering/defects/${lowCreate.body.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'TRIAGED' }) }, LOWPRIV);
  ok(lowTransition.status === 403, `non-admin transition defect -> 403 (got ${lowTransition.status})`);
} catch (e) {
  console.error('  ✗ unexpected error:', e.message);
  failed++;
} finally {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  if (defectIds.length) await c.query('DELETE FROM "Defect" WHERE id = ANY($1)', [defectIds]);
  if (caseId) {
    await c.query('DELETE FROM "TestResult" WHERE "testCaseId" = $1', [caseId]);
    await c.query('DELETE FROM "TestCase" WHERE id = $1', [caseId]);
  }
  ok(true, 'smoke defects + throwaway test case/result cleaned up');
  await c.end();
}

if (failed > 0) { console.error(`\nENGINEERING DEFECTS SMOKE FAILED (${failed})`); process.exit(1); }
console.log('\nENGINEERING DEFECTS SMOKE PASSED');
