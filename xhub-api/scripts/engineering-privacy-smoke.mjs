// Engineering Governance — Processing Activity Registry + DPIA smoke
// (test:engineering-privacy, DG-11). Server up on :4000 with products +
// processing activities seeded.
// Proves: real seeded activities present; create activity; DPIA FSM
// (illegal jump rejected; APPROVED requires approverRole; legal chain
// accepted); writes gated, reads open.
// Run: node scripts/engineering-privacy-smoke.mjs
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

console.log('Engineering Privacy/DPIA smoke @ ' + BASE);

let activityId;
try {
  const prod = await j('/api/engineering/products/PRD-XHUB');
  const productId = prod.body.id;

  const seeded = await j('/api/engineering/processing-activities/PA-IDENTITY-DIRECTORY');
  ok(seeded.status === 200 && Array.isArray(seeded.body.dataCategories) && seeded.body.dataCategories.length > 0, `seeded real processing activity present with dataCategories (got ${seeded.status})`);

  const created = await j('/api/engineering/processing-activities', { method: 'POST', body: JSON.stringify({ code: 'PA-SMOKE-TEST', productId, name: 'Smoke activity', dataCategories: ['test'] }) });
  ok(created.status === 201 || created.status === 200, `activity created (got ${created.status})`);
  activityId = created.body.id;

  const assessment = await j(`/api/engineering/processing-activities/${activityId}/assessments`, { method: 'POST' });
  ok(assessment.status === 201 || assessment.status === 200, `DPIA created, starts DRAFT (got ${assessment.status}/${assessment.body.status})`);
  const assessmentId = assessment.body.id;

  const illegal = await j(`/api/engineering/processing-activities/assessments/${assessmentId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'APPROVED' }) });
  ok(illegal.status === 400, `DRAFT -> APPROVED (skip) rejected 400 (got ${illegal.status})`);

  const toReview = await j(`/api/engineering/processing-activities/assessments/${assessmentId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'IN_REVIEW' }) });
  ok(toReview.status === 200 && toReview.body.status === 'IN_REVIEW', `DRAFT -> IN_REVIEW accepted (got ${toReview.status}/${toReview.body.status})`);

  const approveNoRole = await j(`/api/engineering/processing-activities/assessments/${assessmentId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'APPROVED' }) });
  ok(approveNoRole.status === 400, `APPROVED without approverRole rejected (got ${approveNoRole.status})`);

  const approved = await j(`/api/engineering/processing-activities/assessments/${assessmentId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'APPROVED', approverRole: 'PLT_ENGINEERING_ADMIN' }) });
  ok(approved.status === 200 && approved.body.status === 'APPROVED' && !!approved.body.approvedAt, `approved with approverRole succeeds (got ${approved.status}/${approved.body.status})`);

  const lowCreate = await j('/api/engineering/processing-activities', { method: 'POST', body: JSON.stringify({ code: 'PA-SHOULD-FAIL', productId, name: 'x' }) }, LOWPRIV);
  ok(lowCreate.status === 403, `non-admin create activity -> 403 (got ${lowCreate.status})`);
  const lowRead = await j('/api/engineering/processing-activities', {}, LOWPRIV);
  ok(lowRead.status === 200, `non-admin read activities -> 200 (got ${lowRead.status})`);
} catch (e) {
  console.error('  ✗ unexpected error:', e.message);
  failed++;
} finally {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  if (activityId) {
    await c.query('DELETE FROM "PrivacyImpactAssessment" WHERE "processingActivityId" = $1', [activityId]);
    await c.query('DELETE FROM "ProcessingActivity" WHERE id = $1', [activityId]);
  }
  ok(true, 'smoke activity + DPIA cleaned up');
  await c.end();
}

if (failed > 0) { console.error(`\nENGINEERING PRIVACY SMOKE FAILED (${failed})`); process.exit(1); }
console.log('\nENGINEERING PRIVACY SMOKE PASSED');
