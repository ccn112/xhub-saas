// Proposal smoke (test:proposals, Phase 2 BO-0204/BO-0205). Server up on
// :4001. Proves: seeded T001 proposal present with requiresApproval=true
// (20% discount line); throwaway proposal — add line, total recomputed,
// discount threshold sets requiresApproval, FSM guard (illegal transition,
// approverNote required above threshold), lines locked once IN_REVIEW.
// Run: node scripts/proposals-smoke.mjs
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4001';
const ADMIN = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };
const LOWPRIV = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-huyvu', 'x-authz-enforce': 'true' };

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const j = async (path, opts = {}, headers = ADMIN) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};

console.log('Proposals smoke @ ' + BASE);

let oppId, proposalId;
try {
  const customers = await j('/api/customers');
  const riverside = customers.body.find((c) => c.code === 'CUS-T002');
  const opps = await j('/api/opportunities');
  const seededOpp = opps.body.find((o) => o.title === 'Triển khai XHub + X.Office + X2');
  const seededProposals = await j(`/api/proposals?opportunityId=${seededOpp.id}`);
  ok(seededProposals.body.some((p) => p.requiresApproval === true), 'seeded T001 proposal flagged requiresApproval (20% discount line)');

  const catalog = await j('/api/commercial-catalog');
  const item = catalog.body.find((i) => i.code === 'XHUB-ENT');

  const oppRes = await j('/api/opportunities', { method: 'POST', body: JSON.stringify({ customerId: riverside.id, title: 'Smoke proposal deal', expectedAmount: '100000000' }) });
  oppId = oppRes.body.id;

  const created = await j('/api/proposals', { method: 'POST', body: JSON.stringify({ opportunityId: oppId }) });
  ok(created.status === 201 || created.status === 200, `proposal created, version=1, status=DRAFT (got ${created.status}/v${created.body.version}/${created.body.status})`);
  proposalId = created.body.id;

  const line1 = await j(`/api/proposals/${proposalId}/lines`, { method: 'POST', body: JSON.stringify({ catalogItemId: item.id, quantity: 2, unitPrice: '1000000' }) });
  ok(line1.status === 201 || line1.status === 200, `line added (got ${line1.status})`);
  const afterLine1 = await j(`/api/proposals/${proposalId}`);
  ok(Number(afterLine1.body.proposal.totalAmount) === 2000000, `total recomputed (got ${afterLine1.body.proposal.totalAmount})`);
  ok(afterLine1.body.proposal.requiresApproval === false, 'no approval needed under threshold');

  const line2 = await j(`/api/proposals/${proposalId}/lines`, { method: 'POST', body: JSON.stringify({ catalogItemId: item.id, quantity: 1, unitPrice: '1000000', discountPercent: 25 }) });
  ok(line2.status === 201 || line2.status === 200, `discounted line added (got ${line2.status})`);
  const afterLine2 = await j(`/api/proposals/${proposalId}`);
  ok(afterLine2.body.proposal.requiresApproval === true, 'discount above threshold sets requiresApproval (BO-0205)');

  const skip = await j(`/api/proposals/${proposalId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'SENT' }) });
  ok(skip.status === 400, `DRAFT -> SENT (skip) rejected 400 (got ${skip.status})`);

  const toReview = await j(`/api/proposals/${proposalId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'IN_REVIEW' }) });
  ok(toReview.status === 200, `DRAFT -> IN_REVIEW accepted (got ${toReview.status})`);

  const lineAfterReview = await j(`/api/proposals/${proposalId}/lines`, { method: 'POST', body: JSON.stringify({ catalogItemId: item.id, unitPrice: '1' }) });
  ok(lineAfterReview.status === 400, `lines locked once not-DRAFT (got ${lineAfterReview.status})`);

  const approveNoNote = await j(`/api/proposals/${proposalId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'APPROVED' }) });
  ok(approveNoNote.status === 400, `APPROVED without approverNote rejected above threshold (got ${approveNoNote.status})`);

  const approved = await j(`/api/proposals/${proposalId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'APPROVED', approverNote: 'Duyệt giảm giá theo thoả thuận riêng' }) });
  ok(approved.status === 200 && approved.body.status === 'APPROVED', `approved with note succeeds (got ${approved.status})`);

  const lowCreate = await j('/api/proposals', { method: 'POST', body: JSON.stringify({ opportunityId: oppId }) }, LOWPRIV);
  ok(lowCreate.status === 403, `non-admin create proposal -> 403 (got ${lowCreate.status})`);
} catch (e) {
  console.error('  ✗ unexpected error:', e.message);
  failed++;
} finally {
  const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
  await c.connect();
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  if (proposalId) {
    await c.query('DELETE FROM "ProposalEvent" WHERE "proposalId" = $1', [proposalId]);
    await c.query('DELETE FROM "ProposalLine" WHERE "proposalId" = $1', [proposalId]);
    await c.query('DELETE FROM "Proposal" WHERE id = $1', [proposalId]);
  }
  if (oppId) {
    await c.query('DELETE FROM "OpportunityEvent" WHERE "opportunityId" = $1', [oppId]);
    await c.query('DELETE FROM "Opportunity" WHERE id = $1', [oppId]);
  }
  ok(true, 'smoke proposal + opportunity cleaned up');
  await c.query('COMMIT');
  await c.end();
}

if (failed > 0) { console.error(`\nPROPOSALS SMOKE FAILED (${failed})`); process.exit(1); }
console.log('\nPROPOSALS SMOKE PASSED');
