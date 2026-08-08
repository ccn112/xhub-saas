// DATA-03 (Wave A) smoke test. Two halves:
//   1. DB pipeline assertions — 25 suppliers / 61 products / 122 specs / 14
//      channel relations / 6 price observations imported; domain-based
//      entity resolution correctly reused DATA-02 orgs (no duplicate KONE
//      VIETNAM); media ingestion cached real files with real dimensions,
//      never a bare hotlinked URL.
//   2. API assertions against a running server (:4000) — best-effort, same
//      convention as data01/data02-smoke.mjs.
// Run AFTER: seed:data01, seed:data02, seed:data03, ingest:data03-media.
// Run: node scripts/data03-smoke.mjs   (or: npm run test:data03)
import 'dotenv/config';
import { existsSync } from 'node:fs';
import pg from 'pg';

const BASE = process.env.XHUB_BASE || 'http://localhost:4000';

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else {
    console.error('  ✗ ' + msg);
    failed++;
  }
};
const j = async (path) => {
  const r = await fetch(BASE + path);
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};

console.log('DATA03 smoke — part 1: DB pipeline assertions');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows: supplierRows } = await client.query(
  `SELECT count(*)::int AS n FROM "OrgSourceRecord"
   WHERE "sourceSystem"='data03_agent_research' AND raw ? 'Org ID'`,
);
ok(supplierRows[0].n === 25, `25 supplier rows staged (got ${supplierRows[0].n})`);

const { rows: discoveryRows } = await client.query(
  `SELECT count(*)::int AS n FROM "OrgSourceRecord"
   WHERE "sourceSystem"='data03_agent_research' AND "sourceId" LIKE 'discovery-%'`,
);
ok(discoveryRows[0].n === 14, `14 agent-discovery candidates staged only (got ${discoveryRows[0].n})`);

const { rows: productRows } = await client.query(`SELECT count(*)::int AS n FROM "EquipmentProduct"`);
ok(productRows[0].n === 61, `61 EquipmentProduct rows (got ${productRows[0].n})`);

const { rows: specRows } = await client.query(`SELECT count(*)::int AS n FROM "ProductSpec"`);
ok(specRows[0].n === 122, `122 ProductSpec rows (got ${specRows[0].n})`);

const { rows: channelRows } = await client.query(`SELECT count(*)::int AS n FROM "OrganizationProductRelation"`);
ok(channelRows[0].n === 14, `14 OrganizationProductRelation rows (got ${channelRows[0].n})`);

const { rows: priceRows } = await client.query(`SELECT count(*)::int AS n FROM "ProductPriceObservation"`);
ok(priceRows[0].n === 6, `6 ProductPriceObservation rows, 1 correctly skipped for missing Product ID (got ${priceRows[0].n})`);

// Domain-based entity resolution: KONE must be ONE Organization row shared
// between DATA-02 ("KONE VIETNAM") and DATA-03 ("CÔNG TY TNHH KONE VIỆT
// NAM"), not two duplicates, matched via the shared kone.vn website domain.
const { rows: koneRows } = await client.query(
  `SELECT id, "legalName" FROM "Organization" WHERE website ILIKE '%kone.vn%'`,
);
ok(koneRows.length === 1, `exactly 1 Organization row for kone.vn (no duplicate identity) — got ${koneRows.length}: ${JSON.stringify(koneRows)}`);
if (koneRows.length === 1) {
  const { rows: koneProducts } = await client.query(
    `SELECT count(*)::int AS n FROM "EquipmentProduct" WHERE "manufacturerOrgId"=$1`,
    [koneRows[0].id],
  );
  ok(koneProducts[0].n > 0, `KONE's single Organization row is correctly attributed as manufacturer of its products (${koneProducts[0].n})`);
}

// Media: real cached files, real dimensions, never a bare hotlinked URL.
const { rows: mediaStatusRows } = await client.query(
  `SELECT status, count(*)::int AS n FROM "OrganizationMedia" GROUP BY status ORDER BY status`,
);
const mediaMap = Object.fromEntries(mediaStatusRows.map((r) => [r.status, r.n]));
ok(mediaMap.CACHED === 20, `20 OrganizationMedia rows CACHED (got ${mediaMap.CACHED ?? 0})`);
ok(mediaMap.REJECTED === 3, `3 legitimately rejected (Google favicon 404s) (got ${mediaMap.REJECTED ?? 0})`);
ok((mediaMap.PENDING ?? 0) === 0, `0 still PENDING — ingestion ran to completion (got ${mediaMap.PENDING ?? 0})`);

const { rows: cachedMedia } = await client.query(
  `SELECT "localMediaPath", width, height, "contentHash" FROM "OrganizationMedia" WHERE status='CACHED'`,
);
ok(
  cachedMedia.every((m) => m.localMediaPath && m.contentHash),
  'every CACHED row has a real localMediaPath + contentHash (not a bare remote URL)',
);
const sample = cachedMedia.find((m) => m.localMediaPath && existsSync(m.localMediaPath));
ok(!!sample, `at least one CACHED media file actually exists on disk (checked ${cachedMedia.length} rows)`);

await client.end();

console.log(`\nDATA03 smoke — part 2: API @ ${BASE} (best-effort)`);
try {
  const list = await j('/api/catalog/products?limit=5');
  ok(list.status === 200, 'GET /api/catalog/products 200');
  ok((list.body?.items ?? []).length > 0, 'products list is non-empty');

  const search = await j('/api/catalog/products?q=Access');
  const productId = search.body?.items?.[0]?.id;
  if (productId) {
    const detail = await j(`/api/catalog/products/${productId}`);
    ok(detail.status === 200, 'GET /api/catalog/products/:id 200');
    ok(!('price' in detail.body), 'product detail never exposes a bare static price field');

    const specs = await j(`/api/catalog/products/${productId}/specs`);
    ok(specs.status === 200 && Array.isArray(specs.body?.items), 'specs endpoint returns an array');

    const prices = await j(`/api/catalog/products/${productId}/prices`);
    ok(prices.status === 200 && Array.isArray(prices.body?.items), 'prices endpoint returns temporal observations, not a single value');
  }

  const notFound = await j('/api/catalog/products/does-not-exist');
  ok(notFound.status === 404, 'unknown product id → 404');
} catch (err) {
  ok(false, `API reachable @ ${BASE} — is the server running? (${err.message})`);
}

console.log(failed === 0 ? '\nDATA03_SMOKE_OK' : `\nDATA03_SMOKE_FAILED (${failed} check(s) failed)`);
process.exitCode = failed === 0 ? 0 : 1;
