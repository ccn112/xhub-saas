// Single permission/entitlement filter for the navigation tree.
// Demo: the actor is granted every permission, but items still pass through one
// filter so tenant entitlements and future ACLs have exactly one enforcement point.
import type { XNavItem } from "./navigation.model";

export interface NavigationPermissionContext {
  /** Permissions granted to the actor. `"*"` grants everything (demo default). */
  permissions: Set<string> | "*";
  /** Tenant entitlements. `"*"` grants everything (demo default). */
  entitlements: Set<string> | "*";
}

export const DEMO_PERMISSION_CONTEXT: NavigationPermissionContext = {
  permissions: "*",
  entitlements: "*",
};

function granted(value: string | undefined, set: Set<string> | "*"): boolean {
  if (!value) return true;
  if (set === "*") return true;
  return set.has(value);
}

/** Recursively keep only items the actor may see. Hidden items never reach the DOM. */
export function filterNavigation(
  items: XNavItem[],
  ctx: NavigationPermissionContext = DEMO_PERMISSION_CONTEXT,
): XNavItem[] {
  const out: XNavItem[] = [];
  for (const item of items) {
    if (!granted(item.permission, ctx.permissions)) continue;
    if (!granted(item.entitlement, ctx.entitlements)) continue;
    const children = item.children ? filterNavigation(item.children, ctx) : undefined;
    out.push(children ? { ...item, children } : item);
  }
  return out;
}
