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

/**
 * Secret-shaped VALUE patterns (not field names — see SECRET_FIELD_REGEX
 * above) found in free text. Subset of scripts/secret-scan.mjs's PATTERNS,
 * reused here so EngineeringDocument bodies (DG-03) get the same guard
 * applied to source files, instead of a second ad hoc rule set.
 */
const SECRET_VALUE_PATTERNS = [
  { name: 'anthropic-key', re: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: 'openai-key', re: /sk-[A-Za-z0-9]{32,}/g },
  { name: 'aws-access-key', re: /AKIA[0-9A-Z]{16}/g },
  { name: 'private-key-block', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
  { name: 'google-api-key', re: /AIza[0-9A-Za-z_-]{35}/g },
];

/**
 * MUST_NOT_LEAK for free-text document bodies (DG-03 EngineeringDocument):
 * throws if the text contains anything shaped like a real secret VALUE.
 * Complements assertNoSecretFields (which only checks structured object
 * KEYS) — a markdown doc has no keys, only prose, so it needs its own check.
 */
export function assertNoSecretValues(text: string): void {
  for (const { name, re } of SECRET_VALUE_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text)) {
      throw new Error(`MUST_NOT_LEAK: content matches a ${name} secret pattern — remove it before saving`);
    }
  }
}
