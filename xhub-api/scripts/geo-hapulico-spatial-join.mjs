// Wave A — computes ProjectPlaceEdge rows (distance + zone bucket, doc §9.2)
// between the Hapulico GlobalProject and every Place within RADIUS_M using
// PostGIS ST_DWithin/ST_Distance on the `geography` columns (first raw-SQL
// spatial usage in this repo — see XHUB_GEO_READINESS_AUDIT.md §9).
// Recomputes into a NEW spatialVersion each run (never edits existing edges
// in place), so AOI recompute history is preserved per doc §3 comment.
// Run after geo-hapulico-seed.mjs + geo-hapulico-ingest.mjs.
// Run: npm run join:geo-hapulico
import 'dotenv/config';
import pg from 'pg';
import { zoneForDistance } from './geo-text.mjs';

const RADIUS_M = 3000;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows: projects } = await client.query(
    `SELECT id FROM "GlobalProject" WHERE code = 'BDS-PJ158'`,
  );
  if (!projects.length) {
    throw new Error("Hapulico GlobalProject not found — run 'npm run seed:geo-hapulico' first");
  }
  const globalProjectId = projects[0].id;

  const { rows: maxVersionRows } = await client.query(
    `SELECT COALESCE(MAX("spatialVersion"), 0) AS v FROM "ProjectPlaceEdge" WHERE "globalProjectId"=$1`,
    [globalProjectId],
  );
  const spatialVersion = maxVersionRows[0].v + 1;

  // ST_DWithin on geography is index-friendly and metric-accurate (unlike a
  // naive planar bounding box); ST_Distance gives the exact meters for the
  // zone bucket.
  const { rows: nearby } = await client.query(
    `SELECT p.id AS "placeId", p."primaryCategoryId" AS "categoryId",
            ST_Distance(p.geom, gp.geom) AS "distanceM"
     FROM "Place" p, "GlobalProject" gp
     WHERE gp.id = $1
       AND p.geom IS NOT NULL AND gp.geom IS NOT NULL
       AND ST_DWithin(p.geom, gp.geom, $2)`,
    [globalProjectId, RADIUS_M],
  );

  let inserted = 0;
  const byZone = {};
  for (const row of nearby) {
    const distanceM = Number(row.distanceM);
    const zone = zoneForDistance(distanceM);
    byZone[zone] = (byZone[zone] ?? 0) + 1;
    await client.query(
      `INSERT INTO "ProjectPlaceEdge"
         (id, "globalProjectId", "placeId", "relationType", "distanceM", "insideProject",
          "categoryId", zone, "spatialVersion")
       VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        globalProjectId,
        row.placeId,
        zone === 'inside' ? 'INSIDE' : 'NEARBY',
        distanceM,
        zone === 'inside',
        row.categoryId,
        zone,
        spatialVersion,
      ],
    );
    inserted++;
  }

  console.log(
    `GEO_HAPULICO_SPATIAL_JOIN_OK | globalProjectId=${globalProjectId} spatialVersion=${spatialVersion} ` +
      `edges=${inserted} byZone=${JSON.stringify(byZone)}`,
  );
} catch (err) {
  console.error('GEO_HAPULICO_SPATIAL_JOIN_FAILED', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
