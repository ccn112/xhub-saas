// Internal auth-flow smoke (PH-00b). Re-runnable — resets its own state first.
// Server must be up on :4000. Run: npm run test:auth-flow
//
// Proves the full internal auth lifecycle for usr-hr-01 (tenant-xtech):
//   invite (admin) → activate with a password → login 200 → suspend →
//   next /me with that session → 401 (revoke) → reset password → login 200.
// Plus guards: non-admin invite under x-authz-enforce → 403; wrong password
// → 401; credential-less account → 409 "chưa kích hoạt"; and a MUST_NOT_LEAK
// assertion that ONLY hashes are stored (no plaintext password/token in DB).
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const TENANT = 'tenant-xtech';
const SUBJECT = 'usr-hr-01';
const NEVER = 'usr-admin-01'; // seeded, membership active, never activated → 409
const ADMIN = 'usr-tenant-admin'; // holds tenant.* (invite/suspend)
const NONADMIN = 'usr-sales-01'; // EMPLOYEE → lacks tenant.user.invite

const PW1 = 'Hr01-Str0ng!2026';
const PW2 = 'Hr01-Reactivated!2026';
const PW3 = 'Hr01-Reset!2026';

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };

const admH = { 'content-type': 'application/json', 'x-tenant-id': TENANT, 'x-user-id': ADMIN };
const pubH = { 'content-type': 'application/json' };

/** fetch helper returning { status, body, cookie } (captures xhub_session). */
const call = async (path, opts = {}, headers = pubH) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  const setCookie = r.headers.get('set-cookie') || '';
  const m = /xhub_session=([^;]+)/.exec(setCookie);
  return { status: r.status, body, cookie: m ? m[1] : null, setCookie };
};

// ---- 0. RESET state (idempotent) ------------------------------------------
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query('BEGIN');
await db.query("SELECT set_config('app.bypass_rls','on',true)");
await db.query('DELETE FROM "AuthToken" WHERE "personId" = ANY($1)', [[SUBJECT, NEVER]]);
await db.query('DELETE FROM "UserCredential" WHERE "userId" = ANY($1)', [[SUBJECT, NEVER]]);
await db.query('UPDATE "Membership" SET status=\'active\' WHERE "tenantId"=$1 AND "userId"=ANY($2)', [TENANT, [SUBJECT, NEVER]]);
await db.query('COMMIT');

console.log('Auth-flow smoke @ ' + BASE);

// ---- 1. Non-admin invite under enforcement → 403 --------------------------
const denied = await call('/api/auth/invite', {
  method: 'POST', body: JSON.stringify({ userId: SUBJECT }),
}, { 'content-type': 'application/json', 'x-tenant-id': TENANT, 'x-user-id': NONADMIN, 'x-authz-enforce': 'true' });
ok(denied.status === 403, `non-admin invite under x-authz-enforce → 403 (got ${denied.status})`);

// ---- 2. Admin invite (idempotent) → activation token ----------------------
const inv = await call('/api/auth/invite', { method: 'POST', body: JSON.stringify({ userId: SUBJECT }) }, admH);
ok(inv.status === 200 || inv.status === 201, `admin invite → 2xx (got ${inv.status})`);
ok(typeof inv.body?.token === 'string' && inv.body.token.length > 20, 'invite returns a surfaced token');
ok(typeof inv.body?.activationUrl === 'string' && inv.body.activationUrl.includes('/activate?token='), 'invite returns an activationUrl');
const inviteToken = inv.body?.token;

// pending-invites lists the outstanding invite.
const pend = await call('/api/auth/pending-invites', {}, admH);
ok(Array.isArray(pend.body) && pend.body.some((p) => p.personId === SUBJECT), 'pending-invites lists usr-hr-01');
ok(!JSON.stringify(pend.body).includes(inviteToken), 'pending-invites does NOT expose the raw token');

// idempotent re-invite supersedes (still exactly one pending for subject).
const inv2 = await call('/api/auth/invite', { method: 'POST', body: JSON.stringify({ userId: SUBJECT }) }, admH);
const pend2 = await call('/api/auth/pending-invites', {}, admH);
ok(pend2.body.filter((p) => p.personId === SUBJECT).length === 1, 're-invite is idempotent (one pending for subject)');
const activeToken = inv2.body?.token;

// ---- 3. Activate with a password → session cookie -------------------------
const act = await call('/api/auth/activate', { method: 'POST', body: JSON.stringify({ token: activeToken, password: PW1 }) });
ok(act.status === 200 || act.status === 201, `activate → 2xx (got ${act.status})`);
ok(!!act.cookie, 'activate issues an xhub_session cookie');
const sessionA = act.cookie;

// superseded (first) invite token is now invalid.
const actOld = await call('/api/auth/activate', { method: 'POST', body: JSON.stringify({ token: inviteToken, password: PW1 }) });
ok(actOld.status === 400, `superseded invite token rejected → 400 (got ${actOld.status})`);

