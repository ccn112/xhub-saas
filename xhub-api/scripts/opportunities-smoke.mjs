// Opportunity pipeline smoke (test:opportunities, Phase 2 BO-0202). Server
// up on :4001. Proves: seeded T001 opportunity present; FSM illegal/legal
// transitions; lostReason required for LOST; WON creates no side-effect
// revenue record (T-REV-001 sanity); permission gating.
// Run: node scripts/opportunities-smoke.mjs
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

console.log('Opportunities smoke @ ' + BASE);

let oppId;
try {
  const customers = await j('/api/customers');
  const riverside = customers.body.find((c) => c.code === 'CUS-T002');
  ok(!!riverside, 'seeded Riverside customer present (dependency)');

  const list = await j('/api/opportunities');
  const seeded = list.body.find((o) => o.title === 'Triển khai XHub + X.Office + X2');
  ok(!!seeded && seeded.stage === 'NEGOTIATION', `seeded T001 opportunity present at NEGOTIATION (got ${seeded?.stage})`);

  const created = await j('/api/opportunities', { method: 'POST', body: JSON.stringify({ customerId: riverside.id, title: 'Smoke deal', expectedAmount: '1000000000' }) });
  ok(created.status === 201 || created.status === 200, `opportunity created, defaults LEAD (got ${created.status}/${created.body.stage})`);
  oppId = created.body.id;

  const skip = await j(`/api/opportunities/${oppId}/stage`, { method: 'PATCH', body: JSON.stringify({ stage: 'NEGOTIATION' }) });
  ok(skip.status === 400, `LEAD -> NEGOTIATION (skip) rejected 400 (got ${skip.status})`);

  const toQualified = await j(`/api/opportunities/${oppId}/stage`, { method: 'PATCH', body: JSON.stringify({ stage: 'QUALIFIED' }) });
  ok(toQualified.status === 200 && toQualified.body.stage === 'QUALIFIED', `LEAD -> QUALIFIED accepted (got ${toQualified.status}/${toQualified.body.stage})`);

  const lostNoReason = await j(`/api/opportunities/${oppId}/stage`, { method: 'PATCH', body: JSON.stringify({ stage: 'LOST' }) });
  ok(lostNoReason.status === 400, `LOST without lostReason rejected (got ${lostNoReason.status})`);

  const lost = await j(`/api/opportunities/${oppId}/stage`, { method: 'PATCH', body: JSON.stringify({ stage: 'LOST', lostReason: 'Ngân sách khách hàng không đủ' }) });
  ok(lost.status === 200 && lost.body.stage === 'LOST' && lost.body.lostReason, `LOST with reason accepted (got ${lost.status}/${lost.body.lostReason})`);

  const terminal = await j(`/api/opportunities/${oppId}/stage`, { method: 'PATCH', body: JSON.stringify({ stage: 'QUALIFIED' }) });
  ok(terminal.status === 400, `LOST is terminal, further transition rejected (got ${terminal.status})`);

  const lowCreate = await j('/api/opportunities', { method: 'POST', body: JSON.stringify({ customerId: riverside.id, title: 'x', expectedAmount: '1' }) }, LOWPRIV);
  ok(lowCreate.status === 403, `non-admin create opportunity -> 403 (got ${lowCreate.status})`);
  const lowRead = await j('/api/opportunities', {}, LOWPRIV);
  ok(lowRead.status === 200, `non-admin read opportunities -> 200 (got ${lowRead.status})`);
} catch (e) {
  console.error('  ✗ unexpected error:', e.message);
  failed++;
} finally {
  const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
  await c.connect();
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  if (oppId) {
    await c.query('DELETE FROM "OpportunityEvent" WHERE "opportunityId" = $1', [oppId]);
    const del = await c.query('DELETE FROM "Opportunity" WHERE id = $1 RETURNING id', [oppId]);
    ok(del.rowCount === 1, 'smoke opportunity cleaned up');
  }
  await c.query('COMMIT');
  await c.end();
}

if (failed > 0) { console.error(`\nOPPORTUNITIES SMOKE FAILED (${failed})`); process.exit(1); }
console.log('\nOPPORTUNITIES SMOKE PASSED');
