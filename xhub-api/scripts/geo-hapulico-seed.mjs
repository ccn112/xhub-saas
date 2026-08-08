// Wave A (Hapulico golden slice) — seeds ONE GlobalProject row + its source
// lineage, from seed-data/geo/hapulico-source-project.json (a read-only,
// verbatim extract of X2's public_projects catalog export, code BDS-PJ158 —
// see that file's `_comment` and docs/geo-migration/X2_PROJECT_CATALOG_AUDIT.md).
// Read from the JSON file directly, never via X2's live API.
// Idempotent: upsert-by `code`. Run: npm run seed:geo-hapulico
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { normalizeVi, slugify } from './geo-text.mjs';

const source = JSON.parse(
  readFileSync(join(process.cwd(), 'seed-data', 'geo', 'hapulico-source-project.json'), 'utf8'),
);
const raw = source.raw;

// X2 `status` -> our real-estate lifecycle vocabulary (doc §3.1). X2 only had
// one value observed ("handover"); mapping is intentionally small/explicit —
// extend when Wave C sees more values, don't guess-map silently.
const PROJECT_STATUS_MAP = {
  handover: 'handover',
  selling: 'selling',
  planning: 'planning',
  operating: 'operating',
  archived: 'archived',
};

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');

  const name = raw.name;
  const slug = slugify(name);
  const projectStatus = PROJECT_STATUS_MAP[raw.status] ?? null;
  const lat = Number(raw.latitude);
  const lng = Number(raw.longitude);

  const { rows } = await c.query(
    `INSERT INTO "GlobalProject"
       (id, code, slug, name, "normalizedName", "projectType", status, "projectStatus",
        description, "addressText", "provinceCode", "districtCode", "wardCode",
        latitude, longitude, "developerName", website, "isPublic", "updatedAt")
     VALUES (gen_random_uuid()::text, $1,$2,$3,$4,$5,'ACTIVE',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true, now())
     ON CONFLICT (code) DO UPDATE SET
       slug=EXCLUDED.slug, name=EXCLUDED.name, "normalizedName"=EXCLUDED."normalizedName",
       "projectType"=EXCLUDED."projectType", "projectStatus"=EXCLUDED."projectStatus",
       description=EXCLUDED.description, "addressText"=EXCLUDED."addressText",
       "provinceCode"=EXCLUDED."provinceCode", "districtCode"=EXCLUDED."districtCode",
       "wardCode"=EXCLUDED."wardCode", latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
       "developerName"=EXCLUDED."developerName", "updatedAt"=now()
     RETURNING id`,
    [
      raw.code,
      slug,
      name,
      normalizeVi(name),
      raw.project_type ?? null,
      projectStatus,
      raw.description ?? null,
      raw.address ?? null,
      raw.province ?? null,
      raw.district ?? null,
      raw.ward ?? null,
      Number.isFinite(lat) ? lat : null,
      Number.isFinite(lng) ? lng : null,
      raw.developer_name ?? null,
      raw.developer?.website ?? null,
    ],
  );
  const globalProjectId = rows[0].id;

  // geom is Prisma `Unsupported(geography)` — set via raw SQL, only when we
  // have a real coordinate pair.
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    await c.query(
      `UPDATE "GlobalProject" SET geom = ST_SetSRID(ST_MakePoint($1,$2),4326)::geography WHERE id=$3`,
      [lng, lat, globalProjectId],
    );
  }

  // Lineage: one GlobalProjectSource row per (globalProjectId, sourceType,
  // sourceRecordId), marking any prior row for this pair as not-current first
  // (keeps history without ON CONFLICT needing every column).
  await c.query(
    `UPDATE "GlobalProjectSource" SET "isCurrent"=false
       WHERE "globalProjectId"=$1 AND "sourceType"=$2 AND "sourceRecordId"=$3 AND "isCurrent"=true`,
    [globalProjectId, source.sourceType, source.sourceRecordId],
  );
  await c.query(
    `INSERT INTO "GlobalProjectSource"
       (id, "globalProjectId", "sourceType", "sourceSystem", "sourceRecordId", "sourceUrl",
        "sourcePayload", "observedAt", "isCurrent")
     VALUES (gen_random_uuid()::text, $1,$2,$3,$4,$5,$6, now(), true)`,
    [
      globalProjectId,
      source.sourceType,
      source.sourceSystem,
      source.sourceRecordId,
      source.sourceUrl,
      JSON.stringify(raw),
    ],
  );

  await c.query('COMMIT');
  console.log(`GEO_HAPULICO_SEED_OK | globalProjectId=${globalProjectId} slug=${slug} lat=${lat} lng=${lng}`);
} catch (err) {
  await c.query('ROLLBACK');
  console.error('GEO_HAPULICO_SEED_FAILED', err);
  process.exitCode = 1;
} finally {
  await c.end();
}
