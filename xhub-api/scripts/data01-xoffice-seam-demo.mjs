// DATA-01 (Wave A) — proves the XOffice seam works: `Customer.canonicalCustomerId`
// (prisma-xoffice/schema.prisma:2226, previously "reserved... NOT wired this
// pass") set to a real `Organization.id` from the physically separate `xhub`
// DB, then round-tripped — same cross-DB soft-reference pattern as X2's
// `xhub_project_id` for `GlobalProject` (no shared DB, no dual-write, no hard
// FK across databases). This is a proof, NOT the full CRM projection/lead-
// scoring/sync-worker engine (deferred — see docs/data01/*.md).
// Run: npm run demo:data01-xoffice-seam
import 'dotenv/config';
import pg from 'pg';

const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? 'tenant-xtech';
const DEMO_CODE = 'CUS-DATA01-DEMO';

const xhub = new pg.Client({ connectionString: process.env.DATABASE_URL });
const xoffice = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await xhub.connect();
await xoffice.connect();

try {
  // 1. Pick a real, enriched Organization from the xhub DB (Long Dương Group —
  // one of the 12 enriched accounts, has taxCode/contacts already).
  const orgRes = await xhub.query(
    `SELECT id, "legalName", "taxCode", website FROM "Organization" WHERE "taxCode" IS NOT NULL ORDER BY "legalName" LIMIT 1`,
  );
  if (!orgRes.rows.length) {
    throw new Error("no enriched Organization found — run 'npm run seed:data01' first");
  }
  const org = orgRes.rows[0];

  // 2. Upsert a demo Customer in XOffice, canonicalCustomerId = Organization.id.
  await xoffice.query('BEGIN');
  await xoffice.query("SELECT set_config('app.bypass_rls','on',true)");
  const custRes = await xoffice.query(
    `INSERT INTO "Customer" (id, "tenantId", code, "canonicalCustomerId", name, status, "taxCode", website, "createdBy", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'PROSPECT', $5, $6, 'data01-seam-demo', now())
     ON CONFLICT ("tenantId", code) DO UPDATE SET
       "canonicalCustomerId" = EXCLUDED."canonicalCustomerId", name = EXCLUDED.name,
       "taxCode" = EXCLUDED."taxCode", website = EXCLUDED.website, "updatedAt" = now()
     RETURNING id, "canonicalCustomerId"`,
    [TENANT_ID, DEMO_CODE, org.id, org.legalName, org.taxCode, org.website],
  );
  await xoffice.query('COMMIT');
  const customer = custRes.rows[0];

  // 3. Round-trip: read canonicalCustomerId back from XOffice, then resolve
  // it against the xhub DB — proving the soft reference actually works
  // cross-DB, the same way X2 resolves xhub_project_id against XHub.
  const resolved = await xhub.query(`SELECT "legalName", "taxCode" FROM "Organization" WHERE id = $1`, [
    customer.canonicalCustomerId,
  ]);
  const ok = resolved.rows.length === 1 && resolved.rows[0].legalName === org.legalName;

  console.log(
    `DATA01_XOFFICE_SEAM_DEMO_${ok ? 'OK' : 'FAILED'} | Customer(${customer.id}).canonicalCustomerId=${customer.canonicalCustomerId} ` +
      `-> Organization("${resolved.rows[0]?.legalName}", taxCode=${resolved.rows[0]?.taxCode})`,
  );
  process.exitCode = ok ? 0 : 1;
} catch (err) {
  try {
    await xoffice.query('ROLLBACK');
  } catch {
    /* nothing open */
  }
  console.error('DATA01_XOFFICE_SEAM_DEMO_FAILED', err);
  process.exitCode = 1;
} finally {
  await xhub.end();
  await xoffice.end();
}
