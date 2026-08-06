"use client";

// Expanded sidebar (~280px): logo + product name, level-1 items with icon,
// collapsible groups, nested children indented 16px. Consumes the SHARED tree,
// SHARED active resolver and SHARED badge resolver.
import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRightIcon } from "@heroicons/react/20/solid";

import { navigationIcons } from "@/navigation/icons";
import { Collapse } from "@/components/ui";
import { useNavigation } from "@/xhub/nav/NavigationProvider";
import { badgeValue } from "@/xhub/nav/badges";
import { isBranchActive, isLeafActive } from "@/xhub/nav/resolver";
import type { XNavItem } from "@/xhub/nav/navigation.model";

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-tiny font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function ExpandedItem({
  item,
  pathname,
  badges,
  depth,
}: {
  item: XNavItem;
  pathname: string;
  badges: Record<string, number>;
  depth: number;
}) {
  const t = useTranslations("nav");
  const hasChildren = Boolean(item.children && item.children.length > 0);
  const branchActive = isBranchActive(item, pathname);
  const leafActive = isLeafActive(item, pathname);
  const [open, setOpen] = useState(branchActive);

  const Icon = item.icon ? navigationIcons[item.icon] : undefined;
  const count = badgeValue(badges, item.badgeKey);
  const indent = depth === 0 ? 0 : 16;

  // Placeholder (e.g. X.AI) — visible but not a live link.
  if (item.placeholder) {
    return (
      <li>
        <div
          aria-disabled="true"
          className="flex h-11 cursor-default items-center gap-3 rounded-lg px-3 text-gray-400 dark:text-dark-300"
        >
          {Icon && <Icon className="size-5 shrink-0" />}
          <span className="truncate">{t(item.label)}</span>
          <span className="ml-auto text-tiny text-gray-400 dark:text-dark-300">
            sắp có
          </span>
        </div>
      </li>
    );
  }

  const rowClass = clsx(
    "flex flex-1 items-center gap-3 rounded-lg px-3 outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-primary-600/60",
    depth === 0 ? "h-11" : "h-9 text-xs-plus",
    leafActive
      ? "bg-primary-600/10 font-medium text-primary-600 dark:bg-primary-400/15 dark:text-primary-400"
      : branchActive && depth === 0
        ? "font-medium text-primary-600 dark:text-primary-400"
        : "text-gray-600 hover:bg-gray-100 dark:text-dark-200 dark:hover:bg-dark-600/60",
  );

  return (
    <li>
      <div
        className="flex items-center gap-1"
        style={indent ? { paddingInlineStart: indent } : undefined}
      >
        <Link
          href={item.href}
          aria-current={leafActive ? "page" : undefined}
          className={rowClass}
        >
          {Icon && <Icon className="size-5 shrink-0" />}
          <span className="truncate">{t(item.label)}</span>
          <Badge count={count} />
        </Link>
        {hasChildren && (
          <button
            type="button"
            aria-label={open ? "Thu gọn" : "Mở rộng"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 outline-hidden transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-primary-600/60 dark:text-dark-300 dark:hover:bg-dark-600/60"
          >
            <ChevronRightIcon
              className={clsx("size-4 transition-transform", open && "rotate-90")}
            />
          </button>
        )}
      </div>
      {hasChildren && (
        <Collapse in={open}>
          <ul className="mt-0.5 space-y-0.5">
            {item.children!.map((child) => (
              <ExpandedItem
                key={child.id}
                item={child}
                pathname={pathname}
                badges={badges}
                depth={depth + 1}
              />
            ))}
          </ul>
        </Collapse>
      )}
    </li>
  );
}

export function ExpandedSidebarNavigation() {
  const pathname = usePathname() ?? "";
  const { tree, badges } = useNavigation();
  const items = useMemo(() => tree, [tree]);

  return (
    <nav
      aria-label="Điều hướng chính"
      className="xhub-expanded-sidebar border-gray-150 bg-white dark:border-dark-600/80 dark:bg-dark-900"
    >
      {/* Logo + product name */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary-600 font-heading text-base font-bold text-white">
          X
        </span>
        <span className="font-heading text-base font-semibold text-gray-800 dark:text-dark-50">
          XHub · X.Space
        </span>
      </div>
      <ul className="hide-scrollbar flex-1 space-y-1 overflow-y-auto px-3 pb-6">
        {items.map((item) => (
          <ExpandedItem
            key={item.id}
            item={item}
            pathname={pathname}
            badges={badges}
            depth={0}
          />
        ))}
      </ul>
    </nav>
  );
}
