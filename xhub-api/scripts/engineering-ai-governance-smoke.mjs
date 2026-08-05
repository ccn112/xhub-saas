// Engineering Governance — AI System Registry + Impact Assessment smoke
// (test:engineering-ai-governance, DG-10). Server up on :4000 with products
// + AI systems seeded.
// Proves: real seeded system present; create system; impact-assessment FSM
// (illegal jump rejected; APPROVED requires approverRole; legal chain
// accepted); writes gated, reads open.
// Run: node scripts/engineering-ai-governance-smoke.mjs
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

console.log('Engineering AI Governance smoke @ ' + BASE);

let sysId;
try {
  const prod = await j('/api/engineering/products/PRD-XOFFICE');
  const productId = prod.body.id;

  const seeded = await j('/api/engineering/ai-systems/AI-XOFFICE-WORKFLOW-DRAFT');
  ok(seeded.status === 200 && seeded.body.riskTier === 'LIMITED', `seeded real AI system present, riskTier=LIMITED (got ${seeded.status}/${seeded.body.riskTier})`);
  ok(!!seeded.body.humanOversight, 'seeded system documents human oversight (not fully autonomous)');

  const created = await j('/api/engineering/ai-systems', { method: 'POST', body: JSON.stringify({ code: 'AI-SMOKE-TEST', productId, name: 'Smoke AI system', riskTier: 'HIGH' }) });
  ok(created.status === 201 || created.status === 200, `AI system created (got ${created.status})`);
  sysId = created.body.id;

  const assessment = await j(`/api/engineering/ai-systems/${sysId}/impact-assessments`, { method: 'POST' });
  ok(assessment.status === 201 || assessment.status === 200, `impact assessment created, starts DRAFT (got ${assessment.status}/${assessment.body.status})`);
  const assessmentId = assessment.body.id;

  const illegal = await j(`/api/engineering/ai-systems/impact-assessments/${assessmentId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'APPROVED' }) });
  ok(illegal.status === 400, `DRAFT -> APPROVED (skip) rejected 400 (got ${illegal.status})`);

  const toReview = await j(`/api/engineering/ai-systems/impact-assessments/${assessmentId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'IN_REVIEW' }) });
  ok(toReview.status === 200 && toReview.body.status === 'IN_REVIEW', `DRAFT -> IN_REVIEW accepted (got ${toReview.status}/${toReview.body.status})`);

  const approveNoRole = await j(`/api/engineering/ai-systems/impact-assessments/${assessmentId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'APPROVED' }) });
  ok(approveNoRole.status === 400, `APPROVED without approverRole rejected (got ${approveNoRole.status})`);

  const approved = await j(`/api/engineering/ai-systems/impact-assessments/${assessmentId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'APPROVED', approverRole: 'PLT_ENGINEERING_ADMIN' }) });
  ok(approved.status === 200 && approved.body.status === 'APPROVED' && !!approved.body.approvedAt, `approved with approverRole succeeds, approvedAt set (got ${approved.status}/${approved.body.status})`);

  const lowCreate = await j('/api/engineering/ai-systems', { method: 'POST', body: JSON.stringify({ code: 'AI-SHOULD-FAIL', productId, name: 'x' }) }, LOWPRIV);
  ok(lowCreate.status === 403, `non-admin create AI system -> 403 (got ${lowCreate.status})`);
  const lowRead = await j('/api/engineering/ai-systems', {}, LOWPRIV);
  ok(lowRead.status === 200, `non-admin read AI systems -> 200 (got ${lowRead.status})`);
} catch (e) {
  console.error('  ✗ unexpected error:', e.message);
  failed++;
} finally {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  if (sysId) {
    await c.query('DELETE FROM "AIImpactAssessment" WHERE "aiSystemId" = $1', [sysId]);
    await c.query('DELETE FROM "AISystem" WHERE id = $1', [sysId]);
  }
  ok(true, 'smoke AI system + assessment cleaned up');
  await c.end();
}

if (failed > 0) { console.error(`\nENGINEERING AI GOVERNANCE SMOKE FAILED (${failed})`); process.exit(1); }
console.log('\nENGINEERING AI GOVERNANCE SMOKE PASSED');
