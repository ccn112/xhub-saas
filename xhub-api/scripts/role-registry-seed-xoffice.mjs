// X.Office-side role registry seeder (seed:roles-xoffice) — populates the SAME
// canonical role/permission catalog into X.Office's own local RoleBinding /
// PermissionPolicy tables (Phase 1.5 Stage C: X.Office owns its local business
// RBAC, no longer a shared-DB read from XHub Platform).
//
// This is the counterpart to role-registry-seed.mjs (which seeds the Platform
// DB). It is NOT a copy of that script blindly re-pointed at the other DB:
// the X.Office schema has no `Tenant` model (Tenant is Platform-canonical),
// so this script skips the Tenant upsert entirely and only writes
// PermissionPolicy + RoleBinding.
//
// Why this script needs to exist at all: prior to this, the ONLY way
// X.Office's DB got RoleBinding/PermissionPolicy data was the one-time
// `stage-c-migrate-rbac-data.mjs` copy from the old shared DB during the
// Stage C cutover. That script requires a pre-existing populated source DB —
// it cannot bootstrap a brand-new, empty database (e.g. a fresh CI run).
// This script closes that gap.
//
// Idempotent: PermissionPolicy upsert-by (tenantId, roleCode, version);
// RoleBinding upsert-by id. Re-running produces NO duplicates.
// Run: npm run seed:roles-xoffice  (needs XOFFICE_DATABASE_URL; server not required)
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const seed = JSON.parse(
  readFileSync(join(process.cwd(), 'seed-data', 'identity', 'role-registry.seed.json'), 'utf8'),
);
const tenantId = seed.tenant.id;
const version = seed.version ?? 1;

const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)"); // SET LOCAL — scoped to this tx

  let policies = 0;
  for (const r of seed.roles) {
    await c.query(
      `INSERT INTO "PermissionPolicy" (id, "tenantId", "roleCode", permissions, condition, version)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT ("tenantId","roleCode",version)
       DO UPDATE SET permissions=EXCLUDED.permissions, condition=EXCLUDED.condition`,
      [
        `pp-role-${r.roleCode}`,
        tenantId,
        r.roleCode,
        r.permissions ?? [],
        r.condition ? JSON.stringify(r.condition) : null,
        version,
      ],
    );
    policies++;
  }

  let bindings = 0;
  for (const b of seed.userBindings ?? []) {
    await c.query(
      `INSERT INTO "RoleBinding" (id, "tenantId", "subjectType", "subjectId", "roleCode", scope)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id)
       DO UPDATE SET "subjectType"=EXCLUDED."subjectType", "subjectId"=EXCLUDED."subjectId",
                     "roleCode"=EXCLUDED."roleCode", scope=EXCLUDED.scope`,
      [b.id, tenantId, b.subjectType, b.subjectId, b.roleCode, JSON.stringify(b.scope ?? {})],
    );
    bindings++;
  }

  await c.query('COMMIT');
  console.log(`role-registry seed (xoffice) OK | tenant=${tenantId} policies=${policies} userBindings=${bindings} version=${version}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('role-registry seed (xoffice) FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
