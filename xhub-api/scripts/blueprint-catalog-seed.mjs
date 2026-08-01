// Blueprint & Seed Pack catalog seeder (seed:blueprint-catalog) — SaaS step 4 / E5.
//
// Seeds the SHARED / platform-plane Blueprint + SeedPack catalog from
// seed-data/platform/blueprint-catalog.seed.json (grounded on
// docs/saas/BLUEPRINT_SEED_PACK_PLAN.md). Idempotent + publish-immutable:
//   - Blueprint/SeedPack upsert-by (code, version).
//   - A row already PUBLISHED is NOT rewritten (immutable, non-negotiable #9);
//     only DRAFT rows are (re)written then published.
//   - SECRET GUARD (non-negotiable #10): a seed pack's datasets are scanned for
//     password/token/secret field names BEFORE publish; publish is rejected on a hit.
// Also APPLIES the SP-XTECH-OPS datasets to tenant-xtech (the position-history
// data moved OUT of identity.service.ts boot seed), idempotent by id.
//
// Runs under RLS bypass in one tx (server NOT required). Run: npm run seed:blueprint-catalog
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import pg from 'pg';

const SECRET_FIELD_REGEX = /password|secret|token|apikey|api[_-]?key|credential|privatekey|private[_-]?key/i;
function assertNoSecretFields(value, path = '') {
  if (Array.isArray(value)) return value.forEach((v, i) => assertNoSecretFields(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_FIELD_REGEX.test(k)) throw new Error(`MUST_NOT_LEAK: secret-like field "${path ? path + '.' : ''}${k}" is forbidden in a seed pack`);
      assertNoSecretFields(v, `${path ? path + '.' : ''}${k}`);
    }
  }
}
function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortDeep(v[k]);
    return out;
  }
  return v;
}
const checksumOf = (v) => createHash('sha256').update(JSON.stringify(sortDeep(v))).digest('hex');

const seed = JSON.parse(readFileSync(join(process.cwd(), 'seed-data', 'platform', 'blueprint-catalog.seed.json'), 'utf8'));
const publish = seed.publish !== false;

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  let bpNew = 0, bpKept = 0, spNew = 0, spKept = 0;

  for (const b of seed.blueprints ?? []) {
    const existing = (await c.query(`SELECT id, status FROM "Blueprint" WHERE code=$1 AND version=$2`, [b.code, b.version])).rows[0];
    if (existing?.status === 'PUBLISHED') { bpKept++; continue; } // immutable
    const checksum = checksumOf({
      code: b.code, version: b.version, industry: b.industry ?? null, inheritsCode: b.inheritsCode ?? null,
      appsEnabled: b.appsEnabled ?? [], roleSet: b.roleSet ?? [], orgTemplate: b.orgTemplate ?? {},
      workflowSet: b.workflowSet ?? [], menuEntitlement: b.menuEntitlement ?? {}, compatiblePlans: b.compatiblePlans ?? [],
    });
    const status = publish ? 'PUBLISHED' : 'DRAFT';
    const publishedAt = publish ? new Date() : null;
    await c.query(
      `INSERT INTO "Blueprint" (id, code, name, industry, version, status, "inheritsCode", "appsEnabled", "roleSet", "orgTemplate", "workflowSet", "menuEntitlement", "compatiblePlans", checksum, "publishedAt")
       VALUES (COALESCE($1, gen_random_uuid()::text),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (code, version) DO UPDATE SET name=EXCLUDED.name, industry=EXCLUDED.industry, status=EXCLUDED.status,
         "inheritsCode"=EXCLUDED."inheritsCode", "appsEnabled"=EXCLUDED."appsEnabled", "roleSet"=EXCLUDED."roleSet",
         "orgTemplate"=EXCLUDED."orgTemplate", "workflowSet"=EXCLUDED."workflowSet", "menuEntitlement"=EXCLUDED."menuEntitlement",
         "compatiblePlans"=EXCLUDED."compatiblePlans", checksum=EXCLUDED.checksum, "publishedAt"=EXCLUDED."publishedAt"`,
      [existing?.id ?? null, b.code, b.name, b.industry ?? null, b.version, status, b.inheritsCode ?? null,
       b.appsEnabled ?? [], JSON.stringify(b.roleSet ?? []), JSON.stringify(b.orgTemplate ?? {}),
       JSON.stringify(b.workflowSet ?? []), JSON.stringify(b.menuEntitlement ?? {}), b.compatiblePlans ?? [], checksum, publishedAt],
    );
    bpNew++;
  }

  for (const p of seed.seedPacks ?? []) {
    const existing = (await c.query(`SELECT id, status FROM "SeedPack" WHERE code=$1 AND version=$2`, [p.code, p.version])).rows[0];
    if (existing?.status === 'PUBLISHED') { spKept++; continue; } // immutable
    if (publish) assertNoSecretFields(p.datasets ?? []); // SECRET GUARD before publish
    const checksum = checksumOf({ code: p.code, version: p.version, blueprintCode: p.blueprintCode ?? null, dependencies: p.dependencies ?? [], datasets: p.datasets ?? [] });
    const status = publish ? 'PUBLISHED' : 'DRAFT';
    const publishedAt = publish ? new Date() : null;
    await c.query(
      `INSERT INTO "SeedPack" (id, code, name, version, status, "blueprintCode", dependencies, datasets, checksum, "publishedAt")
       VALUES (COALESCE($1, gen_random_uuid()::text),$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (code, version) DO UPDATE SET name=EXCLUDED.name, status=EXCLUDED.status, "blueprintCode"=EXCLUDED."blueprintCode",
         dependencies=EXCLUDED.dependencies, datasets=EXCLUDED.datasets, checksum=EXCLUDED.checksum, "publishedAt"=EXCLUDED."publishedAt"`,
      [existing?.id ?? null, p.code, p.name, p.version, status, p.blueprintCode ?? null, p.dependencies ?? [], JSON.stringify(p.datasets ?? []), checksum, publishedAt],
    );
    spNew++;
  }

  // Apply SP-XTECH-OPS datasets to tenant-xtech (position history moved out of
  // the boot seed) — idempotent upsert by id. Keeps identity/org smokes green.
  const xtechPack = (seed.seedPacks ?? []).find((p) => p.code === 'SP-XTECH-OPS');
  let opsRows = 0;
  for (const ds of xtechPack?.datasets ?? []) {
    if (ds.model !== 'positionAssignment') continue;
    for (const r of ds.rows ?? []) {
      await c.query(
        `INSERT INTO "PositionAssignment" (id, "tenantId", "positionId", "personId", kind, "effectiveFrom", "effectiveTo", reason, "createdBy")
         VALUES ($1,'tenant-xtech',$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET "positionId"=EXCLUDED."positionId", "personId"=EXCLUDED."personId", kind=EXCLUDED.kind,
           "effectiveFrom"=EXCLUDED."effectiveFrom", "effectiveTo"=EXCLUDED."effectiveTo", reason=EXCLUDED.reason`,
        [r.id, r.positionId, r.personId, r.kind, new Date(r.effectiveFrom), r.effectiveTo ? new Date(r.effectiveTo) : null, r.reason ?? null, r.createdBy ?? 'seed'],
      );
      opsRows++;
    }
  }

  await c.query('COMMIT');
  console.log(`blueprint-catalog seed OK | blueprints: ${bpNew} written, ${bpKept} kept-immutable | seedPacks: ${spNew} written, ${spKept} kept-immutable | SP-XTECH-OPS→tenant-xtech: ${opsRows} rows | publish=${publish}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('blueprint-catalog seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
