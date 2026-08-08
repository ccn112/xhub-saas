// Wave A (Hapulico golden slice) — POI ingestion for the 3km AOI around
// Hapulico Complex (21.0004883, 105.8071594).
//
// Sources (see docs/geo-migration/*.md "POI/provider data sourcing decision"):
//   - OpenStreetMap via Overpass API: free, no signup, a single bounded
//     query — NOT the "systematic bulk Nominatim" the master handoff doc
//     forbids. Required; the script fails loudly if this doesn't work.
//   - Overture Places via public GeoParquet (no signup/token) queried with
//     duckdb (via .venv-geo, see fetchOverture()/geo-overture-query.py),
//     bbox-filtered so we never scan/download more than the AOI needs.
//     Best-effort: on any failure (duckdb/venv missing, network,
//     release-format change) this logs a clear WARNING and continues with
//     OSM-only data — it does NOT silently fail or crash the whole run.
//   - FSQ OS Places and Google Maps are intentionally NOT used here (FSQ
//     needs an account signup the user has to do themselves; Google Maps
//     scraping is explicitly prohibited by the master handoff doc §21 and by
//     ToS) — see the plan doc for the full rationale.
//
// Pipeline: raw (GeoSourceRecord) -> normalize -> dedupe (GeoDuplicatePair,
// pending only, NEVER auto-merged) -> commit (Place [+ Provider/
// ProviderLocation/ProviderContact for named businesses]). Idempotent:
// GeoSourceRecord is unique on (sourceSystem, sourceId); Place/Provider
// commit is skipped for source records that already have a placeId.
//
// Run: npm run ingest:geo-hapulico
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import pg from 'pg';
import { normalizeVi, haversineMeters, nameSimilarity } from './geo-text.mjs';
import { mapOsmTagsToXhubCategory } from './geo-taxonomy.mjs';

const HAPULICO = { lat: 21.0004883, lng: 105.8071594 };
const RADIUS_M = 3000;
const AOI_LABEL = 'hapulico-3km';

// Duplicate-candidate thresholds — soft signal only (name+distance), so
// candidates are ALWAYS just proposed (GeoDuplicatePair, decision='pending'),
// never auto-merged. See doc §7.5 for the full scoring rationale.
const DUP_MAX_DISTANCE_M = 60;
const DUP_MIN_NAME_SIMILARITY = 0.5;

function bboxAround(lat, lng, radiusM) {
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  return { latMin: lat - dLat, latMax: lat + dLat, lngMin: lng - dLng, lngMax: lng + dLng };
}

