// Wave A (Hapulico golden slice) smoke test. Two halves:
//   1. Pipeline assertions straight against the DB (pg) — ingestion actually
//      committed real rows, dedupe proposals exist and are still pending
//      (never auto-merged), spatial join produced zoned edges.
//   2. API assertions against a running server (:4000) — public catalog
//      contract shape, no raw payload leak, empty-not-error when unlinked.
// Run AFTER: seed:geo-taxonomy, seed:geo-hapulico, ingest:geo-hapulico,
// join:geo-hapulico. Server must be up on :4000 for part 2.
// Run: node scripts/geo-hapulico-smoke.mjs   (or: npm run test:geo-hapulico)
import 'dotenv/config';
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

console.log('GEO_HAPULICO smoke — part 1: DB pipeline assertions');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows: projects } = await client.query(`SELECT * FROM "GlobalProject" WHERE code = 'BDS-PJ158'`);
ok(projects.length === 1, `Hapulico GlobalProject exists (code=BDS-PJ158)`);
const project = projects[0];
let globalProjectId = project?.id;
if (project) {
  ok(project.latitude !== null && project.longitude !== null, 'GlobalProject has lat/lng');
  ok(project.geom !== null, 'GlobalProject.geom set (PostGIS point written via raw SQL)');

  const { rows: srcRows } = await client.query(
    `SELECT * FROM "GlobalProjectSource" WHERE "globalProjectId"=$1 AND "isCurrent"=true`,
    [globalProjectId],
  );
  ok(srcRows.length >= 1, 'GlobalProjectSource lineage row exists (x2_seed)');
  ok(srcRows[0]?.sourceType === 'x2_seed', 'lineage sourceType=x2_seed (read from file, not X2 API)');

  const { rows: placeCountRows } = await client.query(`SELECT count(*)::int AS n FROM "Place"`);
  const placeCount = placeCountRows[0].n;
  ok(placeCount > 0, `Place rows committed (${placeCount})`);
  if (placeCount < 100) {
    console.warn(
      `  ⚠ only ${placeCount} places committed — doc §10 target is 100-300 for the golden slice. ` +
        `Not treated as a failure (Overture may have been skipped/best-effort) but logged, not silently hidden.`,
    );
  }

  const { rows: dupRows } = await client.query(`SELECT decision, count(*)::int AS n FROM "GeoDuplicatePair" GROUP BY decision`);
  const pendingDup = dupRows.find((r) => r.decision === 'pending')?.n ?? 0;
  const mergedDup = dupRows.find((r) => r.decision === 'merge')?.n ?? 0;
  ok(mergedDup === 0, `no GeoDuplicatePair auto-merged (merge=${mergedDup}) — dedupe proposals only, never auto-merge`);
  console.log(`  (info) GeoDuplicatePair pending=${pendingDup}`);

  const { rows: edgeRows } = await client.query(
    `SELECT zone, count(*)::int AS n FROM "ProjectPlaceEdge" WHERE "globalProjectId"=$1 GROUP BY zone`,
    [globalProjectId],
  );
  const totalEdges = edgeRows.reduce((s, r) => s + r.n, 0);
  ok(totalEdges > 0, `ProjectPlaceEdge rows computed (${totalEdges} across zones: ${JSON.stringify(edgeRows)})`);
  ok(
    edgeRows.every((r) => ['inside', 'gate', 'walkable', 'nearby', 'extended'].includes(r.zone)),
    'every edge has a valid zone bucket',
  );

  const { rows: taxRows } = await client.query(`SELECT count(*)::int AS n FROM "ExternalCategoryMapping" WHERE source='osm'`);
  ok(taxRows[0].n > 0, `ExternalCategoryMapping seeded (${taxRows[0].n} osm mappings)`);
}
await client.end();

console.log(`\nGEO_HAPULICO smoke — part 2: API @ ${BASE}`);
try {
  const list = await j('/api/catalog/projects?limit=5');
  ok(list.status === 200, 'GET /api/catalog/projects 200');

  const detail = await j('/api/catalog/projects/BDS-PJ158');
  ok(detail.status === 200 && detail.body?.code === 'BDS-PJ158', 'GET /api/catalog/projects/BDS-PJ158 returns Hapulico');

  const nearby = await j('/api/catalog/projects/BDS-PJ158/nearby?radius_m=3000');
  ok(nearby.status === 200, 'GET .../nearby 200');
  ok(Array.isArray(nearby.body?.items), 'nearby.items is an array');
  ok(typeof nearby.body?.radiusM === 'number', 'nearby.radiusM present');
  if ((nearby.body?.items ?? []).length > 0) {
    const item = nearby.body.items[0];
    ok('placeId' in item && 'distanceM' in item && 'zone' in item, 'nearby item has placeId/distanceM/zone');
    ok(!('sourcePayload' in item) && !('rawCategoryTag' in item), 'nearby item does NOT leak raw source payload');
  }

  const providers = await j('/api/catalog/projects/BDS-PJ158/providers');
  ok(providers.status === 200, 'GET .../providers 200');

  const notFound = await j('/api/catalog/projects/does-not-exist');
  ok(notFound.status === 404, 'unknown project → 404 (not a silent empty 200)');
} catch (err) {
  ok(false, `API reachable @ ${BASE} — is the server running? (${err.message})`);
}

console.log(failed === 0 ? '\nGEO_HAPULICO_SMOKE_OK' : `\nGEO_HAPULICO_SMOKE_FAILED (${failed} check(s) failed)`);
process.exitCode = failed === 0 ? 0 : 1;
