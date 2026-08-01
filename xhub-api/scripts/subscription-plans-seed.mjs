// SubscriptionPlan catalog seeder (seed:subscription-plans) — T011 customer
// readiness. Seeds the SHARED / platform-plane SubscriptionPlan table from
// seed-data/platform/subscription-plans.seed.json. Idempotent: upsert-by code.
// Runs under RLS bypass in one tx (server NOT required; needs DATABASE_URL).
// Run: npm run seed:subscription-plans
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const seed = JSON.parse(
  readFileSync(join(process.cwd(), 'seed-data', 'platform', 'subscription-plans.seed.json'), 'utf8'),
);

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  let n = 0;
  for (const p of seed.plans ?? []) {
    await c.query(
      `INSERT INTO "SubscriptionPlan"
         (id, code, name, tier, "appsAllowed", "featureFlags", limits, "priceRef",
          "billingEnabled", "customerTenantMinNo", status, "updatedAt")
       VALUES (COALESCE((SELECT id FROM "SubscriptionPlan" WHERE code=$1), gen_random_uuid()::text),
               $1,$2,$3,$4,$5,$6,$7,$8,$9,'ACTIVE',now())
       ON CONFLICT (code) DO UPDATE SET
         name=EXCLUDED.name, tier=EXCLUDED.tier, "appsAllowed"=EXCLUDED."appsAllowed",
         "featureFlags"=EXCLUDED."featureFlags", limits=EXCLUDED.limits, "priceRef"=EXCLUDED."priceRef",
         "billingEnabled"=EXCLUDED."billingEnabled", "customerTenantMinNo"=EXCLUDED."customerTenantMinNo",
         status='ACTIVE', "updatedAt"=now()`,
      [
        p.code, p.name, p.tier ?? 'CUSTOM', p.appsAllowed ?? [],
        JSON.stringify(p.featureFlags ?? {}), JSON.stringify(p.limits ?? {}),
        p.priceRef ?? null, p.billingEnabled ?? false, p.customerTenantMinNo ?? null,
      ],
    );
    n++;
  }

  await c.query('COMMIT');
  const total = (await c.query(`SELECT COUNT(*)::int AS n FROM "SubscriptionPlan"`)).rows[0].n;
  console.log(`subscription-plans seed OK | upserted=${n} | catalog total=${total}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('subscription-plans seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
