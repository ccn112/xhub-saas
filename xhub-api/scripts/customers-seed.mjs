// Customer/Contact seed (seed:customers, Phase 2 BO-0201/BO-0210). Loads
// seed-data/customers/customers.seed.json — the T001 X-TECH sales scenario
// (Riverside), the one reference customer from the actual source handoff
// (see the seed JSON's own _note). Talks straight to Postgres under RLS
// bypass, mirroring announcements-seed.mjs. Server does NOT need to be
// running. Idempotent: upsert-by (tenantId, code).
// Run: npm run seed:customers
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const { tenantId, customers } = JSON.parse(
  readFileSync(join(process.cwd(), 'seed-data', 'customers', 'customers.seed.json'), 'utf8'),
);

const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  let customerCount = 0;
  let contactCount = 0;
  for (const cust of customers) {
    const res = await c.query(
      `INSERT INTO "Customer" (id, "tenantId", code, name, status, "industryCode", "privacyClass", "taxCode", "addressLine", website, notes, "createdBy", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'seed', now())
       ON CONFLICT ("tenantId", code) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status,
         "industryCode" = EXCLUDED."industryCode", "privacyClass" = EXCLUDED."privacyClass",
         "taxCode" = EXCLUDED."taxCode", "addressLine" = EXCLUDED."addressLine", website = EXCLUDED.website,
         notes = EXCLUDED.notes, "updatedAt" = now()
       RETURNING id`,
      [tenantId, cust.code, cust.name, cust.status ?? 'PROSPECT', cust.industryCode ?? null, cust.privacyClass ?? null, cust.taxCode ?? null, cust.addressLine ?? null, cust.website ?? null, cust.notes ?? null],
    );
    const customerId = res.rows[0].id;
    customerCount++;

    for (const contact of cust.contacts ?? []) {
      const existing = await c.query('SELECT id FROM "Contact" WHERE "tenantId" = $1 AND "customerId" = $2 AND "displayName" = $3', [tenantId, customerId, contact.displayName]);
      if (existing.rows.length > 0) continue; // idempotent: don't duplicate on re-run
      await c.query(
        `INSERT INTO "Contact" (id, "tenantId", "customerId", "displayName", role, email, phone, "contactPreference", "isPrimary", notes, "createdBy", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, 'seed', now())`,
        [tenantId, customerId, contact.displayName, contact.role ?? null, contact.email ?? null, contact.phone ?? null, contact.contactPreference ?? [], !!contact.isPrimary, contact.notes ?? null],
      );
      contactCount++;
    }

    await c.query(
      `INSERT INTO "CustomerEvent" (id, "tenantId", "customerId", type, "actorId", data)
       VALUES (gen_random_uuid()::text, $1, $2, 'seeded', 'seed', $3)`,
      [tenantId, customerId, JSON.stringify({ code: cust.code })],
    );
  }

  await c.query('COMMIT');
  console.log(`customers seed OK | customers=${customerCount} contacts=${contactCount}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('customers seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
