// Product Customer Support smoke (test:support-cases, 2026-08-06). Needs BOTH
// processes up: X.Office (:4001, where SupportCase lives) AND XHub Platform
// (:4000, where the escalate action files a real BacklogItem/Defect). Proves:
// seeded X2 scenario present; idempotent create; FSM legal/illegal transitions;
// escalate→BacklogItem (cross-process, sourceRef/correlationId wired back to
// the case); escalate→Defect; escalate is idempotent (2nd call replays, does
// NOT file a second item); tenant isolation; permission gating.
// Run: node scripts/support-cases-smoke.mjs
import 'dotenv/config';
import pg from 'pg';

const XOFFICE = process.env.XOFFICE_BASE || 'http://localhost:4001';
const PLATFORM = process.env.PLATFORM_API_URL || 'http://localhost:4000';
const ADMIN = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };
const LOWPRIV = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-huyvu', 'x-authz-enforce': 'true' };
const OTHER_TENANT = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-demo-isolation', 'x-user-id': 'user-nam' };

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const jx = async (path, opts = {}, headers = ADMIN) => {
  const r = await fetch(XOFFICE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const jp = async (path, headers = ADMIN) => {
  const r = await fetch(PLATFORM + path, { headers });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};

console.log('Product Customer Support smoke @ ' + XOFFICE + ' + ' + PLATFORM);

let smokeCaseId;
let smokeCaseId2;
try {
  const list = await jx('/api/support-cases');
  const items = list.body?.items ?? [];
  ok(items.some((c) => c.code === 'SUP-2026-0001'), 'seeded hotline-change case present (SUP-2026-0001)');
  const recon = items.find((c) => c.code === 'SUP-2026-0002');
  ok(recon?.category === 'DATA_FIX' && recon?.productCode === 'PRD-X2', 'seeded reconciliation case is DATA_FIX for PRD-X2');
  ok(!!recon?.customerId, 'seeded case linked to the T001 reference customer');

  // idempotent create
  const idemKey = 'smoke-' + Date.now();
  const created = await jx('/api/support-cases', {
    method: 'POST',
    body: JSON.stringify({ title: 'Smoke case', productCode: 'PRD-X2', category: 'BUG_REPORT', priority: 'URGENT', idempotencyKey: idemKey }),
  });
  ok(created.status === 200 || created.status === 201, `create case (got ${created.status})`);
  smokeCaseId = created.body.id;
  const replay = await jx('/api/support-cases', { method: 'POST', body: JSON.stringify({ title: 'ignored', productCode: 'PRD-X2', idempotencyKey: idemKey }) });
  ok(replay.body.replayed === true && replay.body.id === smokeCaseId, 'replayed create with same idempotencyKey returns the original');

  // FSM: illegal transition rejected, legal path succeeds
  const badResolve = await jx(`/api/support-cases/${smokeCaseId}/resolve`, { method: 'POST', body: '{}' });
  ok(badResolve.status === 400, `resolve from NEW is illegal -> 400 (got ${badResolve.status})`);
  const triage = await jx(`/api/support-cases/${smokeCaseId}/triage`, { method: 'POST', body: '{}' });
  ok(triage.body?.case?.status === 'TRIAGED', `triage NEW->TRIAGED (got ${triage.body?.case?.status})`);
  const start = await jx(`/api/support-cases/${smokeCaseId}/start`, { method: 'POST', body: '{}' });
  ok(start.body?.case?.status === 'IN_PROGRESS', `start TRIAGED->IN_PROGRESS (got ${start.body?.case?.status})`);

  // escalate -> BacklogItem (cross-process)
  const esc1 = await jx(`/api/support-cases/${smokeCaseId}/escalate`, {
    method: 'POST',
    body: JSON.stringify({ type: 'BACKLOG', backlogType: 'FEATURE' }),
  });
  ok((esc1.status === 200 || esc1.status === 201) && esc1.body?.escalated?.type === 'BACKLOG', `escalate to BACKLOG (got ${esc1.status}, ${JSON.stringify(esc1.body?.escalated)})`);
  ok(esc1.body?.case?.escalationType === 'BACKLOG' && !!esc1.body?.case?.escalatedItemCode, 'case now carries escalationType + escalatedItemCode');

  const backlogItem = await jp(`/api/engineering/backlog/${esc1.body.escalated.itemId}`);
  ok(backlogItem.status === 200, `filed BacklogItem readable on Platform (got ${backlogItem.status})`);
  ok(backlogItem.body?.sourceSystem === 'xoffice-support', `BacklogItem.sourceSystem = xoffice-support (got ${backlogItem.body?.sourceSystem})`);
  ok(backlogItem.body?.correlationId === smokeCaseId, 'BacklogItem.correlationId = support case id (round-trip provenance)');

  // idempotent escalate: 2nd call replays, does not file a 2nd backlog item
  const esc2 = await jx(`/api/support-cases/${smokeCaseId}/escalate`, { method: 'POST', body: JSON.stringify({ type: 'BACKLOG' }) });
  ok(esc2.body?.replayed === true && esc2.body?.escalated?.itemId === esc1.body.escalated.itemId, 'repeat escalate is idempotent (same item, no duplicate)');

  // escalate -> Defect on a second case
  const created2 = await jx('/api/support-cases', { method: 'POST', body: JSON.stringify({ title: 'Smoke defect case', productCode: 'PRD-X2', category: 'BUG_REPORT', priority: 'HIGH' }) });
  smokeCaseId2 = created2.body.id;
  const esc3 = await jx(`/api/support-cases/${smokeCaseId2}/escalate`, { method: 'POST', body: JSON.stringify({ type: 'DEFECT' }) });
  ok((esc3.status === 200 || esc3.status === 201) && esc3.body?.escalated?.type === 'DEFECT', `escalate to DEFECT (got ${esc3.status})`);
  const defect = await jp(`/api/engineering/defects/${esc3.body.escalated.itemId}`);
  ok(defect.status === 200 && defect.body?.sourceRef, `filed Defect readable on Platform with sourceRef (got ${defect.body?.sourceRef})`);

  // unknown product -> 404, not a confusing downstream error
  const created3 = await jx('/api/support-cases', { method: 'POST', body: JSON.stringify({ title: 'Bad product', productCode: 'PRD-DOES-NOT-EXIST' }) });
  const escBad = await jx(`/api/support-cases/${created3.body.id}/escalate`, { method: 'POST', body: JSON.stringify({ type: 'BACKLOG' }) });
  ok(escBad.status === 404, `escalate with unknown productCode -> 404 (got ${escBad.status})`);
  await jx(`/api/support-cases/${created3.body.id}/cancel`, { method: 'POST', body: '{}' });

  // tenant isolation
  const otherTenantList = await jx('/api/support-cases', {}, OTHER_TENANT);
  const otherItems = otherTenantList.body?.items ?? [];
  ok(!otherItems.some((c) => c.code === 'SUP-2026-0001'), 'a different tenant sees NONE of tenant-xtech\'s support cases (RLS isolation)');

  // permission gating: low-priv (no PRODUCT_SUPPORT_AGENT) create -> 403; read open
  const lowCreate = await jx('/api/support-cases', { method: 'POST', body: JSON.stringify({ title: 'should fail', productCode: 'PRD-X2' }) }, LOWPRIV);
  ok(lowCreate.status === 403, `non-agent create -> 403 (got ${lowCreate.status})`);
  const lowRead = await jx('/api/support-cases', {}, LOWPRIV);
  ok(lowRead.status === 200, `non-agent read -> 200 (got ${lowRead.status})`);
} catch (e) {
  console.error('  ✗ unexpected error:', e.message);
  failed++;
} finally {
  const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
  await c.connect();
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  for (const id of [smokeCaseId, smokeCaseId2]) {
    if (!id) continue;
    await c.query('DELETE FROM "SupportCaseEvent" WHERE "supportCaseId" = $1', [id]);
    await c.query('DELETE FROM "SupportCase" WHERE id = $1', [id]);
  }
  await c.query('COMMIT');
  await c.end();
  console.log('  · smoke support cases cleaned up (filed BacklogItem/Defect left on Platform for provenance inspection)');
}

if (failed > 0) { console.error(`\nSUPPORT CASES SMOKE FAILED (${failed})`); process.exit(1); }
console.log('\nSUPPORT CASES SMOKE PASSED');
