// Role registry smoke (test:roles). Two layers:
//   A. UNIT — permissionMatches() wildcard rules (imported from the built dist,
//      the SAME helper can()/effectivePermissions use).
//   B. HTTP — GET /api/identity/permissions/effective proves the canonical
//      PLATFORM_ADMIN grant ['*'] reaches the test admin (user-nam) and that a
//      low-priv user does NOT get admin perms.
//
// Requires: built dist (npm run build) + server up on :4000 + seed:roles run.
// Run: npm run test:roles
import 'dotenv/config';
import { permissionMatches } from '../dist/src/identity/permission-match.js';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); failed++; }
};

console.log('Role registry smoke @ ' + BASE);

// A. Unit — wildcard matching.
ok(permissionMatches(['tenant.*'], 'tenant.user.invite') === true, `tenant.* matches tenant.user.invite`);
ok(permissionMatches(['org.*'], 'tenant.user.invite') === false, `org.* does NOT match tenant.user.invite`);
ok(permissionMatches(['*'], 'anything') === true, `* matches anything`);
ok(permissionMatches(['identity.read'], 'identity.read') === true, `exact match works`);
ok(permissionMatches(['identity.read'], 'identity.manage') === false, `exact non-match rejected`);
ok(permissionMatches(['tenant.*'], 'tenant') === true, `tenant.* matches bare segment tenant`);
ok(permissionMatches(['tenant.*'], 'tenants.x') === false, `tenant.* respects the dot boundary`);

// B. HTTP — effective permissions.
const call = async (userId) => {
  const r = await fetch(`${BASE}/api/identity/permissions/effective?userId=${userId}`, {
    headers: { 'x-tenant-id': 'tenant-xtech', 'x-user-id': userId },
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

const admin = await call('user-nam');
ok(admin.status === 200, `GET effective for user-nam → 200 (got ${admin.status})`);
const adminPerms = admin.body?.permissions ?? [];
ok(admin.body?.roles?.includes('PLATFORM_ADMIN'), `user-nam holds PLATFORM_ADMIN role`);
ok(adminPerms.includes('*'), `user-nam effective permissions include the platform grant '*'`);
ok(permissionMatches(adminPerms, 'provisioning.manage'), `user-nam wildcard-grants provisioning.manage`);

const low = await call('user-huyvu');
ok(low.status === 200, `GET effective for user-huyvu → 200 (got ${low.status})`);
const lowPerms = low.body?.permissions ?? [];
ok(!lowPerms.includes('*'), `low-priv user-huyvu does NOT hold '*'`);
ok(!permissionMatches(lowPerms, 'provisioning.manage'), `low-priv user-huyvu is NOT granted admin perm provisioning.manage`);
ok(low.body?.roles?.includes('SERVICE_DESK_AGENT'), `low-priv holds SERVICE_DESK_AGENT role`);

console.log(failed === 0 ? '\nROLE REGISTRY SMOKE PASSED' : `\nROLE REGISTRY SMOKE FAILED (${failed})`);
// Let the event loop drain naturally (avoids a noisy libuv teardown assert on
// Node/Windows when force-exiting with sockets still closing).
process.exitCode = failed === 0 ? 0 : 1;
