// XHub Enterprise IOC — SHARED twin-template catalog seeder (seed:ioc-templates).
//
// Publishes the 4 reusable twin templates from scripts/ioc-template-specs.mjs as
// `IocTemplate` rows. Platform-plane like `Blueprint`/`SeedPack`: the table has
// NO tenantId and is deliberately NOT registered in scripts/rls-setup.mjs — it
// carries only neutral specs (no tenant data, no OrgUnit id, no metric id), so
// there is nothing for RLS to protect and every tenant may read the gallery.
//
// Versioning follows the Blueprint convention:
//   • a (code, version) pair that is already PUBLISHED is IMMUTABLE;
//   • if the spec's checksum changed, a NEW version row is appended and the old
//     one is RETIRED — an edit never rewrites a published template.
//
// It also seeds the FULL BUILT_IN icon catalog into every tenant that already
// has a twin surface, so the editor can offer factory/retail/hotel icons.
//
// Runs straight against Postgres under RLS bypass (server NOT required).
// Run: npm run seed:ioc-templates
import 'dotenv/config';
import pg from 'pg';
import { createHash } from 'node:crypto';
import { IOC_TEMPLATES, ALL_ICONS, zonePolygons } from './ioc-template-specs.mjs';

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

/** The stored floorPlanSpec keeps REAL polygons (the shape a plan row stores). */
function floorPlanSpecOf(tpl) {
  return {
    name: tpl.floorPlanSpec.name,
    unit: tpl.floorPlanSpec.unit,
    metersPerUnit: tpl.floorPlanSpec.metersPerUnit,
    originX: tpl.floorPlanSpec.originX,
    originY: tpl.floorPlanSpec.originY,
    walls: tpl.floorPlanSpec.walls,
    zones: zonePolygons(tpl),
  };
}

const ICON_TENANT_SQL = `
  SELECT DISTINCT "tenantId" FROM (
    SELECT "tenantId" FROM "TwinSite"
    UNION SELECT "tenantId" FROM "IconAsset"
  ) t`;

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  let written = 0, kept = 0, bumped = 0;
  const report = [];

  for (const tpl of IOC_TEMPLATES) {
    const floorPlanSpec = floorPlanSpecOf(tpl);
    const payload = {
      code: tpl.code,
      name: tpl.name,
      industry: tpl.industry ?? null,
      twinType: tpl.twinType,
      description: tpl.description ?? null,
      floorPlanSpec,
      sceneSpec: tpl.sceneSpec,
      dataLayerSpecs: tpl.dataLayerSpecs,
      dashboardSpec: tpl.dashboardSpec,
      iconSetCodes: tpl.iconSetCodes,
    };
    const checksum = checksumOf(payload);

    const latest = (
      await c.query(`SELECT id, version, status, checksum FROM "IocTemplate" WHERE code=$1 ORDER BY version DESC LIMIT 1`, [tpl.code])
    ).rows[0];

    let version = 1;
    if (latest) {
      if (latest.checksum === checksum && latest.status === 'PUBLISHED') {
        kept++;
        report.push([tpl.code, latest.version, 'kept (unchanged, immutable)', floorPlanSpec.zones.length, tpl.dataLayerSpecs.length]);
        continue;
      }
      if (latest.status === 'PUBLISHED') {
        // spec changed → append a NEW version, retire the old one (never rewrite)
        version = latest.version + 1;
        await c.query(`UPDATE "IocTemplate" SET status='RETIRED', "updatedAt"=now() WHERE id=$1`, [latest.id]);
        bumped++;
      } else {
        version = latest.version; // still DRAFT → may be rewritten in place
      }
    }

    await c.query(
      `INSERT INTO "IocTemplate"
         (id, code, name, industry, "twinType", description, version, status,
          "floorPlanSpec","sceneSpec","dataLayerSpecs","dashboardSpec","iconSetCodes",
          checksum,"publishedAt","createdAt","updatedAt")
       VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,'PUBLISHED',$7,$8,$9,$10,$11,$12,now(),now(),now())
       ON CONFLICT (code, version) DO UPDATE SET
         name=EXCLUDED.name, industry=EXCLUDED.industry, "twinType"=EXCLUDED."twinType",
         description=EXCLUDED.description, status='PUBLISHED',
         "floorPlanSpec"=EXCLUDED."floorPlanSpec", "sceneSpec"=EXCLUDED."sceneSpec",
         "dataLayerSpecs"=EXCLUDED."dataLayerSpecs", "dashboardSpec"=EXCLUDED."dashboardSpec",
         "iconSetCodes"=EXCLUDED."iconSetCodes", checksum=EXCLUDED.checksum,
         "publishedAt"=now(), "updatedAt"=now()`,
      [
        tpl.code, tpl.name, tpl.industry ?? null, tpl.twinType, tpl.description ?? null, version,
        JSON.stringify(floorPlanSpec), JSON.stringify(tpl.sceneSpec),
        JSON.stringify(tpl.dataLayerSpecs), JSON.stringify(tpl.dashboardSpec), tpl.iconSetCodes, checksum,
      ],
    );
    written++;
    report.push([tpl.code, version, 'published', floorPlanSpec.zones.length, tpl.dataLayerSpecs.length]);
  }

  // Full BUILT_IN icon catalog for every tenant that already has a twin surface.
  const tenants = (await c.query(ICON_TENANT_SQL)).rows.map((r) => r.tenantId);
  let iconRows = 0;
  for (const tenantId of tenants) {
    for (const [key, label] of ALL_ICONS) {
      await c.query(
        `INSERT INTO "IconAsset" (id,"tenantId",key,label,type,status,"createdAt")
         VALUES ($1,$2,$3,$4,'BUILT_IN','ACTIVE',now())
         ON CONFLICT ("tenantId",key) DO UPDATE SET label=EXCLUDED.label, type='BUILT_IN', status='ACTIVE'`,
        // deterministic per (tenant,key); an EXISTING row keeps its own id
        // because the conflict target is ("tenantId", key).
        [`ioc-icon-${createHash('sha1').update(`${tenantId}:${key}`).digest('hex').slice(0, 24)}`, tenantId, key, label],
      );
      iconRows++;
    }
  }

  await c.query('COMMIT');
  console.log('IOC TEMPLATE CATALOG SEED OK');
  for (const [code, version, state, zones, layers] of report) {
    console.log(`  ${code} v${version} — ${state} · ${zones} vùng · ${layers} lớp dữ liệu`);
  }
  console.log(`  templates: ${written} written, ${kept} kept-immutable, ${bumped} version-bumped`);
  console.log(`  icons: ${ALL_ICONS.length} BUILT_IN keys × ${tenants.length} tenant(s) = ${iconRows} upserts`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('IOC TEMPLATE CATALOG SEED FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
