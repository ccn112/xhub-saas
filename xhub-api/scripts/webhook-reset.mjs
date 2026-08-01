// Reset Webhook/Outbox runtime state so the smoke is re-runnable. Bypasses RLS
// to delete WebhookEvent / OutboxEvent rows for the test tenants.
// Run: node scripts/webhook-reset.mjs  (or via npm run test:webhook)
import 'dotenv/config';
import pg from 'pg';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
await c.query("SELECT set_config('app.bypass_rls','on',false)");

const TENANTS = ['tenant-xtech', 'tenant-demo-isolation'];
let we = 0, ob = 0;
for (const t of TENANTS) {
  we += (await c.query(`DELETE FROM "WebhookEvent" WHERE "tenantId"=$1`, [t])).rowCount;
  ob += (await c.query(`DELETE FROM "OutboxEvent" WHERE "tenantId"=$1`, [t])).rowCount;
}
console.log(`webhook reset OK | webhookEvents=${we} outboxEvents=${ob}`);
await c.end();
