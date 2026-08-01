import { createHash } from 'node:crypto';

/**
 * Normalization + rule-based matching helpers for the MDM ingestion pipeline.
 *
 * Deterministic, side-effect free. Used by MdmService to turn an immutable raw
 * source payload into canonical staging fields (PROJECT_CANONICAL_FIELDS) and to
 * derive the rule-based canonical match key. NO fuzzy auto-merge happens here —
 * scoring only PROPOSES duplicates for human review.
 */

/** Stable hash of a raw payload for lineage. */
export function hashRaw(raw: unknown): string {
  return createHash('sha256').update(JSON.stringify(raw)).digest('hex');
}

/** Fold Vietnamese diacritics + lowercase + collapse whitespace → slug token. */
export function slug(input?: string | null): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

export interface CanonicalProject {
  canonicalName: string;
  aliases: string[];
  developerName?: string | null;
  projectTypeCode?: string | null;
  countryCode: string;
  provinceCode?: string | null;
  districtCode?: string | null;
  addressText?: string | null;
  visibility: string;
  sourceConfidence: number;
}

/**
 * Map a raw X2BMS project row → canonical staging fields
 * (per data/PROJECT_CANONICAL_FIELDS.csv). Purely deterministic.
 */
export function normalizeProject(raw: Record<string, any>): CanonicalProject {
  const canonicalName = String(raw.normalizedName ?? raw.rawName ?? '').trim();
  const aliases = [raw.rawName, raw.normalizedName]
    .map((s) => (s == null ? '' : String(s).trim()))
    .filter((s) => s && s !== canonicalName);
  const visRaw = String(raw.visibility ?? 'SHARED_WITH_VISIBILITY');
  // Legacy source value SHARED_WITH_VISIBILITY maps straight through.
  const visibility = ['GLOBAL', 'SHARED_WITH_VISIBILITY', 'TENANT_PRIVATE', 'RESTRICTED'].includes(visRaw)
    ? visRaw
    : 'SHARED_WITH_VISIBILITY';
  const score = Number(raw.qualityScore ?? 0);
  return {
    canonicalName,
    aliases: [...new Set(aliases)],
    developerName: raw.developerName ?? null,
    projectTypeCode: raw.projectType ?? null,
    countryCode: raw.countryCode ?? 'VN',
    provinceCode: raw.province ?? null,
    districtCode: raw.district ?? null,
    addressText: raw.address ?? null,
    visibility,
    sourceConfidence: Number.isFinite(score) ? score : 0,
  };
}

/**
 * Rule-based canonical match key for a project: slug(canonicalName) + geography.
 * Two records with the same key are the SAME canonical entity by rule (exact
 * match). Deliberately conservative — geography must also agree.
 */
export function canonicalKeyForProject(c: CanonicalProject): string {
  return [slug(c.canonicalName), slug(c.provinceCode), slug(c.districtCode)].join('|');
}

/**
 * Similarity score (0..1) between two source rows already known to share (or
 * nearly share) a canonical key. Rule-based, explainable — NOT an ML model.
 * An explicit source-side `duplicateCandidateOf` hint raises confidence.
 */
export function duplicateScore(
  a: { canonical: CanonicalProject; hint?: boolean },
  b: { canonical: CanonicalProject },
): number {
  let score = 0;
  if (slug(a.canonical.canonicalName) === slug(b.canonical.canonicalName)) score += 0.6;
  if (slug(a.canonical.provinceCode) === slug(b.canonical.provinceCode)) score += 0.15;
  if (slug(a.canonical.districtCode) === slug(b.canonical.districtCode)) score += 0.15;
  if (a.hint) score += 0.1;
  return Math.min(1, Number(score.toFixed(2)));
}