async function fetchOsm(job, client) {
  // A single bounded query for the 3km AOI (Overpass `around:` radius search,
  // not a systematic bulk crawl).
  const query = `
[out:json][timeout:60];
(
  node(around:${RADIUS_M},${HAPULICO.lat},${HAPULICO.lng})[~"^(amenity|shop|healthcare|leisure|office|craft)$"~"."];
  way(around:${RADIUS_M},${HAPULICO.lat},${HAPULICO.lng})[~"^(amenity|shop|healthcare|leisure|office|craft)$"~"."];
);
out center tags;
`.trim();

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    // Overpass's Apache front-end returns 406 to Node's bare default fetch
    // headers (no Accept/User-Agent) — explicit values fixed it, verified
    // against the same request that 406'd without them.
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: '*/*',
      'User-Agent': 'xhub-geo-ingest/1.0 (Wave A Hapulico pilot; see docs/geo-migration)',
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass API returned HTTP ${res.status}`);
  const json = await res.json();
  const elements = json.elements ?? [];

  let inserted = 0;
  for (const el of elements) {
    const lat = el.type === 'node' ? el.lat : el.center?.lat;
    const lng = el.type === 'node' ? el.lon : el.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!el.tags?.name) continue; // skip nameless infra nodes for Wave A
    const sourceId = `${el.type}/${el.id}`;
    await client.query(
      `INSERT INTO "GeoSourceRecord" (id, "importJobId", "sourceSystem", "sourceId", domain, raw, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'osm', $2, 'PLACE', $3, now())
       ON CONFLICT ("sourceSystem","sourceId") DO UPDATE SET raw = EXCLUDED.raw, "updatedAt" = now()`,
      [job.osmJobId, sourceId, JSON.stringify({ ...el, lat, lng })],
    );
    inserted++;
  }
  return inserted;
}

async function fetchOverture(job, client) {
  // Discover the current release dynamically (rotates ~monthly) rather than
  // hardcoding a tag that will go stale.
  const listXml = await fetch(
    'https://overturemaps-us-west-2.s3.amazonaws.com/?list-type=2&delimiter=/&prefix=release/',
  ).then((r) => r.text());
  const releases = [...listXml.matchAll(/<Prefix>release\/([^/]+)\/<\/Prefix>/g)].map((m) => m[1]).sort();
  const release = releases.at(-1);
  if (!release) throw new Error('could not discover an Overture release tag from the S3 listing');

  const { latMin, latMax, lngMin, lngMax } = bboxAround(HAPULICO.lat, HAPULICO.lng, RADIUS_M);
  const bboxArgs = [String(release), String(lngMin), String(latMin), String(lngMax), String(latMax)];

  // Prefer the .venv-geo virtualenv's `duckdb` PYTHON package (installed via
  // `python3 -m venv .venv-geo && .venv-geo/bin/pip install duckdb` — no
  // brew/sudo needed, see geo-overture-query.py) since a plain `duckdb` CLI
  // binary isn't guaranteed to be on PATH. Either way this whole source is
  // best-effort — see the try/catch around this call in main().
  const venvPython = join(process.cwd(), '.venv-geo', 'bin', 'python3');
  const helperScript = join(process.cwd(), 'scripts', 'geo-overture-query.py');
  const stdout = execFileSync(venvPython, [helperScript, ...bboxArgs], {
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
    // stderr 'inherit' so geo-overture-query.py's non-silent-cap NOTE (if the
    // AOI has more matches than RESULT_LIMIT) prints straight to our console.
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const rows = stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  let inserted = 0;
  for (const row of rows) {
    if (!row.name) continue;
    await client.query(
      `INSERT INTO "GeoSourceRecord" (id, "importJobId", "sourceSystem", "sourceId", domain, raw, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'overture', $2, 'PLACE', $3, now())
       ON CONFLICT ("sourceSystem","sourceId") DO UPDATE SET raw = EXCLUDED.raw, "updatedAt" = now()`,
      [job.overtureJobId, row.id, JSON.stringify(row)],
    );
    inserted++;
  }
  return inserted;
}

function normalizeOsm(raw) {
  const category = mapOsmTagsToXhubCategory(raw.tags);
  return {
    name: raw.tags.name,
    phone: raw.tags.phone ?? raw.tags['contact:phone'] ?? null,
    website: raw.tags.website ?? raw.tags['contact:website'] ?? null,
    address: [raw.tags['addr:housenumber'], raw.tags['addr:street']].filter(Boolean).join(' ') || null,
    category,
    rawCategoryTag: Object.entries(raw.tags ?? {}).find(([k]) =>
      ['amenity', 'shop', 'healthcare', 'leisure', 'office', 'craft'].includes(k),
    )?.join('=') ?? null,
    lat: raw.lat,
    lng: raw.lng,
  };
}

function normalizeOverture(row) {
  let phone = null;
  try {
    phone = JSON.parse(row.phones_json ?? '[]')[0] ?? null;
  } catch { /* leave null */ }
  let website = null;
  try {
    website = JSON.parse(row.websites_json ?? '[]')[0] ?? null;
  } catch { /* leave null */ }
  return {
    name: row.name,
    phone,
    website,
    address: null,
    category: null, // no OSM-shaped tag to map; see UNMAPPED_CATEGORY_SOURCE issue below
    rawCategoryTag: row.category ?? null,
    lat: row.lat,
    lng: row.lng,
  };
}

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const counts = { osm: 0, overture: 0, overtureSkipped: false, normalized: 0, committed: 0, dupCandidates: 0, unmappedCategory: 0 };

  try {
    await client.query('BEGIN');
    const osmJob = (
      await client.query(
        `INSERT INTO "GeoImportJob" (id, "sourceSystem", domain, stage, "aoiLabel", "updatedAt")
         VALUES (gen_random_uuid()::text, 'osm', 'PLACE', 'staging', $1, now()) RETURNING id`,
        [AOI_LABEL],
      )
    ).rows[0].id;
    const overtureJob = (
      await client.query(
        `INSERT INTO "GeoImportJob" (id, "sourceSystem", domain, stage, "aoiLabel", "updatedAt")
         VALUES (gen_random_uuid()::text, 'overture', 'PLACE', 'staging', $1, now()) RETURNING id`,
        [AOI_LABEL],
      )
    ).rows[0].id;
    await client.query('COMMIT');

    counts.osm = await fetchOsm({ osmJobId: osmJob }, client);
    console.log(`GEO_HAPULICO_INGEST | osm raw records: ${counts.osm}`);

    try {
      counts.overture = await fetchOverture({ overtureJobId: overtureJob }, client);
      console.log(`GEO_HAPULICO_INGEST | overture raw records: ${counts.overture}`);
    } catch (err) {
      counts.overtureSkipped = true;
      console.warn(
        `GEO_HAPULICO_INGEST_WARN | Overture ingestion skipped (best-effort source): ${err.message}`,
      );
    }
    await client.query(
      `UPDATE "GeoImportJob" SET stage='staging', counts=$1 WHERE id=$2`,
      [JSON.stringify({ raw: counts.osm }), osmJob],
    );
    await client.query(
      `UPDATE "GeoImportJob" SET stage='staging', counts=$1 WHERE id=$2`,
      [JSON.stringify({ raw: counts.overture, skipped: counts.overtureSkipped }), overtureJob],
    );

    // --- normalize ---
    const { rows: staged } = await client.query(
      `SELECT id, "sourceSystem", "sourceId", raw FROM "GeoSourceRecord"
       WHERE "importJobId" IN ($1,$2) AND normalized IS NULL`,
      [osmJob, overtureJob],
    );
    for (const rec of staged) {
      const normalized = rec.sourceSystem === 'osm' ? normalizeOsm(rec.raw) : normalizeOverture(rec.raw);
      if (!normalized.category) {
        counts.unmappedCategory++;
        await client.query(
          `INSERT INTO "DataQualityIssue" (id, "subjectType", "subjectId", "issueType", detail)
           VALUES (gen_random_uuid()::text, 'GeoSourceRecord', $1, 'unmapped_category', $2)`,
          [rec.id, JSON.stringify({ sourceSystem: rec.sourceSystem, rawCategoryTag: normalized.rawCategoryTag })],
        );
      }
      await client.query(`UPDATE "GeoSourceRecord" SET normalized=$1, "updatedAt"=now() WHERE id=$2`, [
        JSON.stringify(normalized),
        rec.id,
      ]);
      counts.normalized++;
    }
    await client.query(`UPDATE "GeoImportJob" SET stage='normalized' WHERE id IN ($1,$2)`, [osmJob, overtureJob]);

    // --- dedupe (propose only, never auto-merge) ---
    const { rows: normedAll } = await client.query(
      `SELECT id, "sourceSystem", normalized FROM "GeoSourceRecord"
       WHERE "importJobId" IN ($1,$2) AND normalized IS NOT NULL AND "placeId" IS NULL`,
      [osmJob, overtureJob],
    );
    for (let i = 0; i < normedAll.length; i++) {
      for (let j = i + 1; j < normedAll.length; j++) {
        const a = normedAll[i].normalized;
        const b = normedAll[j].normalized;
        if (normedAll[i].sourceSystem === normedAll[j].sourceSystem) continue; // only cross-source pairs matter here
        if (!Number.isFinite(a.lat) || !Number.isFinite(b.lat)) continue;
        const dist = haversineMeters(a.lat, a.lng, b.lat, b.lng);
        if (dist > DUP_MAX_DISTANCE_M) continue;
        const sim = nameSimilarity(a.name, b.name);
        if (sim < DUP_MIN_NAME_SIMILARITY) continue;
        const score = 0.6 * sim + 0.4 * (1 - dist / DUP_MAX_DISTANCE_M);
        await client.query(
          `INSERT INTO "GeoDuplicatePair" (id, "sourceRecordId", "candidatePlaceId", "importJobId", score, reason, decision)
           VALUES (gen_random_uuid()::text, $1, NULL, $2, $3, $4, 'pending')`,
          [normedAll[i].id, osmJob, score, `distance_m=${dist.toFixed(1)}, name_similarity=${sim.toFixed(2)}, candidate=${normedAll[j].id}`],
        );
        counts.dupCandidates++;
      }
    }

    // --- dedupe pass 2: same-batch comparison above only catches overlap
    // WITHIN this run. A record can also duplicate a Place already committed
    // by an EARLIER run (e.g. this script crashed/restarted mid-way, or ran
    // twice) — compare every pending record against nearby ALREADY-COMMITTED
    // Places too, via a PostGIS ST_DWithin prefilter (cheap, indexed) so this
    // stays O(records) not O(records × all Places ever committed).
    for (const rec of normedAll) {
      const n = rec.normalized;
      if (!Number.isFinite(n.lat) || !Number.isFinite(n.lng)) continue;
      const { rows: nearbyPlaces } = await client.query(
        `SELECT id, "canonicalName" FROM "Place"
         WHERE geom IS NOT NULL
           AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, $3)`,
        [n.lng, n.lat, DUP_MAX_DISTANCE_M],
      );
      for (const place of nearbyPlaces) {
        const sim = nameSimilarity(n.name, place.canonicalName);
        if (sim < DUP_MIN_NAME_SIMILARITY) continue;
        await client.query(
          `INSERT INTO "GeoDuplicatePair" (id, "sourceRecordId", "candidatePlaceId", "importJobId", score, reason, decision)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'pending')`,
          [rec.id, place.id, osmJob, sim, `vs already-committed Place ${place.id} ("${place.canonicalName}"), name_similarity=${sim.toFixed(2)}`],
        );
        counts.dupCandidates++;
      }
    }
    await client.query(`UPDATE "GeoImportJob" SET stage='reviewed' WHERE id IN ($1,$2)`, [osmJob, overtureJob]);

    // --- commit: every unmatched normalized record becomes its own Place
    // (+ Provider if named business) — no auto-merge, see DUP_* above ---
    const { rows: toCommit } = await client.query(
      `SELECT id, "sourceSystem", "sourceId", normalized FROM "GeoSourceRecord"
       WHERE "importJobId" IN ($1,$2) AND normalized IS NOT NULL AND "placeId" IS NULL`,
      [osmJob, overtureJob],
    );
    for (const rec of toCommit) {
      const n = rec.normalized;
      if (!Number.isFinite(n.lat) || !Number.isFinite(n.lng)) continue;
      await client.query('BEGIN');
      const placeId = (
        await client.query(
          `INSERT INTO "Place"
             (id, "canonicalName", "normalizedName", "primaryCategoryId", latitude, longitude,
              "addressText", "phonePrimary", "websitePrimary", "lastObservedAt", "updatedAt")
           VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8, now(), now())
           RETURNING id`,
          [n.name, normalizeVi(n.name), n.category, n.lat, n.lng, n.address, n.phone, n.website],
        )
      ).rows[0].id;
      await client.query(
        `UPDATE "Place" SET geom = ST_SetSRID(ST_MakePoint($1,$2),4326)::geography WHERE id=$3`,
        [n.lng, n.lat, placeId],
      );
      await client.query(
        `INSERT INTO "PlaceSource"
           (id, "placeId", source, "sourcePlaceId", "sourcePayload", "sourceObservedAt", confidence)
         VALUES (gen_random_uuid()::text,$1,$2,$3,$4, now(), $5)`,
        [placeId, rec.sourceSystem, rec.sourceId, JSON.stringify(n), rec.sourceSystem === 'osm' ? 0.7 : 0.6],
      );

      // Named business -> also a Provider (DISCOVERED lifecycle stage only).
      const providerId = (
        await client.query(
          `INSERT INTO "Provider" (id, "displayName", "normalizedName", "providerType", "verificationStatus", website, phone, "updatedAt")
           VALUES (gen_random_uuid()::text,$1,$2,$3,'DISCOVERED',$4,$5, now())
           RETURNING id`,
          [n.name, normalizeVi(n.name), n.category, n.website, n.phone],
        )
      ).rows[0].id;
      const locId = (
        await client.query(
          `INSERT INTO "ProviderLocation" (id, "providerId", "placeId", "locationName", address, latitude, longitude, phone, "isPrimary", "updatedAt")
           VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,true, now())
           RETURNING id`,
          [providerId, placeId, n.name, n.address, n.lat, n.lng, n.phone],
        )
      ).rows[0].id;
      await client.query(
        `UPDATE "ProviderLocation" SET geom = ST_SetSRID(ST_MakePoint($1,$2),4326)::geography WHERE id=$3`,
        [n.lng, n.lat, locId],
      );
      if (n.phone) {
        await client.query(
          `INSERT INTO "ProviderContact" (id, "providerId", "locationId", type, value, "isPrimary", "observedAt")
           VALUES (gen_random_uuid()::text,$1,$2,'phone',$3,true, now())`,
          [providerId, locId, n.phone],
        );
      }
      if (n.website) {
        await client.query(
          `INSERT INTO "ProviderContact" (id, "providerId", "locationId", type, value, "isPrimary", "observedAt")
           VALUES (gen_random_uuid()::text,$1,$2,'website',$3,true, now())`,
          [providerId, locId, n.website],
        );
      }

      await client.query(`UPDATE "GeoSourceRecord" SET "placeId"=$1, "matchStatus"='matched', "updatedAt"=now() WHERE id=$2`, [
        placeId,
        rec.id,
      ]);
      await client.query('COMMIT');
      counts.committed++;
    }
    await client.query(`UPDATE "GeoImportJob" SET stage='committed' WHERE id IN ($1,$2)`, [osmJob, overtureJob]);

    console.log(
      `GEO_HAPULICO_INGEST_OK | osm=${counts.osm} overture=${counts.overture}${counts.overtureSkipped ? '(skipped)' : ''} ` +
        `normalized=${counts.normalized} committed=${counts.committed} dupCandidates=${counts.dupCandidates} unmappedCategory=${counts.unmappedCategory}`,
    );
    if (counts.committed < 100) {
      console.warn(
        `GEO_HAPULICO_INGEST_WARN | committed only ${counts.committed} places — doc §10 target is 100-300 for the golden slice; ` +
          `not a silent cap, just logging that the AOI/tag filter may need widening.`,
      );
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch { /* nothing open */ }
    console.error('GEO_HAPULICO_INGEST_FAILED', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
