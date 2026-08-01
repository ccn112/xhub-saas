// Authorization/authentication hardening smoke (test:authz).
//
// Proves the ADDITIVE, ENV-GATED auth hardening WITHOUT changing the default
// runtime: enforcement is driven PER-REQUEST via the test-only `x-authz-enforce`
// header (mirrors controlplane's `__failUntilAttempt` hook). The server keeps
// running with AUTH_ENFORCE unset, so every other smoke stays soft/green.
//
// Asserts, on a gated write endpoint (POST /api/controlplane/reconcile,
// @RequirePermission('provisioning.manage')):
//   1. ALLOW  — admin/CEO (user-nam → ROLE_PLATFORM_ADMIN) → 2xx when enforcing.
//   2. DENY   — low-priv (user-huyvu → ROLE_IT_SUPPORT) → 403 when enforcing.
//   3. 401    — header identity disabled (x-authz-allow-header:false) + no
//               session → 401 on the protected route.
//   4. OIDC   — mock login round-trips to a working session cookie.
//
// Re-runnable: reconcile is idempotent; the test writes no durable fixture of
// its own. Run: node scripts/authz-smoke.mjs   (server up on :4000)
import 'dotenv/config';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const ADMIN = { 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };
const LOWPRIV = { 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-huyvu' };
const ENFORCE = { 'x-authz-enforce': 'true' };

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); failed++; }
};
const call = async (path, opts = {}) => {
  const r = await fetch(BASE + path, { redirect: 'manual', ...opts });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body, headers: r.headers };
};

console.log('Authz hardening smoke @ ' + BASE);

// 0. Baseline: with enforcement OFF (no header), admin AND low-priv both pass
//    the gated route — proves default runtime is unchanged (soft no-op).
const softAdmin = await call('/api/controlplane/reconcile', { method: 'POST', headers: ADMIN });
ok(softAdmin.status === 200 || softAdmin.status === 201, `soft (no enforce) admin reconcile 2xx (got ${softAdmin.status})`);
const softLow = await call('/api/controlplane/reconcile', { method: 'POST', headers: LOWPRIV });
ok(softLow.status === 200 || softLow.status === 201, `soft (no enforce) low-priv reconcile 2xx — default unchanged (got ${softLow.status})`);

// 1. ALLOW — enforcing, admin/CEO holds provisioning.manage.
const allow = await call('/api/controlplane/reconcile', { method: 'POST', headers: { ...ADMIN, ...ENFORCE } });
ok(allow.status === 200 || allow.status === 201, `ENFORCE: admin (user-nam) ALLOWED on reconcile (got ${allow.status})`);

// 2. DENY — enforcing, low-priv lacks provisioning.manage.
const deny = await call('/api/controlplane/reconcile', { method: 'POST', headers: { ...LOWPRIV, ...ENFORCE } });
ok(deny.status === 403, `ENFORCE: low-priv (user-huyvu) DENIED 403 on reconcile (got ${deny.status})`);
ok(typeof deny.body?.message === 'string' && /provisioning\.manage/.test(deny.body.message), `403 message names the missing permission`);

// 3. 401 — header identity disabled + no session → unauthenticated on protected route.
const anon = await call('/api/controlplane/reconcile', {
  method: 'POST',
  headers: { ...ADMIN, ...ENFORCE, 'x-authz-allow-header': 'false' },
});
ok(anon.status === 401, `header-identity OFF + no session → 401 on protected route (got ${anon.status})`);

// 4. Mock OIDC round-trip → session cookie → /api/auth/me works.
const OIDC = { 'x-authz-oidc': 'true' };
const login = await call('/api/auth/oidc/login?loginHint=user-nam', { headers: OIDC });
ok(login.status === 302, `oidc/login redirects (302) when enabled (got ${login.status})`);
const loc = login.headers.get('location');
ok(!!loc && /\/api\/auth\/oidc\/callback\?/.test(loc), `redirect targets callback (${loc})`);
const cbPath = loc ? loc.replace(BASE, '').replace(/^https?:\/\/[^/]+/, '') : '';
const cb = await call(cbPath, { headers: OIDC });
ok(cb.status === 200 && cb.body?.via === 'oidc', `oidc/callback issues session (via=${cb.body?.via})`);
const setCookie = cb.headers.get('set-cookie') || '';
ok(/xhub_session=/.test(setCookie), `callback sets xhub_session cookie`);
const cookie = (setCookie.match(/xhub_session=[^;]+/) || [''])[0];
const me = await call('/api/auth/me', { headers: { cookie } });
ok(me.status === 200 && me.body?.user?.id === 'user-nam' && me.body?.source === 'session', `session cookie authenticates /me as user-nam (source=${me.body?.source})`);

// 5. oidc disabled by default → 503.
const off = await call('/api/auth/oidc/login');
ok(off.status === 503, `oidc/login disabled by default → 503 (got ${off.status})`);

console.log(failed === 0 ? '\nAUTHZ SMOKE PASSED' : `\nAUTHZ SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
