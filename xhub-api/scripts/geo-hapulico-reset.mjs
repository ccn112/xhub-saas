// Wave A (Hapulico golden slice) — deletes all data produced by
// geo-hapulico-ingest.mjs + geo-hapulico-spatial-join.mjs, so the pipeline can
// be re-run cleanly from scratch (idempotent ON CONFLICT upserts make re-runs
// safe too, but a full reset is useful for testing/CI). Does NOT touch
// GlobalProject/GlobalProjectSource (from geo-hapulico-seed.mjs) or
// ExternalCategoryMapping (from geo-taxonomy-seed.mjs) — those are re-seeded
// independently and idempotently, not part of the ingestion pipeline this
// resets. Run: node scripts/geo-hapulico-reset.mjs
import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  // Children before parents (no ON DELETE CASCADE defined on these FKs).
  await client.query(`DELETE FROM "ProjectPlaceEdge"`);
  await client.query(`DELETE FROM "GeoDuplicatePair"`);
  await client.query(`DELETE FROM "ProviderContact"`);
  await client.query(`DELETE FROM "CatalogPriceObservation"`);
  await client.query(`DELETE FROM "CatalogItem"`);
  await client.query(`DELETE FROM "ProviderLocation"`);
  await client.query(`DELETE FROM "Provider"`);
  await client.query(`DELETE FROM "PlaceSource"`);
  await client.query(`DELETE FROM "Place"`);
  await client.query(`DELETE FROM "GeoSourceRecord"`);
  await client.query(`DELETE FROM "GeoImportJob"`);
  await client.query(`DELETE FROM "DataQualityIssue" WHERE "subjectType" = 'GeoSourceRecord'`);
  await client.query('COMMIT');
  console.log('GEO_HAPULICO_RESET_OK');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('GEO_HAPULICO_RESET_FAILED', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
