#!/usr/bin/env python3
"""Query Overture Places (public GeoParquet, no signup/token) for one bbox,
print NDJSON to stdout. Invoked from geo-hapulico-ingest.mjs via the
.venv-geo virtualenv's python (the `duckdb` CLI binary itself isn't always
available — brew's postgis/duckdb installs can be slow/flaky on a given
machine — so this uses the `duckdb` PYTHON package instead, same engine).

Usage: geo-overture-query.py <release> <lng_min> <lat_min> <lng_max> <lat_max>
"""
import sys
import json
import duckdb

release, lng_min, lat_min, lng_max, lat_max = sys.argv[1:6]

con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs;")
con.execute("SET s3_region='us-west-2';")

# Overture's `category` free-text values don't reliably match our fixed OSM
# tag-based taxonomy (geo-taxonomy.mjs), and an UNFILTERED bbox query over a
# dense Hanoi urban core returns 20,000+ rows (verified against this exact
# AOI) — nowhere near the doc §10 golden-slice target of 100-300. Keyword
# LIKE-match on category text is resilient to not knowing Overture's exact
# taxonomy string list; combined with a confidence floor + LIMIT as an
# explicit, LOGGED safety cap (never a silent truncation).
CATEGORY_KEYWORDS = [
    'restaurant', 'food', 'cafe', 'coffee', 'bar', 'bakery',
    'grocery', 'supermarket', 'convenience',
    'school', 'education', 'kindergarten', 'university',
    'hospital', 'clinic', 'doctor', 'health', 'dentist',
    'pharmacy', 'drug_store',
    'hair', 'beauty', 'salon', 'spa', 'nail',
    'laundry', 'dry_clean',
    'repair', 'hardware', 'home_improvement',
    'gym', 'fitness', 'sport',
    'child', 'kids', 'toy',
    'pet', 'veterinary',
    'automotive', 'car_', 'bicycle', 'motorcycle',
    'bank', 'atm', 'financial',
    'delivery', 'post_office', 'shipping', 'logistics',
    'shop', 'store', 'retail', 'mall', 'market',
    'cinema', 'entertainment', 'park',
    'government', 'police',
    'real_estate',
]
category_filter = ' OR '.join(f"categories.primary ILIKE '%{kw}%'" for kw in CATEGORY_KEYWORDS)
RESULT_LIMIT = 500

count_sql = f"""
SELECT count(*) FROM read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*')
WHERE bbox.xmin BETWEEN {lng_min} AND {lng_max}
  AND bbox.ymin BETWEEN {lat_min} AND {lat_max}
  AND confidence >= 0.6
  AND ({category_filter})
"""
(total_matched,) = con.execute(count_sql).fetchone()

sql = f"""
SELECT id, names.primary AS name, categories.primary AS category,
       confidence, bbox.xmin AS lng, bbox.ymin AS lat,
       to_json(addresses) AS addresses_json, to_json(phones) AS phones_json,
       to_json(websites) AS websites_json, to_json(socials) AS socials_json
FROM read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*')
WHERE bbox.xmin BETWEEN {lng_min} AND {lng_max}
  AND bbox.ymin BETWEEN {lat_min} AND {lat_max}
  AND confidence >= 0.6
  AND ({category_filter})
ORDER BY confidence DESC
LIMIT {RESULT_LIMIT}
"""
rows = con.execute(sql).fetchall()
cols = [d[0] for d in con.description]
for row in rows:
    print(json.dumps(dict(zip(cols, row)), default=str))

# Explicit, non-silent cap notice (stderr, so it doesn't pollute the NDJSON
# stdout that geo-hapulico-ingest.mjs parses) — geo-hapulico-ingest.mjs
# forwards stderr in its own warning if this ever fires.
if total_matched > RESULT_LIMIT:
    print(
        f"NOTE: {total_matched} Overture places matched the category/confidence "
        f"filter in this AOI; capped output at {RESULT_LIMIT} (highest confidence "
        f"first) — see geo-overture-query.py RESULT_LIMIT.",
        file=sys.stderr,
    )
