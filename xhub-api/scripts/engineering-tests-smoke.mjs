// Engineering Governance — Test hierarchy smoke (test:engineering-tests,
// DG-04-lite). Server must be up on :4000 with products+test suites seeded.
// Proves: Product -> Version -> Module (TestSuite) -> TestCase drill-down
// works; recording a TestResult updates currentStatus; status filter works;
// history is append-only (2 results recorded -> 2 rows, latest wins for
// currentStatus); result recording is open (no permission gate, matches the
// existing /docs/test checklist). Uses a THROWAWAY test case (not a seeded
// one) so re-running this smoke repeatedly doesn't collide with prior runs'
// TestResult history — TestResult is append-only by design, never cleaned up
// for real cases, so the smoke can't reuse a seeded case for its NOT_RUN
// assertion. Self-cleaning: deletes only the throwaway case + its results.
// Run: node scripts/engineering-tests-smoke.mjs
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

console.log('Engineering Tests smoke @ ' + BASE);

try {
  const prod = await j('/api/engineering/products/PRD-XHUB');
  const productId = prod.body.id;
  const versionId = prod.body.versions?.[0]?.id;
  ok(!!versionId, 'PRD-XHUB has a seeded version to test against');

  const suites = await j('/api/engineering/test-suites?productId=' + productId);
  ok(suites.status === 200 && suites.body.length >= 7, `Module (TestSuite) list has ≥7 entries for XHUB (got ${suites.body?.length})`);
  const suite = suites.body.find((s) => s.name === 'Xác thực');
  ok(!!suite, "Module 'Xác thực' present (matches legacy USER_TEST_GROUPS naming)");

  // Throwaway case for this smoke — NOT the seeded TST-XHUB-UAT-U8 (that one
  // accumulates real history across every prior run; TestResult is
  // append-only, so reusing it would make the NOT_RUN assertion below flaky).
  const newCase = await j('/api/engineering/test-cases', { method: 'POST', body: JSON.stringify({ testSuiteId: suite.id, code: 'TST-SMOKE-TEST', title: 'Smoke test case', standardsRefs: ['OWASP-ASVS-4.0:V3.3'] }) });
  ok(newCase.status === 201 || newCase.status === 200, `throwaway test case created (got ${newCase.status})`);
  const caseId = newCase.body.id;

  const cases = await j(`/api/engineering/test-cases?testSuiteId=${suite.id}&productVersionId=${versionId}`);
  ok(cases.status === 200 && cases.body.some((c) => c.id === caseId), 'new case appears in the module drill-down list');
  const target = cases.body.find((c) => c.id === caseId);
  ok(target.currentStatus === 'NOT_RUN', `brand-new case defaults currentStatus=NOT_RUN (got ${target.currentStatus})`);
  ok(Array.isArray(target.standardsRefs) && target.standardsRefs.includes('OWASP-ASVS-4.0:V3.3'), 'standardsRefs round-trips through the list endpoint');

  // Record a FAIL, then a PASS — currentStatus should reflect the LATEST, not overwrite history.
  const fail = await j('/api/engineering/test-results', { method: 'POST', body: JSON.stringify({ testCaseId: caseId, productVersionId: versionId, status: 'FAIL', actualResult: 'smoke: forced fail' }) });
  ok(fail.status === 201 || fail.status === 200, `record FAIL (got ${fail.status})`);

  const afterFail = await j(`/api/engineering/test-cases?testSuiteId=${suite.id}&productVersionId=${versionId}&status=FAIL`);
  ok(afterFail.body.some((c) => c.id === caseId), 'status=FAIL filter finds the case right after recording FAIL');

  const pass = await j('/api/engineering/test-results', { method: 'POST', body: JSON.stringify({ testCaseId: caseId, productVersionId: versionId, status: 'PASS', actualResult: 'smoke: then pass' }) });
  ok(pass.status === 201 || pass.status === 200, `record PASS (got ${pass.status})`);

  const afterPass = await j(`/api/engineering/test-cases?testSuiteId=${suite.id}&productVersionId=${versionId}&status=PASS`);
  ok(afterPass.body.some((c) => c.id === caseId), 'status=PASS filter finds the case after recording PASS (latest wins)');
  const stillFailFilter = await j(`/api/engineering/test-cases?testSuiteId=${suite.id}&productVersionId=${versionId}&status=FAIL`);
  ok(!stillFailFilter.body.some((c) => c.id === caseId), 'status=FAIL filter no longer finds it (currentStatus tracks latest only)');

  const history = await j('/api/engineering/test-results?testCaseId=' + caseId);
  ok(history.body.length === 2, `history keeps both results, append-only (got ${history.body.length})`);

  // Result recording is intentionally OPEN — a low-priv tester can still record their own test result.
  const lowRecord = await j('/api/engineering/test-results', { method: 'POST', body: JSON.stringify({ testCaseId: caseId, productVersionId: versionId, status: 'BLOCKED' }) }, LOWPRIV);
  ok(lowRecord.status === 201 || lowRecord.status === 200, `non-admin CAN record a result (open by design, got ${lowRecord.status})`);

  // But creating new suites/cases (admin config) IS gated.
  const lowCreateSuite = await j('/api/engineering/test-suites', { method: 'POST', body: JSON.stringify({ productId, name: 'Should Fail' }) }, LOWPRIV);
  ok(lowCreateSuite.status === 403, `non-admin create test suite -> 403 (got ${lowCreateSuite.status})`);

  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('DELETE FROM "TestResult" WHERE "testCaseId" = $1', [caseId]);
  const del = await c.query('DELETE FROM "TestCase" WHERE code = $1 RETURNING id', ['TST-SMOKE-TEST']);
  ok(del.rowCount === 1, 'smoke test case + its results cleaned up');
  await c.end();
} catch (e) {
  console.error('  ✗ unexpected error:', e.message);
  failed++;
}

if (failed > 0) { console.error(`\nENGINEERING TESTS SMOKE FAILED (${failed})`); process.exit(1); }
console.log('\nENGINEERING TESTS SMOKE PASSED');
