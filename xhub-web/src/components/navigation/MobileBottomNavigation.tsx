"use client";

// Mobile (<768px): bottom navigation with up to 5 primary items + "Thêm".
// Desktop sidebars are NOT rendered on mobile.
import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import { EllipsisHorizontalIcon, XMarkIcon } from "@heroicons/react/24/outline";

import { navigationIcons } from "@/navigation/icons";
import { useNavigation } from "@/xhub/nav/NavigationProvider";
import { badgeValue } from "@/xhub/nav/badges";
import { isBranchActive } from "@/xhub/nav/resolver";
import type { XNavItem } from "@/xhub/nav/navigation.model";

// Preferred primary items for the bottom bar (max 5). The rest go under "Thêm".
// Falls back gracefully if some ids are missing (permission-filtered tree).
const PRIMARY_IDS = ["home", "work", "space", "office", "business"];
const MAX_MAIN = 5;

function pickPrimary(tree: XNavItem[]): { main: XNavItem[]; more: XNavItem[] } {
  const byId = new Map(tree.map((i) => [i.id, i]));
  const main: XNavItem[] = [];
  for (const id of PRIMARY_IDS) {
    const item = byId.get(id);
    if (item && main.length < MAX_MAIN) main.push(item);
  }
  // Backfill from tree order if fewer than expected primaries are present.
  if (main.length < Math.min(MAX_MAIN, tree.length)) {
    for (const item of tree) {
      if (main.length >= MAX_MAIN) break;
      if (!main.includes(item)) main.push(item);
    }
  }
  const mainIds = new Set(main.map((i) => i.id));
  const more = tree.filter((i) => !mainIds.has(i.id));
  return { main, more };
}

function TabLink({
  item,
  active,
  count,
  onClick,
}: {
  item: XNavItem;
  active: boolean;
  count: number;
  onClick?: () => void;
}) {
  const Icon = item.icon ? navigationIcons[item.icon] : undefined;
  return (
    <Link
      href={item.placeholder ? "#" : item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-tiny outline-hidden",
        active
          ? "text-primary-600 dark:text-primary-400"
          : "text-gray-500 dark:text-dark-200",
      )}
    >
      {Icon && <Icon className="size-6" />}
      <span className="max-w-full truncate px-1">{item.label}</span>
      {count > 0 && (
        <span className="absolute top-1 right-1/2 translate-x-4 rounded-full bg-primary-600 px-1 text-[10px] font-semibold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

export function MobileBottomNavigation() {
  const pathname = usePathname() ?? "";
  const { tree, badges } = useNavigation();
  const [moreOpen, setMoreOpen] = useState(false);

  const { main, more } = pickPrimary(tree);
  const moreActive = more.some((i) => isBranchActive(i, pathname));

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-[70] bg-gray-900/40 md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-14 rounded-t-2xl bg-white p-4 dark:bg-dark-750"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-gray-800 dark:text-dark-50">
                Thêm
              </span>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setMoreOpen(false)}
                className="flex size-8 items-center justify-center rounded-full text-gray-500 dark:text-dark-200"
              >
                <XMarkIcon className="size-5" />
              </button>
            </div>
            <ul className="grid grid-cols-3 gap-2">
              {more.map((item) => {
                const Icon = item.icon ? navigationIcons[item.icon] : undefined;
                const active = isBranchActive(item, pathname);
                return (
                  <li key={item.id}>
                    <Link
                      href={item.placeholder ? "#" : item.href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "flex flex-col items-center gap-1 rounded-lg p-3 text-xs-plus",
                        active
                          ? "bg-primary-600/10 text-primary-600 dark:text-primary-400"
                          : "text-gray-600 dark:text-dark-200",
                      )}
                    >
                      {Icon && <Icon className="size-6" />}
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
      <nav
        aria-label="Điều hướng chính"
        className="xhub-mobile-nav border-gray-150 bg-white dark:border-dark-600 dark:bg-dark-900"
      >
        {main.map((item) => (
          <TabLink
            key={item.id}
            item={item}
            active={isBranchActive(item, pathname)}
            count={badgeValue(badges, item.badgeKey)}
          />
        ))}
        {more.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Thêm"
            className={clsx(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-tiny outline-hidden",
              moreActive
                ? "text-primary-600 dark:text-primary-400"
                : "text-gray-500 dark:text-dark-200",
            )}
          >
            <EllipsisHorizontalIcon className="size-6" />
            <span>Thêm</span>
          </button>
        )}
      </nav>
    </>
  );
}
