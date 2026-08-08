// DATA-04 (Wave A) — deletes all data produced by data04-baseline-seed.mjs,
// so the pipeline can be re-run cleanly from scratch. Does NOT touch
// Organization/EquipmentProduct (owned by DATA-01/02/03) — only the edge/
// candidate tables this dataset owns. Run: node scripts/data04-reset.mjs
import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(`DELETE FROM "ProjectSupplyGap"`);
  await client.query(`DELETE FROM "ProjectHierarchyRelation"`);
  await client.query(`DELETE FROM "ProjectGraphEdge"`);
  await client.query(`DELETE FROM "ProjectCandidate"`);
  await client.query('COMMIT');
  console.log('DATA04_RESET_OK');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('DATA04_RESET_FAILED', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
