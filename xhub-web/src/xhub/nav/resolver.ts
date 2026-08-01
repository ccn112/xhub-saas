// Single route-derived active-state resolver, shared by every renderer.
// No renderer computes "active" on its own — they all call these helpers.
import { isRouteActive } from "@/utils/isRouteActive";
import type { XNavItem } from "./navigation.model";

/** Base paths used for matching (defaults to the item's own href). */
function matchPaths(item: XNavItem): string[] {
  if (item.match) return item.match;
  if (item.href && item.href !== "#") return [item.href];
  return [];
}

/** True when the current pathname is (or is under) any of the item's match paths. */
export function isItemActive(item: XNavItem, pathname: string): boolean {
  return matchPaths(item).some((p) => isRouteActive(p, pathname));
}

/** True when the item OR any descendant is active. */
export function isBranchActive(item: XNavItem, pathname: string): boolean {
  if (isItemActive(item, pathname)) return true;
  return (item.children ?? []).some((c) => isBranchActive(c, pathname));
}

/** The active level-1 item (or its id) for the given route. */
export function findActivePrimary(
  items: XNavItem[],
  pathname: string,
): XNavItem | undefined {
  return (
    items.find((i) => isItemActive(i, pathname)) ??
    items.find((i) => isBranchActive(i, pathname))
  );
}

/** Exact-leaf active state (used for menu links). */
export function isLeafActive(item: XNavItem, pathname: string): boolean {
  if (!item.href || item.href === "#") return false;
  return isRouteActive(item.href, pathname);
}
