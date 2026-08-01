// Reset control-plane runtime state for the smoke's app (xweb) so the smoke is
// re-runnable. Bypasses RLS to clear tenant-xtech xweb bindings/commands/conflicts.
import 'dotenv/config';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
await c.query("SELECT set_config('app.bypass_rls','on',false)");
const t = 'tenant-xtech';
const conf = await c.query(`DELETE FROM "ProvisioningConflict" WHERE "tenantId"=$1`, [t]);
const cmd = await c.query(`DELETE FROM "ProvisioningCommand" WHERE "tenantId"=$1 AND "applicationCode"='xweb'`, [t]);
const bind = await c.query(`DELETE FROM "AppAccountBinding" WHERE "tenantId"=$1 AND "applicationCode"='xweb'`, [t]);
console.log(`reset OK | conflicts=${conf.rowCount} commands=${cmd.rowCount} bindings=${bind.rowCount}`);
await c.end();
