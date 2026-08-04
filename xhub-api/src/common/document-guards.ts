import { createHash } from 'node:crypto';

/**
 * Generic secret-field/content-integrity guards — used by both the backup
 * module (tenant backup export/restore) and the records/catalog modules
 * (document + seed-pack content). No backup-specific logic here; moved out of
 * `src/backup/backup.tables.ts` so XOFFICE_BUSINESS modules (records) don't
 * need a cross-boundary import into XHUB_PLATFORM (backup) for a pure utility
 * — see docs/implementation/xoffice-ai/IMPLEMENTATION_PLAN.md Phase 1.5 Stage B.
 */

/** MUST_NOT_LEAK: any serialized FIELD NAME matching this is a hard failure. */
export const SECRET_FIELD_REGEX = /password|secret|token|apikey|api[_-]?key|credential|privatekey|private[_-]?key/i;

/**
 * Recursively scan every object KEY of `value`; throw if any matches the secret
 * regex. Returns the number of keys scanned (recorded in the manifest as proof).
 */
export function assertNoSecretFields(value: unknown, path = ''): number {
  let scanned = 0;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) scanned += assertNoSecretFields(value[i], `${path}[${i}]`);
    return scanned;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      scanned++;
      if (SECRET_FIELD_REGEX.test(k)) {
        throw new Error(`MUST_NOT_LEAK: secret-like field "${path ? path + '.' : ''}${k}" is forbidden in a tenant backup`);
      }
      scanned += assertNoSecretFields(v, `${path ? path + '.' : ''}${k}`);
    }
  }
  return scanned;
}

/** Stable JSON: object keys sorted recursively → deterministic serialization. */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortDeep((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

/** sha256 hex over the canonicalized value (the backup content checksum). */
export function contentChecksum(value: unknown): string {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}
