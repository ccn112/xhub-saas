// Role registry seeder (seed:roles) — seeds the 16 canonical XHub roles as
// PermissionPolicy rows (version 1) under tenant-xtech, plus the USER
// RoleBindings that keep the test admin (user-nam -> usr-cfo) and CEO on the
// canonical PLATFORM_ADMIN grant ['*'].
//
// Source of truth: seed-data/identity/role-registry.seed.json (mirrors the
// handoff data/ROLE_CATALOG.csv). ADDITIVE: coexists with the legacy ROLE_*
// policies seeded by IdentityService — nothing is deleted.
//
// Idempotent: PermissionPolicy upsert-by (tenantId, roleCode, version);
// RoleBinding upsert-by id. Re-running produces NO duplicates. Mirrors the
// existing seed pattern by running under RLS bypass (app.bypass_rls='on') in a
// single transaction. Run: npm run seed:roles  (needs DATABASE_URL; server not
// required — talks straight to Postgres like the *-reset scripts).
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const seed = JSON.parse(
  readFileSync(join(process.cwd(), 'seed-data', 'identity', 'role-registry.seed.json'), 'utf8'),
);
const tenantId = seed.tenant.id;
const version = seed.version ?? 1;

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)"); // SET LOCAL — scoped to this tx

  // Ensure the tenant row exists (not tenant-scoped).
  await c.query(
    `INSERT INTO "Tenant" (id, slug, name) VALUES ($1,$2,$3)
     ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug, name=EXCLUDED.name`,
    [tenantId, seed.tenant.slug, seed.tenant.name],
  );

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
  console.log(`role-registry seed OK | tenant=${tenantId} policies=${policies} userBindings=${bindings} version=${version}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('role-registry seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
