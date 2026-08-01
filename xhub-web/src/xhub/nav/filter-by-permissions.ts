// Wildcard-aware navigation permission filter (PH-01 seam).
//
// ADDITIVE + DEFAULT NO-OP: with `enforce: false` (the default) the tree is
// returned UNCHANGED — the live NavigationProvider is NOT wired to this yet, so
// today's demo (actor granted everything) is untouched. When PH-01 fetches the
// actor's effective permissions it flips `enforce: true`, and items whose
// `permission` gate is not granted are hidden (children recursively too).
//
// Matching mirrors the backend `permissionMatches()`
// (xhub-api/src/identity/permission-match.ts): `"*"` grants everything, an
// exact match grants, and a granted pattern like `"tenant.*"` grants
// `"tenant.user.invite"` (and the bare `"tenant"`) on a dot boundary.
import type { XNavItem } from "./navigation.model";

export function permissionMatches(granted: readonly string[], requested: string): boolean {
  if (!requested) return true; // ungated item — always visible
  for (const g of granted) {
    if (g === "*") return true;
    if (g === requested) return true;
    if (g.endsWith(".*")) {
      const prefix = g.slice(0, -2);
      if (requested === prefix || requested.startsWith(prefix + ".")) return true;
    }
  }
  return false;
}

export interface FilterNavOptions {
  /** When false (default) the tree is returned unchanged — pure no-op. */
  enforce?: boolean;
}

/**
 * Pure recursive filter. `grantedPermissions` is the actor's effective grants
 * (may contain wildcards like `"tenant.*"` or `"*"`). Items without a
 * `permission` field are always kept.
 */
export function filterNavByPermissions(
  tree: XNavItem[],
  grantedPermissions: readonly string[],
  { enforce = false }: FilterNavOptions = {},
): XNavItem[] {
  if (!enforce) return tree; // DEFAULT NO-OP
  const out: XNavItem[] = [];
  for (const item of tree) {
    // Own gate: if the item itself declares a permission the actor lacks, hide
    // it (and its whole subtree).
    if (item.permission && !permissionMatches(grantedPermissions, item.permission)) continue;
    if (item.children) {
      const children = filterNavByPermissions(item.children, grantedPermissions, { enforce });
      // Prune an ungated GROUP whose children were all filtered away — a header
      // like "Quản trị" must not linger empty. Group-visibility therefore =
      // "actor can see at least one child". A group that carries its OWN
      // permission already passed its gate above, so it is kept even if empty.
      if (children.length === 0 && item.children.length > 0 && !item.permission) continue;
      out.push({ ...item, children });
    } else {
      out.push(item);
    }
  }
  return out;
}
