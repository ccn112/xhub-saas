// Shared text/geo helpers for the geo-hapulico-* scripts. Kept tiny and
// dependency-free (no npm geo/slug packages — see
// docs/geo-migration/XHUB_GEO_READINESS_AUDIT.md §9, no geospatial libs were
// present in package.json and this pilot doesn't need more than this).

// Vietnamese-aware normalize: strip diacritics (NFD) + fold "đ/Đ" (not covered
// by NFD alone), lowercase, collapse whitespace. Used for both fuzzy name
// matching (dedupe) and GlobalProject/Place.normalizedName.
export function normalizeVi(s) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(s) {
  return normalizeVi(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Great-circle distance in meters (haversine). Good enough at 3km scale —
// no need for a full geodesic library.
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Loose token-overlap name similarity in [0,1] — NOT a real string-edit-
// distance library, just enough signal for the dedupe review queue (doc
// §7.5: distance + normalized_name + phone + domain scoring; this covers the
// normalized_name term only, weighted by the caller).
export function nameSimilarity(a, b) {
  const ta = new Set(normalizeVi(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeVi(b).split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  return overlap / Math.max(ta.size, tb.size);
}

// Zone bucketing per doc §9.2 (radius <= 3000m default AOI).
export function zoneForDistance(distanceM) {
  if (distanceM <= 0) return 'inside';
  if (distanceM <= 300) return 'gate';
  if (distanceM <= 800) return 'walkable';
  if (distanceM <= 2000) return 'nearby';
  return 'extended';
}
