// Engineering Governance — Processing Activity Registry seeder
// (seed:engineering-privacy, DG-11). Seeds 2 real data-processing activities
// from seed-data/engineering/processing-activities.seed.json.
//
// Idempotent: upsert-by code. Requires seed:engineering-products first.
// Run: npm run seed:engineering-privacy
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const { activities } = JSON.parse(
  readFileSync(join(process.cwd(), 'seed-data', 'engineering', 'processing-activities.seed.json'), 'utf8'),
);

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  let count = 0;
  for (const a of activities) {
    const prod = await c.query('SELECT id FROM "Product" WHERE code = $1', [a.productCode]);
    if (prod.rows.length === 0) throw new Error(`Unknown product code ${a.productCode} — run seed:engineering-products first`);
    const productId = prod.rows[0].id;
    await c.query(
      `INSERT INTO "ProcessingActivity" (id, code, "productId", name, purpose, "dataCategories", "legalBasis", "standardsRefs", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, purpose = EXCLUDED.purpose,
         "dataCategories" = EXCLUDED."dataCategories", "legalBasis" = EXCLUDED."legalBasis",
         "standardsRefs" = EXCLUDED."standardsRefs", "updatedAt" = now()`,
      [a.code, productId, a.name, a.purpose ?? null, a.dataCategories ?? [], a.legalBasis ?? null, a.standardsRefs ?? []],
    );
    count++;
  }
  await c.query('COMMIT');
  console.log(`engineering-privacy seed OK | activities=${count}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('engineering-privacy seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
