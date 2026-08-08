// DATA-01 (Wave A) — deletes all data produced by data01-baseline-seed.mjs /
// data01-moc-crawl.mjs / data01-project-match.mjs, so the pipeline can be
// re-run cleanly from scratch. Run: node scripts/data01-reset.mjs
import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(`DELETE FROM "ProjectOrganizationRelation"`);
  await client.query(`DELETE FROM "PersonCompanyRole"`);
  await client.query(`DELETE FROM "Person"`);
  await client.query(`DELETE FROM "OrganizationLocation"`);
  await client.query(`DELETE FROM "OrganizationFieldObservation"`);
  await client.query(`DELETE FROM "OrganizationQualificationEvent"`);
  await client.query(`DELETE FROM "OrganizationQualification"`);
  await client.query(`DELETE FROM "OrganizationAlias"`);
  await client.query(`DELETE FROM "OrgDuplicatePair"`);
  await client.query(`DELETE FROM "OrgSourceRecord"`);
  await client.query(`DELETE FROM "OrgImportJob"`);
  await client.query(`DELETE FROM "Organization"`);
  await client.query('COMMIT');
  console.log('DATA01_RESET_OK');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('DATA01_RESET_FAILED', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
