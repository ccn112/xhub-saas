/**
 * Request identity resolved by IdentityGuard and attached to `req.identity`.
 * `source` records HOW it was resolved (for debugging / audit), not a trust
 * grant. Precedence: session (JWT cookie) > header (x-user-id/x-tenant-id,
 * kept for E2E + legacy FE) > default (demo persona).
 */
export interface RequestIdentity {
  userId: string;
  tenantId: string;
  roles: string[];
  source: 'session' | 'header' | 'default' | 'anonymous';
}

/** JWT payload signed on login. NO secret/credential — identity + roles only. */
export interface SessionJwtPayload {
  sub: string; // userId
  tenant: string; // tenantId
  roles: string[];
}

export const SESSION_COOKIE = 'xhub_session';

export const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID ?? 'tenant-xtech';
export const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID ?? 'user-nam';

// ---- Auth hardening feature flags (ADDITIVE — all default to the demo-safe
// value so the running demo + every existing smoke stay unchanged) -----------

const envTrue = (v: unknown): boolean => String(v ?? '').toLowerCase() === 'true';

/** Read the boolean-ish header override for a test-driven per-request flag. */
function headerFlag(
  headers: Record<string, unknown> | undefined,
  name: string,
): boolean | undefined {
  const raw = headers?.[name];
  if (raw == null) return undefined;
  const v = String(Array.isArray(raw) ? raw[0] : raw).toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

/**
 * Whether the PermissionGuard actually ENFORCES (throws 403). Default OFF:
 * `AUTH_ENFORCE=true` turns it on globally (production). A request may ALSO opt
 * in via the `x-authz-enforce: true` header — a test-only hook (mirrors
 * controlplane's `__failUntilAttempt`) so `test:authz` can prove enforcement
 * WITHOUT flipping the default runtime. The header can only make a request
 * STRICTER, never looser.
 */
export function isEnforcing(headers?: Record<string, unknown>): boolean {
  if (envTrue(process.env.AUTH_ENFORCE)) return true;
  return headerFlag(headers, 'x-authz-enforce') === true;
}

/**
 * Whether the header identity fallback (`x-user-id`/`x-tenant-id`) is accepted.
 * Default ON (`AUTH_ALLOW_HEADER_IDENTITY` unset/true) so smokes + legacy FE
 * keep working. Production sets it to `false`. A request may force it OFF via
 * `x-authz-allow-header: false` (stricter only — used by test:authz to prove
 * the 401 path without a server restart).
 */
export function allowHeaderIdentity(headers?: Record<string, unknown>): boolean {
  const envAllowed = String(process.env.AUTH_ALLOW_HEADER_IDENTITY ?? 'true').toLowerCase() !== 'false';
  const override = headerFlag(headers, 'x-authz-allow-header');
  if (override === false) return false; // stricter-only override
  return envAllowed;
}

/** OIDC seam toggle. Default OFF. Header `x-authz-oidc: true` enables per-request (test hook). */
export function isOidcEnabled(headers?: Record<string, unknown>): boolean {
  if (envTrue(process.env.AUTH_OIDC_ENABLED)) return true;
  return headerFlag(headers, 'x-authz-oidc') === true;
}

/**
 * STAGING_STRICT scaffold flag. Default OFF (`STAGING_STRICT` unset/false).
 * ADDITIVE + INERT in this step: exposed for later phases where degrade-demo
 * fallbacks (soft no-ops, mock gateways) become hard errors in a strict staging
 * environment. NOT wired into any runtime behavior yet — reading it changes
 * nothing today. See SECURITY.md.
 */
export function isStagingStrict(): boolean {
  return envTrue(process.env.STAGING_STRICT);
}

/** Reflector metadata key for the @RequirePermission() decorator. */
export const REQUIRE_PERMISSION_KEY = 'xhub:require-permission';
