// Webhook inbound + transactional outbox + reconciliation smoke (Mục 8b).
// Re-runnable (run webhook-reset first). Server up on :4000. Run: npm run test:webhook
//
// Asserts: HMAC verify (bad signature → 401); inbound dedupe by event id;
// transactional outbox enqueue; dispatcher marks sent; retry/backoff then sent;
// reconcile drift report {consistent, issues}; tenant isolation via RLS.
import 'dotenv/config';
import { createHmac } from 'node:crypto';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const SECRET = process.env.WEBHOOK_SIGNING_SECRET || 'dev-webhook-secret';
const H = (tenant = 'tenant-xtech') => ({ 'content-type': 'application/json', 'x-tenant-id': tenant, 'x-user-id': 'user-nam' });

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };

const sign = (raw) => createHmac('sha256', SECRET).update(raw, 'utf8').digest('hex');

// POST a webhook with a valid/invalid signature over the EXACT raw body bytes.
const postHook = async (source, obj, { badSig = false, tenant = 'tenant-xtech' } = {}) => {
  const raw = JSON.stringify(obj);
  const sig = badSig ? 'deadbeef' : sign(raw);
  const r = await fetch(`${BASE}/api/webhooks/${source}`, {
    method: 'POST',
    headers: { ...H(tenant), 'x-webhook-signature': sig },
    body: raw,
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const j = async (path, opts = {}, tenant = 'tenant-xtech') => {
  const r = await fetch(BASE + path, { headers: H(tenant), ...opts });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

console.log('Webhook smoke @ ' + BASE);

// 1. Bad signature → 401.
const bad = await postHook('github', { id: 'evt-bad', type: 'push' }, { badSig: true });
ok(bad.status === 401, `bad signature rejected with 401 (got ${bad.status})`);

// 2. Valid inbound event A → recorded + outbox enqueued (same tx).
const a = await postHook('github', { id: 'evt-A', type: 'push', ref: 'main' });
ok(a.status === 201 || a.status === 200, 'valid inbound accepted');
ok(a.body?.deduped === false, 'event A is new (not deduped)');
ok(a.body?.event?.status === 'processed', `event A processed (got ${a.body?.event?.status})`);
ok(!!a.body?.outboxId, 'event A enqueued an outbox row (transactional outbox)');

// 3. Reconcile shows drift (undelivered outbox pending).
let rec = (await j('/api/webhooks/reconcile', { method: 'POST' })).body;
ok(rec?.consistent === false && rec?.pending >= 1, `reconcile reports drift while pending (pending=${rec?.pending}, consistent=${rec?.consistent})`);
ok(rec?.issues?.some((i) => i.type === 'outbox_pending'), 'issue: outbox_pending listed');

// 4. Dispatch → A delivered (sent).
const disp1 = (await j('/api/webhooks/dispatch?tenantId=tenant-xtech', { method: 'POST' })).body;
ok(disp1?.sent >= 1, `dispatch marked >=1 sent (sent=${disp1?.sent})`);

// 5. Reconcile now consistent.
rec = (await j('/api/webhooks/reconcile', { method: 'POST' })).body;
ok(rec?.consistent === true && rec?.pending === 0 && rec?.failed === 0, `reconcile consistent after dispatch (sent=${rec?.sent})`);

// 6. Idempotent dedupe — resend A (same id) → deduped, no new outbox.
const outboxBefore = ((await j('/api/webhooks/outbox')).body ?? []).length;
const aDup = await postHook('github', { id: 'evt-A', type: 'push', ref: 'main' });
ok(aDup.body?.deduped === true, 'resent event A is deduped by (tenant,source,externalId)');
const outboxAfter = ((await j('/api/webhooks/outbox')).body ?? []).length;
ok(outboxAfter === outboxBefore, 'dedupe enqueued no additional outbox row');

// 7. Retry/backoff: event B fails until attempt 2, then succeeds.
const b = await postHook('stripe', { id: 'evt-B', type: 'charge', __failUntilAttempt: 2 });
ok(b.body?.deduped === false, 'event B accepted');
const dispB1 = (await j('/api/webhooks/dispatch?tenantId=tenant-xtech', { method: 'POST' })).body;
ok(dispB1?.retried >= 1, `first dispatch of B retried (retried=${dispB1?.retried})`);
const bPending = ((await j('/api/webhooks/outbox?status=pending')).body ?? []).length;
ok(bPending >= 1, 'B still pending after first (failed) attempt');
const dispB2 = (await j('/api/webhooks/dispatch?tenantId=tenant-xtech', { method: 'POST' })).body;
ok(dispB2?.sent >= 1, `second dispatch of B succeeds (sent=${dispB2?.sent})`);
rec = (await j('/api/webhooks/reconcile', { method: 'POST' })).body;
ok(rec?.consistent === true, 'reconcile consistent after B recovers');

// 8. Tenant isolation — demo-isolation sees none of xtech's events/outbox.
const demoEvents = (await j('/api/webhooks/events', {}, 'tenant-demo-isolation')).body ?? [];
ok(!demoEvents.some((e) => e.tenantId === 'tenant-xtech'), 'demo-isolation sees no xtech webhook events');
const demoOutbox = (await j('/api/webhooks/outbox', {}, 'tenant-demo-isolation')).body ?? [];
ok(!demoOutbox.some((o) => o.tenantId === 'tenant-xtech'), 'demo-isolation sees no xtech outbox events');

console.log(failed === 0 ? '\nWEBHOOK SMOKE PASSED' : `\nWEBHOOK SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
