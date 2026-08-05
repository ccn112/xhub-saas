// Engineering Governance — Product Registry seeder (seed:engineering-products,
// DG-01). Seeds the 6 ecosystem products from
// seed-data/engineering/products.seed.json (mirrors handoff
// data/SEED_PRODUCTS.csv) plus one initial ProductVersion each, into the
// SHARED Product/ProductVersion tables (Platform DB, no RLS — see
// docs/implementation/engineering-hub/ADR_SCOPE_MODEL.md).
//
// Idempotent: upsert-by Product.code, upsert-by (productId, version).
// Re-running produces NO duplicates. Run: npm run seed:engineering-products
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const { products } = JSON.parse(
  readFileSync(join(process.cwd(), 'seed-data', 'engineering', 'products.seed.json'), 'utf8'),
);

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  let productCount = 0;
  let versionCount = 0;
  for (const p of products) {
    const res = await c.query(
      `INSERT INTO "Product" (id, code, name, type, "ownerRole", "versionPolicy", "rolloutOrder", "sourceSystem", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, 'xhub-saas', now(), now())
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type,
         "ownerRole" = EXCLUDED."ownerRole", "versionPolicy" = EXCLUDED."versionPolicy",
         "rolloutOrder" = EXCLUDED."rolloutOrder", "updatedAt" = now()
       RETURNING id`,
      [p.code, p.name, p.type, p.ownerRole, p.versionPolicy, p.rolloutOrder],
    );
    const productId = res.rows[0].id;
    productCount++;

    await c.query(
      `INSERT INTO "ProductVersion" (id, "productId", version, status, "sourceSystem", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'DRAFT', 'xhub-saas', now(), now())
       ON CONFLICT ("productId", version) DO NOTHING`,
      [productId, p.initialVersion],
    );
    versionCount++;
  }
  await c.query('COMMIT');
  console.log(`engineering-products seed OK | products=${productCount} versions=${versionCount}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('engineering-products seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
