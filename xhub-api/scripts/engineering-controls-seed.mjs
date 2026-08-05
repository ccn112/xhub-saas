// Engineering Governance — Unified Control Framework seeder
// (seed:engineering-controls, DG-09). Seeds a curated 16-control catalog +
// PRD-XHUB implementation status from seed-data/engineering/controls.seed.json
// — every evidenceRef points at a real file/command already in this
// codebase, not placeholder text.
//
// Idempotent: upsert-by code (Control), upsert-by (controlId,productId)
// (ControlImplementation). Requires seed:engineering-products first.
// Run: npm run seed:engineering-controls
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const { controls, implementations } = JSON.parse(
  readFileSync(join(process.cwd(), 'seed-data', 'engineering', 'controls.seed.json'), 'utf8'),
);

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  const controlIdByCode = new Map();
  for (const ctl of controls) {
    const res = await c.query(
      `INSERT INTO "Control" (id, code, domain, title, "frameworkFamilies", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, now())
       ON CONFLICT (code) DO UPDATE SET domain = EXCLUDED.domain, title = EXCLUDED.title,
         "frameworkFamilies" = EXCLUDED."frameworkFamilies", "updatedAt" = now()
       RETURNING id`,
      [ctl.code, ctl.domain, ctl.title, ctl.frameworkFamilies ?? []],
    );
    controlIdByCode.set(ctl.code, res.rows[0].id);
  }

  let implCount = 0;
  for (const [productCode, rows] of Object.entries(implementations)) {
    const prod = await c.query('SELECT id FROM "Product" WHERE code = $1', [productCode]);
    if (prod.rows.length === 0) throw new Error(`Unknown product code ${productCode} — run seed:engineering-products first`);
    const productId = prod.rows[0].id;
    for (const row of rows) {
      const controlId = controlIdByCode.get(row.controlCode);
      if (!controlId) throw new Error(`Unknown control code in implementations: ${row.controlCode}`);
      await c.query(
        `INSERT INTO "ControlImplementation" (id, "controlId", "productId", status, "evidenceRefs", notes, "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, now())
         ON CONFLICT ("controlId", "productId") DO UPDATE SET status = EXCLUDED.status,
           "evidenceRefs" = EXCLUDED."evidenceRefs", notes = EXCLUDED.notes, "updatedAt" = now()`,
        [controlId, productId, row.status, row.evidenceRefs ?? [], row.notes ?? null],
      );
      implCount++;
    }
  }

  await c.query('COMMIT');
  console.log(`engineering-controls seed OK | controls=${controls.length} implementations=${implCount}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('engineering-controls seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
