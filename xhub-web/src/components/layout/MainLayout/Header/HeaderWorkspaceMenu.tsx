"use client";

// Horizontal workspace menu shown in the header ONLY when the vertical prime
// panel is collapsed ("Mở menu" state). It surfaces the active workspace's
// children on the header row (next to the toggle) so the collapsed layout still
// exposes the sub-navigation instead of leaving that space empty.
//   - leaf child  → a link
//   - group child → a dropdown listing its own children
import Link from "next/link";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

import { useSidebarContext } from "@/contexts/sidebar/context";
import { useNavigation } from "@/xhub/nav/NavigationProvider";
import { findActivePrimary, isBranchActive, isItemActive } from "@/xhub/nav/resolver";
import { navigationIcons } from "@/navigation/icons";
import type { XNavItem } from "@/xhub/nav/navigation.model";

function NavIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = name ? navigationIcons[name] : undefined;
  return Icon ? <Icon className={className} /> : null;
}

const linkBase =
  "inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-hidden";
const idle =
  "text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-dark-200 dark:hover:bg-dark-600";
const active = "bg-primary-600/10 text-primary-600 dark:text-primary-400";

function TopLink({ item, pathname }: { item: XNavItem; pathname: string }) {
  const on = isItemActive(item, pathname);
  const t = useTranslations("nav");
  return (
    <Link
      href={item.href}
      aria-current={on ? "page" : undefined}
      className={clsx(linkBase, on ? active : idle)}
    >
      <NavIcon name={item.icon} className="size-4 shrink-0" />
      {t(item.label)}
    </Link>
  );
}

function GroupDropdown({ item, pathname }: { item: XNavItem; pathname: string }) {
  const on = isBranchActive(item, pathname);
  const children = item.children ?? [];
  const t = useTranslations("nav");
  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton className={clsx(linkBase, on ? active : idle)}>
        <NavIcon name={item.icon} className="size-4 shrink-0" />
        {t(item.label)}
        <ChevronDownIcon className="size-4 opacity-60" />
      </MenuButton>
      <MenuItems
        anchor="bottom start"
        className="z-50 mt-1 w-60 rounded-xl border border-gray-150 bg-white p-1.5 shadow-soft outline-hidden dark:border-dark-600 dark:bg-dark-700"
      >
        {children.map((child) => {
          // Flatten one nesting level: a grandchild group shows its own leaves.
          const leaves = child.children?.length ? child.children : [child];
          return leaves.map((leaf) => {
            const lon = isItemActive(leaf, pathname);
            return (
              <MenuItem key={leaf.id}>
                <Link
                  href={leaf.href}
                  className={clsx(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors data-[focus]:bg-gray-100 dark:data-[focus]:bg-dark-600",
                    lon
                      ? "font-medium text-primary-600 dark:text-primary-400"
                      : "text-gray-700 dark:text-dark-100",
                  )}
                >
                  <NavIcon name={leaf.icon} className="size-4 shrink-0 text-gray-400 dark:text-dark-300" />
                  {t(leaf.label)}
                </Link>
              </MenuItem>
            );
          });
        })}
      </MenuItems>
    </Menu>
  );
}

export function HeaderWorkspaceMenu() {
  const { isExpanded } = useSidebarContext();
  const pathname = usePathname() ?? "";
  const { tree } = useNavigation();
  const t = useTranslations("nav");

  // Only when the vertical panel is collapsed; the panel already shows these
  // items when expanded.
  if (isExpanded) return null;

  const ws = findActivePrimary(tree, pathname);
  const children = ws?.children ?? [];
  if (children.length === 0) return null;

  return (
    <nav
      aria-label={`Menu ${ws ? t(ws.label) : "workspace"}`}
      className="ml-1 hidden min-w-0 items-center gap-0.5 overflow-x-auto md:flex"
    >
      {children.map((item) =>
        item.children?.length ? (
          <GroupDropdown key={item.id} item={item} pathname={pathname} />
        ) : (
          <TopLink key={item.id} item={item} pathname={pathname} />
        ),
      )}
    </nav>
  );
}
