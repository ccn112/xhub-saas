// Adapter: shared XNavItem tree -> the Tailux MainLayout NavigationTree shape,
// so the existing rail + prime-panel components render the SAME model without
// being modified (handoff: build an XHub adapter layer, don't edit Tailux parts).
//
// i18n (2026-08-06): `item.label` is now a translation KEY (see messages/*.json
// "nav" namespace), not display text — the adapter takes the caller's `t()`
// (from useTranslations('nav')) and resolves it into `title` here.
import type { NavigationTree } from "@/@types/navigation";
import type { XNavItem } from "@/xhub/nav/navigation.model";

type TFunc = (key: string) => string;

function base(item: XNavItem): string {
  return item.match?.[0] ?? item.href;
}

function mapChildren(items: XNavItem[], t: TFunc): NavigationTree[] {
  return items.map((child) => {
    if (child.children && child.children.length > 0) {
      return {
        id: child.id,
        type: "collapse",
        path: base(child),
        title: t(child.label),
        icon: child.icon,
        childs: mapChildren(child.children, t),
      };
    }
    return { id: child.id, type: "item", path: child.href, title: t(child.label), icon: child.icon };
  });
}

/** Level-1 ids tagged `group: "platform"` — rendered as a visually separate,
 * bottom-pinned cluster on the rail (Menu.tsx), distinct from the core tenant
 * workspaces. Pure rail-rendering hint, computed straight off XNavItem so the
 * Tailux-provided NavigationTree type is never touched. */
export function platformGroupIds(items: XNavItem[]): Set<string> {
  return new Set(items.filter((item) => item.group === "platform").map((item) => item.id));
}

/** Convert the shared tree into rail (root) + context (childs) NavigationTree. */
export function toRailTree(items: XNavItem[], t: TFunc): NavigationTree[] {
  return items.map((item) => {
    if (item.placeholder) {
      return {
        id: item.id,
        type: "item",
        path: item.href,
        title: t(item.label),
        icon: item.icon,
      };
    }
    if (item.children && item.children.length > 0) {
      return {
        id: item.id,
        type: "root",
        path: base(item),
        title: t(item.label),
        icon: item.icon,
        childs: mapChildren(item.children, t),
      };
    }
    return {
      id: item.id,
      type: "item",
      path: item.href,
      title: t(item.label),
      icon: item.icon,
    };
  });
}