// ---- 4. Login with the password ------------------------------------------
const login1 = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ userId: SUBJECT, password: PW1 }) });
ok(login1.status === 200 || login1.status === 201, `login with password → 2xx (got ${login1.status})`);
const wrong = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ userId: SUBJECT, password: 'wrong-pw' }) });
ok(wrong.status === 401, `wrong password → 401 (got ${wrong.status})`);
const notActivated = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ userId: NEVER, password: 'x' }) });
ok(notActivated.status === 409, `credential-less account login → 409 chưa kích hoạt (got ${notActivated.status})`);

// ---- 5. /me with the activation session → 200 -----------------------------
const meActive = await call('/api/auth/me', {}, { cookie: `xhub_session=${sessionA}` });
ok(meActive.status === 200, `/me with active session → 200 (got ${meActive.status})`);

// ---- 6. Suspend → next /me with that session → 401 (revoke) ---------------
const susp = await call('/api/auth/suspend', { method: 'POST', body: JSON.stringify({ userId: SUBJECT }) }, admH);
ok((susp.status === 200 || susp.status === 201) && susp.body?.status === 'suspended', 'admin suspend → membership suspended');
const meRevoked = await call('/api/auth/me', {}, { cookie: `xhub_session=${sessionA}` });
ok(meRevoked.status === 401, `/me after suspend → 401 REVOKE (got ${meRevoked.status})`);
ok(/xhub_session=;|xhub_session=;/.test(meRevoked.setCookie) || meRevoked.setCookie.includes('xhub_session=;') || meRevoked.setCookie.toLowerCase().includes('expires'), 'revoke clears the session cookie');
const loginSusp = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ userId: SUBJECT, password: PW1 }) });
ok(loginSusp.status === 401, `suspended user cannot log in → 401 (got ${loginSusp.status})`);

// ---- 7. Admin re-activates (lifts suspension) via a fresh invite ----------
const inv3 = await call('/api/auth/invite', { method: 'POST', body: JSON.stringify({ userId: SUBJECT }) }, admH);
const react = await call('/api/auth/activate', { method: 'POST', body: JSON.stringify({ token: inv3.body?.token, password: PW2 }) });
ok(react.status === 200 || react.status === 201, `re-activate restores membership → 2xx (got ${react.status})`);

// ---- 8. Reset password → login again 200 ----------------------------------
const forgot = await call('/api/auth/forgot', { method: 'POST', body: JSON.stringify({ userId: SUBJECT }) });
ok(typeof forgot.body?.token === 'string', 'forgot returns a surfaced reset token');
const resetToken = forgot.body?.token;
const reset = await call('/api/auth/reset', { method: 'POST', body: JSON.stringify({ token: resetToken, password: PW3 }) });
ok((reset.status === 200 || reset.status === 201) && reset.body?.ok === true, 'reset consumes the token → ok');
const login3 = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ userId: SUBJECT, password: PW3 }) });
ok(login3.status === 200 || login3.status === 201, `login with reset password → 2xx (got ${login3.status})`);
const oldPw = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ userId: SUBJECT, password: PW2 }) });
ok(oldPw.status === 401, `old password invalidated after reset → 401 (got ${oldPw.status})`);
const reuse = await call('/api/auth/reset', { method: 'POST', body: JSON.stringify({ token: resetToken, password: PW3 }) });
ok(reuse.status === 400, `reset token is single-use → 400 on reuse (got ${reuse.status})`);

// ---- 9. MUST_NOT_LEAK: only HASHES are stored (no plaintext) ---------------
// Session-level bypass (the earlier SET LOCAL expired at COMMIT) so these
// verification reads are not filtered to zero rows by RLS.
await db.query("SELECT set_config('app.bypass_rls','on',false)");
const credRow = (await db.query('SELECT "passwordHash" FROM "UserCredential" WHERE "userId"=$1', [SUBJECT])).rows[0];
ok(!!credRow, 'UserCredential row exists for usr-hr-01');
ok(credRow?.passwordHash?.startsWith('$argon2'), 'password stored as an argon2 hash');
ok(![PW1, PW2, PW3].some((p) => credRow?.passwordHash?.includes(p)), 'no plaintext password in UserCredential');
const tokRows = (await db.query('SELECT "tokenHash" FROM "AuthToken" WHERE "personId"=$1', [SUBJECT])).rows;
ok(tokRows.length > 0 && tokRows.every((t) => /^[0-9a-f]{64}$/.test(t.tokenHash)), 'all AuthToken rows store a sha256 hash only');
ok(!tokRows.some((t) => [inviteToken, activeToken, resetToken].includes(t.tokenHash)), 'no raw token value stored in AuthToken');

await db.end();
console.log(failed === 0 ? '\nAUTH-FLOW SMOKE PASSED' : `\nAUTH-FLOW SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
