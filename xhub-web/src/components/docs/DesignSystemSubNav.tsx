"use client";

// Local sub-nav for the "Hệ thống thiết kế" area — makes /docs/design-system
// and /docs/design-system/patterns read as one submenu group (tổng quan token
// gallery vs. live pattern simulation), matching the same tab idiom as DocsNav.
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const TABS = [
  { href: "/docs/design-system", label: "Tổng quan (font · màu · component)", exact: true },
  { href: "/docs/design-system/patterns", label: "Mẫu trang demo (6 dạng)" },
];

export function DesignSystemSubNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-4 flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1 dark:bg-dark-800">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={clsx(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
              active
                ? "bg-white text-primary-700 shadow-soft dark:bg-dark-700 dark:text-primary-300"
                : "text-gray-500 hover:text-gray-700 dark:text-dark-300 dark:hover:text-dark-100",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
