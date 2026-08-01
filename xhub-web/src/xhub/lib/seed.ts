// Canonical seed access layer with mandatory tenant scoping.
// Source of truth: src/data/seed/all.seed.json (from master handoff).
// Rules: never Date.now()/random; every query carries tenantId; MUST_NOT_LEAK guard.
import seed from "@/data/seed/all.seed.json";

type Row = Record<string, unknown>;

const db = seed as unknown as Record<string, Row[] | Record<string, unknown>>;

export interface SeedMeta {
  snapshotAt: string;
  schemaVersion: string;
  locale: string;
  timezone: string;
  currency: string;
  canonicalTenantId: string;
  note?: string;
}

export const SEED_META = db["meta"] as unknown as SeedMeta;
export const CANONICAL_TENANT_ID = SEED_META.canonicalTenantId;

/**
 * Enforces tenant isolation. Rows without a tenantId (e.g. `tenants`) pass through.
 * Throws if any leaked row carries the MUST_NOT_LEAK marker (isolation test hook).
 */
export function assertTenantScope<T extends { tenantId?: string }>(
  rows: T[],
  tenantId: string,
): T[] {
  const scoped = rows.filter(
    (r) => r.tenantId === undefined || r.tenantId === tenantId,
  );
  if (scoped.some((r) => JSON.stringify(r).includes("MUST_NOT_LEAK"))) {
    throw new Error(
      "Tenant isolation violation: MUST_NOT_LEAK marker detected.",
    );
  }
  return scoped;
}

/** Returns a tenant-scoped collection by name. */
export function collection<T = Row>(
  name: string,
  tenantId: string = CANONICAL_TENANT_ID,
): T[] {
  const rows = db[name];
  if (!Array.isArray(rows)) return [];
  return assertTenantScope(rows as unknown as { tenantId?: string }[], tenantId) as unknown as T[];
}

/** Returns a single row by id within tenant scope. */
export function byId<T = Row>(
  name: string,
  id: string,
  tenantId: string = CANONICAL_TENANT_ID,
): T | undefined {
  return collection<T>(name, tenantId).find((r) => (r as { id?: string }).id === id);
}

/** Returns rows matching a field/value predicate within tenant scope. */
export function where<T = Row>(
  name: string,
  field: string,
  value: unknown,
  tenantId: string = CANONICAL_TENANT_ID,
): T[] {
  return collection<T>(name, tenantId).filter(
    (r) => (r as Record<string, unknown>)[field] === value,
  );
}

/** Builds an id -> row index for a collection (tenant scoped). */
export function indexById<T = Row>(
  name: string,
  tenantId: string = CANONICAL_TENANT_ID,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const r of collection<T>(name, tenantId)) {
    const id = (r as { id?: string }).id;
    if (id) map.set(id, r);
  }
  return map;
}
