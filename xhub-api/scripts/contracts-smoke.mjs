// Contract smoke (test:contracts, Phase 2 BO-0206/0207/0208). Server up on
// :4001. Proves: seeded T001 contract EFFECTIVE with 4 lines + signature +
// 4 milestone obligations (1 COMPLETED with a READY BillingRequest);
// throwaway contract — FSM guard, EFFECTIVE requires a signature first,
// line immutability after SIGNING (T-CON-001), auto-generated
// MILESTONE_BILLING obligation on EFFECTIVE, obligation complete + billing
// request generation (idempotent).
// Run: node scripts/contracts-smoke.mjs
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

console.log('Contracts smoke @ ' + BASE);

let contractId;
try {
  const customers = await j('/api/customers');
  const riverside = customers.body.find((c) => c.code === 'CUS-T002');

  // --- Seeded T001 contract sanity ---
  const list = await j('/api/contracts');
  const seeded = list.body.find((c) => c.contractNo === 'XTECH-RIVERSIDE-2026-001');
  ok(!!seeded && seeded.status === 'EFFECTIVE', `seeded T001 contract EFFECTIVE (got ${seeded?.status})`);
  ok(Number(seeded?.totalAmount) === 4800000000, `seeded contract total = 4.8B VND (got ${seeded?.totalAmount})`);

  const seededDetail = await j(`/api/contracts/${seeded.id}`);
  ok(seededDetail.body.lines.length === 4, `seeded contract has 4 lines (got ${seededDetail.body.lines.length})`);
  ok(seededDetail.body.signatures.length === 1, `seeded contract has 1 signature (got ${seededDetail.body.signatures.length})`);
  ok(seededDetail.body.obligations.length === 4, `seeded contract has 4 milestone obligations (got ${seededDetail.body.obligations.length})`);
  const completedMs = seededDetail.body.obligations.find((o) => o.status === 'COMPLETED');
  ok(!!completedMs, 'one milestone (MS-01) is COMPLETED with evidence');
  const seededBilling = await j(`/api/contracts/billing-requests?contractId=${seeded.id}`);
  ok(seededBilling.body.some((b) => b.status === 'READY'), 'a READY BillingRequest exists for the completed milestone');

  // --- Throwaway contract: full FSM + immutability + e-sig + obligations ---
  const catalog = await j('/api/commercial-catalog');
  const item = catalog.body.find((i) => i.code === 'XHUB-ENT');

  const created = await j('/api/contracts', { method: 'POST', body: JSON.stringify({ customerId: riverside.id }) });
  ok(created.status === 201 || created.status === 200, `contract created, status=DRAFT (got ${created.status}/${created.body.status})`);
  contractId = created.body.id;

  const line = await j(`/api/contracts/${contractId}/lines`, { method: 'POST', body: JSON.stringify({ catalogItemId: item.id, deliveryMethod: 'PROJECT', billingMethod: 'MILESTONE', lineValue: '500000000' }) });
  ok(line.status === 201 || line.status === 200, `line added while DRAFT (got ${line.status})`);

  const skip = await j(`/api/contracts/${contractId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'SIGNING' }) });
  ok(skip.status === 400, `DRAFT -> SIGNING (skip) rejected 400 (got ${skip.status})`);

  for (const s of ['REVIEW', 'APPROVED']) {
    const r = await j(`/api/contracts/${contractId}/status`, { method: 'PATCH', body: JSON.stringify({ status: s }) });
    ok(r.status === 200 && r.body.status === s, `-> ${s} accepted (got ${r.status})`);
  }

  const effectiveNoSig = await j(`/api/contracts/${contractId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'SIGNING' }) });
  ok(effectiveNoSig.status === 200, `APPROVED -> SIGNING accepted (got ${effectiveNoSig.status})`);

  const lineAfterSigning = await j(`/api/contracts/${contractId}/lines`, { method: 'POST', body: JSON.stringify({ catalogItemId: item.id, deliveryMethod: 'PROJECT', billingMethod: 'MILESTONE', lineValue: '1' }) });
  ok(lineAfterSigning.status === 400, `T-CON-001: line mutation rejected once SIGNING (got ${lineAfterSigning.status})`);

  const effectiveNoSigYet = await j(`/api/contracts/${contractId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'EFFECTIVE' }) });
  ok(effectiveNoSigYet.status === 400, `cannot go EFFECTIVE with zero signatures (got ${effectiveNoSigYet.status})`);

  const signed = await j(`/api/contracts/${contractId}/sign`, { method: 'POST', body: JSON.stringify({ signerName: 'Smoke Signer' }) });
  ok(signed.status === 201 || signed.status === 200, `sign() records a signature (got ${signed.status})`);

  const effective = await j(`/api/contracts/${contractId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'EFFECTIVE' }) });
  ok(effective.status === 200 && effective.body.status === 'EFFECTIVE', `SIGNING -> EFFECTIVE accepted now that a signature exists (got ${effective.status})`);

  const detail = await j(`/api/contracts/${contractId}`);
  ok(detail.body.obligations.length === 1 && detail.body.obligations[0].type === 'MILESTONE_BILLING', `1 obligation auto-generated from the MILESTONE line (got ${detail.body.obligations.length})`);
  const obligationId = detail.body.obligations[0].id;
  ok(['PENDING', 'DUE_SOON'].includes(detail.body.obligations[0].alertStatus), `computed alertStatus is sane (got ${detail.body.obligations[0].alertStatus})`);

  const completeNoEvidence = await j(`/api/contracts/obligations/${obligationId}/complete`, { method: 'POST', body: JSON.stringify({}) });
  ok(completeNoEvidence.status === 400, `complete without evidenceRef rejected (got ${completeNoEvidence.status})`);

  const complete = await j(`/api/contracts/obligations/${obligationId}/complete`, { method: 'POST', body: JSON.stringify({ evidenceRef: 'smoke evidence doc' }) });
  ok(complete.status === 201 || complete.status === 200, `obligation completed with evidence (got ${complete.status})`);

  const idemKey = 'smoke-billing-' + Date.now();
  const billing1 = await j(`/api/contracts/obligations/${obligationId}/billing-request`, { method: 'POST', body: JSON.stringify({ idempotencyKey: idemKey }) });
  ok(billing1.status === 201 || billing1.status === 200, `billing request generated, READY (got ${billing1.status}/${billing1.body.status})`);
  const billing2 = await j(`/api/contracts/obligations/${obligationId}/billing-request`, { method: 'POST', body: JSON.stringify({ idempotencyKey: idemKey }) });
  ok(billing2.body.replayed === true && billing2.body.id === billing1.body.id, 'replayed billing request returns the original (idempotent, no duplicate financial submission)');

  const lowCreate = await j('/api/contracts', { method: 'POST', body: JSON.stringify({ customerId: riverside.id }) }, LOWPRIV);
  ok(lowCreate.status === 403, `non-admin create contract -> 403 (got ${lowCreate.status})`);
  const lowRead = await j('/api/contracts', {}, LOWPRIV);
  ok(lowRead.status === 200, `non-admin read contracts -> 200 (got ${lowRead.status})`);
} catch (e) {
  console.error('  ✗ unexpected error:', e.message);
  failed++;
} finally {
  const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
  await c.connect();
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  if (contractId) {
    await c.query('DELETE FROM "BillingRequest" WHERE "contractId" = $1', [contractId]);
    await c.query('DELETE FROM "ContractObligation" WHERE "contractId" = $1', [contractId]);
    await c.query('DELETE FROM "ContractSignature" WHERE "contractId" = $1', [contractId]);
    await c.query('DELETE FROM "ContractEvent" WHERE "contractId" = $1', [contractId]);
    await c.query('DELETE FROM "ContractLine" WHERE "contractId" = $1', [contractId]);
    const del = await c.query('DELETE FROM "Contract" WHERE id = $1 RETURNING id', [contractId]);
    ok(del.rowCount === 1, 'smoke contract cleaned up');
  }
  await c.query('COMMIT');
  await c.end();
}

if (failed > 0) { console.error(`\nCONTRACTS SMOKE FAILED (${failed})`); process.exit(1); }
console.log('\nCONTRACTS SMOKE PASSED');
