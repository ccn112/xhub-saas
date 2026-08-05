// Engineering Governance — EngineeringDocument seeder (seed:engineering-docs,
// DG-03-lite). Seeds real reference documents from
// seed-data/engineering/documents.seed.json — currently the Security &
// Compliance Standards reference doc (user-requested, 2026-08-05), citing
// standards this codebase already designs against, each with a pointer to
// real evidence (file/command/test result), not aspirational claims.
//
// Idempotent: upsert-by code. Requires seed:engineering-products first.
// Run: npm run seed:engineering-docs
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const { documents } = JSON.parse(
  readFileSync(join(process.cwd(), 'seed-data', 'engineering', 'documents.seed.json'), 'utf8'),
);

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  let count = 0;
  for (const d of documents) {
    const product = await c.query('SELECT id FROM "Product" WHERE code = $1', [d.productCode]);
    if (product.rows.length === 0) {
      throw new Error(`Unknown product code ${d.productCode} — run seed:engineering-products first`);
    }
    const productId = product.rows[0].id;
    await c.query(
      `INSERT INTO "EngineeringDocument" (id, "productId", code, title, "documentType", "ownershipMode", status, classification, body, version, "standardsRefs", "ownerRole", "sourceSystem", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'XHUB_OWNED', 'PUBLISHED', $5, $6, 1, $7, $8, 'xhub-saas', now(), now())
       ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body,
         "standardsRefs" = EXCLUDED."standardsRefs", "updatedAt" = now(), version = "EngineeringDocument".version + 1`,
      [productId, d.code, d.title, d.documentType, d.classification ?? 'INTERNAL', d.body, d.standardsRefs ?? [], d.ownerRole ?? null],
    );
    count++;
  }
  await c.query('COMMIT');
  console.log(`engineering-documents seed OK | documents=${count}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('engineering-documents seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
