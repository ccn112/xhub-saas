// Adapter: shared XNavItem tree -> the Tailux MainLayout NavigationTree shape,
// so the existing rail + prime-panel components render the SAME model without
// being modified (handoff: build an XHub adapter layer, don't edit Tailux parts).
import type { NavigationTree } from "@/@types/navigation";
import type { XNavItem } from "@/xhub/nav/navigation.model";

function base(item: XNavItem): string {
  return item.match?.[0] ?? item.href;
}

function mapChildren(items: XNavItem[]): NavigationTree[] {
  return items.map((child) => {
    if (child.children && child.children.length > 0) {
      return {
        id: child.id,
        type: "collapse",
        path: base(child),
        title: child.label,
        icon: child.icon,
        childs: mapChildren(child.children),
      };
    }
    return { id: child.id, type: "item", path: child.href, title: child.label, icon: child.icon };
  });
}

/** Convert the shared tree into rail (root) + context (childs) NavigationTree. */
export function toRailTree(items: XNavItem[]): NavigationTree[] {
  return items.map((item) => {
    if (item.placeholder) {
      return {
        id: item.id,
        type: "item",
        path: item.href,
        title: item.label,
        icon: item.icon,
      };
    }
    if (item.children && item.children.length > 0) {
      return {
        id: item.id,
        type: "root",
        path: base(item),
        title: item.label,
        icon: item.icon,
        childs: mapChildren(item.children),
      };
    }
    return {
      id: item.id,
      type: "item",
      path: item.href,
      title: item.label,
      icon: item.icon,
    };
  });
}
