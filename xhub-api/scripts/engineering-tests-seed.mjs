// Engineering Governance — TestSuite/TestCase seeder (seed:engineering-tests,
// DG-04-lite). Seeds a REPRESENTATIVE SAMPLE of test suites ("Module",
// matching the existing USER_TEST_GROUPS/XOFFICE_TEST_GROUPS names) + a few
// real test cases per suite, from seed-data/engineering/test-suites.seed.json.
// This is NOT the full legacy U# migration (that's a separate, higher-risk
// DG-04 phase per docs/implementation/engineering-hub/ADR_MODULE_OWNERSHIP.md)
// — these are NEW rows created fresh for the Engineering Hub's own
// reference-slice dogfooding.
//
// Idempotent: upsert-by (productId, name) for TestSuite, upsert-by code for
// TestCase. Requires seed:engineering-products to have run first.
// Run: npm run seed:engineering-tests
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const { suites } = JSON.parse(
  readFileSync(join(process.cwd(), 'seed-data', 'engineering', 'test-suites.seed.json'), 'utf8'),
);

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  let suiteCount = 0;
  let caseCount = 0;
  for (const s of suites) {
    const product = await c.query('SELECT id FROM "Product" WHERE code = $1', [s.productCode]);
    if (product.rows.length === 0) {
      throw new Error(`Unknown product code ${s.productCode} — run seed:engineering-products first`);
    }
    const productId = product.rows[0].id;

    const suiteRes = await c.query(
      `INSERT INTO "TestSuite" (id, "productId", name, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, now())
       ON CONFLICT ("productId", name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [productId, s.name],
    );
    const testSuiteId = suiteRes.rows[0].id;
    suiteCount++;

    for (const tc of s.cases ?? []) {
      await c.query(
        `INSERT INTO "TestCase" (id, "testSuiteId", code, title, "expectedResult", "deepLinkTemplate", "externalLegacyCode", level, "requiredForRelease", "standardsRefs", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
         ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, "expectedResult" = EXCLUDED."expectedResult",
           "deepLinkTemplate" = EXCLUDED."deepLinkTemplate", level = EXCLUDED.level,
           "requiredForRelease" = EXCLUDED."requiredForRelease", "standardsRefs" = EXCLUDED."standardsRefs", "updatedAt" = now()`,
        [
          testSuiteId,
          tc.code,
          tc.title,
          tc.expectedResult ?? null,
          tc.deepLinkTemplate ?? null,
          tc.externalLegacyCode ?? null,
          tc.level ?? 'UAT',
          tc.requiredForRelease ?? false,
          tc.standardsRefs ?? [],
        ],
      );
      caseCount++;
    }
  }
  await c.query('COMMIT');
  console.log(`engineering-tests seed OK | suites=${suiteCount} cases=${caseCount}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('engineering-tests seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
