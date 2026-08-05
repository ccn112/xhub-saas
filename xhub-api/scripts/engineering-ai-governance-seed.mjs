// Engineering Governance — AI System Registry seeder (seed:engineering-ai-
// governance, DG-10). Seeds the ONLY real AI system in this codebase today
// (X.Office workflow AI draft) from seed-data/engineering/ai-systems.seed.json.
//
// Idempotent: upsert-by code. Requires seed:engineering-products first.
// Run: npm run seed:engineering-ai-governance
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const { systems } = JSON.parse(
  readFileSync(join(process.cwd(), 'seed-data', 'engineering', 'ai-systems.seed.json'), 'utf8'),
);

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  let count = 0;
  for (const s of systems) {
    const prod = await c.query('SELECT id FROM "Product" WHERE code = $1', [s.productCode]);
    if (prod.rows.length === 0) throw new Error(`Unknown product code ${s.productCode} — run seed:engineering-products first`);
    const productId = prod.rows[0].id;
    await c.query(
      `INSERT INTO "AISystem" (id, code, "productId", name, purpose, provider, "riskTier", "humanOversight", "standardsRefs", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, purpose = EXCLUDED.purpose,
         provider = EXCLUDED.provider, "riskTier" = EXCLUDED."riskTier",
         "humanOversight" = EXCLUDED."humanOversight", "standardsRefs" = EXCLUDED."standardsRefs", "updatedAt" = now()`,
      [s.code, productId, s.name, s.purpose ?? null, s.provider ?? null, s.riskTier ?? 'MINIMAL', s.humanOversight ?? null, s.standardsRefs ?? []],
    );
    count++;
  }
  await c.query('COMMIT');
  console.log(`engineering-ai-governance seed OK | systems=${count}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('engineering-ai-governance seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
