import 'dotenv/config';
import pg from 'pg';
const url = process.env.DATABASE_URL;
if (!url) { console.log('NO_DATABASE_URL'); process.exit(1); }
const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  const r = await client.query('select current_database() db, current_user usr, version() v');
  console.log('OK | db=' + r.rows[0].db + ' user=' + r.rows[0].usr + ' | ' + r.rows[0].v.split(',')[0]);
  await client.end();
} catch (e) {
  console.log('FAIL | ' + (e.code || '') + ' | ' + String(e.message).slice(0, 160));
  process.exit(2);
}
