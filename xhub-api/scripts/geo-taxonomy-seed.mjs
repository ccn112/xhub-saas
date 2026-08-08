// Seeds ExternalCategoryMapping from the shared OSM_TAG_TO_XHUB_CATEGORY map
// in geo-taxonomy.mjs (single source of truth — geo-hapulico-ingest.mjs uses
// the same map object, not a re-derived copy, so this table always matches
// what ingestion actually assigns). Idempotent: upsert-by
// (source, externalCategoryId, mappingVersion). Run: npm run seed:geo-taxonomy
import 'dotenv/config';
import pg from 'pg';
import { OSM_TAG_TO_XHUB_CATEGORY } from './geo-taxonomy.mjs';

const MAPPING_VERSION = 1;

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  let count = 0;
  for (const [externalCategoryId, xhubCategoryId] of Object.entries(OSM_TAG_TO_XHUB_CATEGORY)) {
    await c.query(
      `INSERT INTO "ExternalCategoryMapping"
         (id, source, "externalCategoryId", "externalCategoryName", "xhubCategoryId", confidence, "mappingVersion")
       VALUES (gen_random_uuid()::text, 'osm', $1, $1, $2, 1.0, $3)
       ON CONFLICT (source, "externalCategoryId", "mappingVersion") DO UPDATE SET
         "xhubCategoryId"=EXCLUDED."xhubCategoryId"`,
      [externalCategoryId, xhubCategoryId, MAPPING_VERSION],
    );
    count++;
  }
  await c.query('COMMIT');
  console.log(`GEO_TAXONOMY_SEED_OK | mappings=${count} source=osm version=${MAPPING_VERSION}`);
} catch (err) {
  await c.query('ROLLBACK');
  console.error('GEO_TAXONOMY_SEED_FAILED', err);
  process.exitCode = 1;
} finally {
  await c.end();
}
