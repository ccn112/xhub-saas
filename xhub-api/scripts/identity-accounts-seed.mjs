// Identity accounts seeder (seed:accounts) — PH-00a / SEED-IDENTITY-01.
//
// Seeds the X-TECH pilot accounts (23 tenant-xtech PersonProfiles + their
// Memberships, Positions and USER RoleBindings) plus the org units they need
// that the existing 7-person seed did not have (PLATFORM/SOLUTION/DELIVERY/
// SUPPORT). Source of truth: seed-data/identity/xtech-accounts.seed.json
// (mirrors handoff data/SEED_ACCOUNTS.csv + seed/accounts.seed.json).
//
// ADDITIVE + IDEMPOTENT. Mirrors scripts/role-registry-seed.mjs:
//   - pg direct (no server required), one transaction, RLS bypass via
//     SET LOCAL app.bypass_rls='on'.
//   - upsert-by-id everywhere → re-running produces NO duplicates + same counts.
//
// RECONCILIATION GUARDS (do not break the existing 7 / the org-chart heads):
//   - The 6 existing head accounts (usr-ceo/cfo/sales-head/tech-head/hr-head/
//     admin-head) reuse their EXACT PersonProfile ids AND head Position ids
//     (pos-ceo … pos-admin-head) → upsert, never duplicate.
//   - PersonProfile.externalIdRefs is PRESERVED (never overwritten) so the legacy
//     userId links (user-tuan → usr-ceo, user-nam → usr-cfo …) keep working and
//     test:roles / test:authz stay green.
//   - usr-it-support (existing 7th person) is NOT in this account set → untouched.
//   - user-nam's admin bindings (rb-platform-admin-canonical-cfo + legacy
//     rb-platform-admin-cfo) are owned by other seeds and NOT touched here; we
//     only ADD usr-cfo's real CFO/EXECUTIVE bindings on top.
//
// NO plaintext password (accounts activate via invite/reset). usr-demo-isolation
// (MUST_NOT_LEAK) is intentionally absent from this file → never seeded under
// tenant-xtech.
//
// Run: npm run seed:accounts   (needs DATABASE_URL)
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const seed = JSON.parse(
  readFileSync(join(process.cwd(), 'seed-data', 'identity', 'xtech-accounts.seed.json'), 'utf8'),
);
const tenantId = seed.tenant.id;

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)"); // SET LOCAL — scoped to this tx

  // Tenant row (not tenant-scoped) — ensure it exists.
  await c.query(
    `INSERT INTO "Tenant" (id, slug, name) VALUES ($1,$2,$3)
     ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug, name=EXCLUDED.name`,
    [tenantId, seed.tenant.slug, seed.tenant.name],
  );

  // 1. Org units (only the NEW ones referenced by these accounts). Upsert-by-id;
  //    existing EXEC/FIN/SALES/TECH/HR/ADMIN/IMPL are owned by the boot seed and
  //    left untouched.
  let orgUnits = 0;
  for (const o of seed.orgUnits ?? []) {
    await c.query(
      `INSERT INTO "OrgUnit" (id, "tenantId", code, name, type, "parentId")
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET "tenantId"=EXCLUDED."tenantId", code=EXCLUDED.code,
                     name=EXCLUDED.name, type=EXCLUDED.type, "parentId"=EXCLUDED."parentId"`,
      [o.id, tenantId, o.code, o.name, o.type, o.parentId ?? null],
    );
    orgUnits++;
  }

  // 2. PersonProfile — upsert-by-id. externalIdRefs is set only on INSERT (NULL);
  //    on UPDATE it is deliberately NOT in the SET list so existing links survive.
  let people = 0;
  for (const p of seed.people) {
    await c.query(
      `INSERT INTO "PersonProfile" (id, "tenantId", "fullName", email, status, "externalIdRefs", "updatedAt")
       VALUES ($1,$2,$3,$4,'active',NULL,now())
       ON CONFLICT (id) DO UPDATE SET "tenantId"=EXCLUDED."tenantId",
                     "fullName"=EXCLUDED."fullName", email=EXCLUDED.email, "updatedAt"=now()`,
      [p.id, tenantId, p.fullName, p.email ?? null],
    );
    people++;
  }

  // 3. Membership — one per account (keyed by tenantId+userId). userId is the
  //    account id. status: suspended for DISABLED_BY_DEFAULT (platform admin),
  //    active otherwise. roles mirror primary+extra. No secret stored.
  let memberships = 0;
  for (const p of seed.people) {
    await c.query(
      `INSERT INTO "Membership" (id, "tenantId", "userId", roles, status)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT ("tenantId","userId") DO UPDATE SET roles=EXCLUDED.roles, status=EXCLUDED.status`,
      [`mbr-${p.id}`, tenantId, p.id, p.roles ?? [], p.membershipStatus ?? 'active'],
    );
    memberships++;
  }

  // 4. Positions — upsert-by-id. Existing head positions (pos-ceo …) reuse ids
  //    so heads stay singular per unit.
  let positions = 0;
  for (const pos of seed.positions ?? []) {
    await c.query(
      `INSERT INTO "Position" (id, "tenantId", code, title, "orgUnitId", "holderPersonId", "reportsToPositionId", "isHead")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET "tenantId"=EXCLUDED."tenantId", code=EXCLUDED.code,
                     title=EXCLUDED.title, "orgUnitId"=EXCLUDED."orgUnitId",
                     "holderPersonId"=EXCLUDED."holderPersonId",
                     "reportsToPositionId"=EXCLUDED."reportsToPositionId", "isHead"=EXCLUDED."isHead"`,
      [pos.id, tenantId, pos.code, pos.title, pos.orgUnitId, pos.holderPersonId ?? null, pos.reportsToPositionId ?? null, !!pos.isHead],
    );
    positions++;
  }

  // 5. RoleBindings (USER) — primary + each extra role → rb-{userId}-{roleCode}.
  //    scope {} (tenant) unless the role is DEPARTMENT_HEAD → { orgUnitId } of
  //    the person's own unit. Upsert-by-id.
  let roleBindings = 0;
  for (const p of seed.people) {
    for (const roleCode of p.roles ?? []) {
      const scope = roleCode === 'DEPARTMENT_HEAD' ? { orgUnitId: p.orgUnitId } : {};
      await c.query(
        `INSERT INTO "RoleBinding" (id, "tenantId", "subjectType", "subjectId", "roleCode", scope)
         VALUES ($1,$2,'USER',$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET "subjectType"=EXCLUDED."subjectType",
                       "subjectId"=EXCLUDED."subjectId", "roleCode"=EXCLUDED."roleCode",
                       scope=EXCLUDED.scope`,
        [`rb-${p.id}-${roleCode}`, tenantId, p.id, roleCode, JSON.stringify(scope)],
      );
      roleBindings++;
    }
  }

  await c.query('COMMIT');
  console.log(
    `identity-accounts seed OK | tenant=${tenantId} orgUnits(new)=${orgUnits} people=${people} memberships=${memberships} positions=${positions} roleBindings=${roleBindings}`,
  );
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('identity-accounts seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
