// Platform role namespace seeder (seed:platform-roles) — SAAS-004 step 2.
//
// Seeds the PLATFORM-operator roles (10, all `PLT_`-prefixed) as PermissionPolicy
// rows under the SYSTEM tenant `tenant-platform`, granting ONLY `platform.*`
// codes. This is a SEPARATE namespace from the 16 tenant roles: the `PLT_`
// prefix guarantees no collision with the tenant super-admin `PLATFORM_ADMIN`
// (['*'], held by usr-cfo/usr-ceo for tests) — that policy is NEVER touched here.
//
// Also upserts the dedicated clean operator person `usr-plt-ops` (only a PLT_
// role, no tenant role) and binds X-TECH's platform operators (usr-platform-admin,
// usr-tenant-admin) to appropriate PLT_ roles.
//
// The system tenant carries tenantNo=NULL so it is EXCLUDED from the commercial
// registry list (GET /api/platform/tenants filters tenantNo NOT NULL).
//
// Idempotent: PermissionPolicy upsert-by (tenantId, roleCode, version);
// PersonProfile + RoleBinding upsert-by id. Re-running produces NO duplicates.
// Runs under RLS bypass in one tx (mirrors scripts/role-registry-seed.mjs).
// Run: npm run seed:platform-roles  (needs DATABASE_URL; server not required)
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const seed = JSON.parse(
  readFileSync(join(process.cwd(), 'seed-data', 'platform', 'platform-roles.seed.json'), 'utf8'),
);
const sys = seed.systemTenant;
const version = seed.version ?? 1;

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)"); // SET LOCAL — scoped to this tx

  // System platform tenant — tenantNo stays NULL so it never shows in the
  // commercial registry list. Shared (non-RLS) Tenant table.
  await c.query(
    `INSERT INTO "Tenant" (id, slug, name) VALUES ($1,$2,$3)
     ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug, name=EXCLUDED.name`,
    [sys.id, sys.slug, sys.name],
  );

  let policies = 0;
  for (const r of seed.roles) {
    await c.query(
      `INSERT INTO "PermissionPolicy" (id, "tenantId", "roleCode", permissions, condition, version)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT ("tenantId","roleCode",version)
       DO UPDATE SET permissions=EXCLUDED.permissions, condition=EXCLUDED.condition`,
      [`pp-plt-${r.roleCode}`, sys.id, r.roleCode, r.permissions ?? [], null, version],
    );
    policies++;
  }

  // The operator PERSON lives in the shared identity directory (tenant-xtech),
  // like usr-platform-admin/usr-tenant-admin — only the ROLE POLICIES sit on the
  // platform plane (tenant-platform). This keeps the person visible to the normal
  // tenant-scoped identity reads (e.g. GET /me/nav-permissions) while the PLT_
  // namespace stays separate. Permission resolution is by roleCode globally, so
  // the person's home tenant does not affect which platform perms it gets.
  const PERSON_TENANT = 'tenant-xtech';
  let persons = 0;
  for (const p of seed.persons ?? []) {
    await c.query(
      `INSERT INTO "PersonProfile" (id, "tenantId", "fullName", email, status, "externalIdRefs", "updatedAt")
       VALUES ($1,$2,$3,$4,'active',NULL,now())
       ON CONFLICT (id) DO UPDATE SET "fullName"=EXCLUDED."fullName", email=EXCLUDED.email, "updatedAt"=now()`,
      [p.id, PERSON_TENANT, p.fullName, p.email ?? null],
    );
    persons++;
  }

  let bindings = 0;
  for (const b of seed.userBindings ?? []) {
    await c.query(
      `INSERT INTO "RoleBinding" (id, "tenantId", "subjectType", "subjectId", "roleCode", scope)
       VALUES ($1,$2,'USER',$3,$4,$5)
       ON CONFLICT (id)
       DO UPDATE SET "subjectType"=EXCLUDED."subjectType", "subjectId"=EXCLUDED."subjectId",
                     "roleCode"=EXCLUDED."roleCode", scope=EXCLUDED.scope`,
      [b.id, sys.id, b.subjectId, b.roleCode, JSON.stringify(b.scope ?? {})],
    );
    bindings++;
  }

  await c.query('COMMIT');
  console.log(
    `platform-roles seed OK | systemTenant=${sys.id} policies=${policies} persons=${persons} userBindings=${bindings} version=${version}`,
  );
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('platform-roles seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
