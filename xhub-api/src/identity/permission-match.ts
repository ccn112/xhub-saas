/**
 * Wildcard-aware permission matching (SHARED by can()/effectivePermissions and
 * the role-registry smoke). Pure + dependency-free so it compiles to dist and
 * can be imported by both Nest code and the .mjs smoke.
 *
 * Rules:
 *  - `"*"` (a granted super-wildcard) matches every requested permission.
 *  - exact string match (`"identity.read"` grants `"identity.read"`).
 *  - a granted pattern ending in `".*"` matches the segment-prefix before it:
 *    `"tenant.*"` grants `"tenant.user.invite"` and the bare `"tenant"`, but
 *    NOT an unrelated `"tenants.x"` (prefix boundary is a dot).
 */
export function permissionMatches(granted: string[], requested: string): boolean {
  if (!Array.isArray(granted) || !requested) return false;
  for (const g of granted) {
    if (g === '*') return true;
    if (g === requested) return true;
    if (g.endsWith('.*')) {
      const prefix = g.slice(0, -2); // strip ".*"
      if (requested === prefix || requested.startsWith(prefix + '.')) return true;
    }
  }
  return false;
}
