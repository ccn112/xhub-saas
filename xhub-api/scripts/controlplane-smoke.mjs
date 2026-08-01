// Control Plane smoke: catalog, enable app, bind → provision (completed +
// externalAccountId + sourceRef), idempotent replay, duplicate → conflict,
// transient-failure retry recovery, reconciliation, and tenant isolation.
// Run: node scripts/controlplane-smoke.mjs   (server must be up on :4000)
import 'dotenv/config';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const H = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); failed++; }
};
const j = async (path, opts = {}) => {
  const r = await fetch(BASE + path, { headers: H, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};

console.log('Control Plane smoke @ ' + BASE);

// 1. Catalog contains x1/x2/xweb.
const cat = await j('/api/controlplane/applications');
const codes = (cat.body ?? []).map((a) => a.code);
ok(cat.status === 200, 'GET applications 200');
ok(['x1', 'x2', 'xweb'].every((c) => codes.includes(c)), `catalog has x1/x2/xweb (got ${codes.join(',')})`);

// 2. Enable xweb for tenant, confirm.
const en = await j('/api/controlplane/tenant-applications', { method: 'POST', body: JSON.stringify({ applicationCode: 'xweb', status: 'enabled' }) });
ok(en.status === 201 || en.status === 200, 'POST tenant-applications enable xweb');
const tapps = await j('/api/controlplane/tenant-applications');
ok((tapps.body ?? []).some((t) => t.applicationCode === 'xweb' && t.status === 'enabled'), 'xweb enabled for tenant');

// 3. Bind a person → provisioning command completed with externalAccountId + sourceRef.
const PERSON = 'usr-sales-head';
const b1 = await j('/api/controlplane/app-account-bindings', { method: 'POST', body: JSON.stringify({ personId: PERSON, applicationCode: 'xweb' }) });
// Re-runnable: first run → command completed; later runs → already active (conflict).
// Either way, verify a real provisioned binding exists (active + externalAccountId + sourceRef).
let bind = b1.body?.binding;
let cmd = b1.body?.command;
if (cmd?.status !== 'completed') {
  const existing = await j(`/api/controlplane/app-account-bindings?applicationCode=xweb`);
  bind = (existing.body ?? []).find((x) => x.personId === PERSON) ?? bind;
  const cmds = await j('/api/controlplane/provisioning-commands');
  cmd = (cmds.body ?? []).filter((c) => c.personId === PERSON && c.applicationCode === 'xweb' && c.status === 'completed').slice(-1)[0] ?? cmd;
}
ok(cmd?.status === 'completed', `bind ${PERSON}->xweb provisioned (completed; got initial ${b1.body?.command?.status})`);
ok(!!cmd?.sourceRef?.id, `command carries sourceRef.id (${cmd?.sourceRef?.id})`);
ok(bind?.status === 'active' && !!bind?.externalAccountId, `binding active with externalAccountId (${bind?.externalAccountId})`);
ok(typeof bind?.roleMappingVersion === 'number', `binding roleMappingVersion set (${bind?.roleMappingVersion})`);
const idemKey = 'smoke-idem-1';

// 4. Idempotent replay (explicit same key).
const r1 = await j('/api/controlplane/app-account-bindings', { method: 'POST', body: JSON.stringify({ personId: 'usr-ceo', applicationCode: 'xweb', idempotencyKey: idemKey }) });
const r2 = await j('/api/controlplane/app-account-bindings', { method: 'POST', body: JSON.stringify({ personId: 'usr-ceo', applicationCode: 'xweb', idempotencyKey: idemKey }) });
ok(r1.body?.command?.id && r1.body?.command?.id === r2.body?.command?.id, 'same idempotencyKey replays same command');
ok(r2.body?.replayed === true, 'second call flagged replayed');

// 5. Duplicate active binding (fresh key) → conflict.
const dup = await j('/api/controlplane/app-account-bindings', { method: 'POST', body: JSON.stringify({ personId: PERSON, applicationCode: 'xweb' }) });
ok(dup.body?.command?.status === 'conflict', `duplicate bind -> conflict command (got ${dup.body?.command?.status})`);
const conflicts = await j('/api/controlplane/provisioning-conflicts?resolved=false');
ok((conflicts.body ?? []).length >= 1, `conflict center has >=1 open conflict (got ${(conflicts.body ?? []).length})`);

// 6. Transient failure + retry recovery.
const fp = await j('/api/controlplane/app-account-bindings', { method: 'POST', body: JSON.stringify({ personId: 'usr-tech-head', applicationCode: 'xweb', payload: { __failUntilAttempt: 2 } }) });
ok(fp.body?.command?.status === 'failed', `injected transient failure -> failed (got ${fp.body?.command?.status})`);
const retry = await j(`/api/controlplane/provisioning-commands/${fp.body.command.id}/retry`, { method: 'POST' });
ok(retry.body?.command?.status === 'completed', `retry recovers -> completed (got ${retry.body?.command?.status})`);
ok(retry.body?.command?.attempts === 2, `attempts incremented to 2 (got ${retry.body?.command?.attempts})`);

// 7. Commands list + status filter.
const cmds = await j('/api/controlplane/provisioning-commands?status=completed');
ok((cmds.body ?? []).every((c) => c.status === 'completed'), 'commands?status=completed filter works');

// 8. Reconcile.
const rec = await j('/api/controlplane/reconcile', { method: 'POST' });
ok(rec.status === 201 || rec.status === 200, 'POST reconcile 200');
ok(rec.body?.consistent === true, `reconcile consistent (issues=${JSON.stringify(rec.body?.issues)})`);

// 9. Tenant isolation — demo-isolation must NOT see xtech control-plane rows.
const DH = { ...H, 'x-tenant-id': 'tenant-demo-isolation' };
const demoBindings = await fetch(BASE + '/api/controlplane/app-account-bindings', { headers: DH }).then((r) => r.json());
const leak = (demoBindings ?? []).filter((b) => b.tenantId === 'tenant-xtech');
ok(leak.length === 0, `demo-isolation sees 0 xtech bindings (got ${leak.length})`);
const demoApps = await fetch(BASE + '/api/controlplane/tenant-applications', { headers: DH }).then((r) => r.json());
ok((demoApps ?? []).every((a) => a.tenantId !== 'tenant-xtech'), 'demo-isolation sees no xtech tenant-applications');

console.log(failed === 0 ? '\nCONTROL PLANE SMOKE PASSED' : `\nCONTROL PLANE SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
