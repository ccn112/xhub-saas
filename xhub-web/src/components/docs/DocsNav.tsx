"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const TABS = [
  { href: "/docs", label: "Tổng quan", exact: true },
  { href: "/docs/business", label: "Nghiệp vụ" },
  { href: "/docs/saas", label: "SaaS" },
  { href: "/docs/developer", label: "Phát triển" },
  { href: "/docs/design-system", label: "Hệ thống thiết kế" },
  { href: "/docs/backlog", label: "Backlog" },
  { href: "/docs/user", label: "Hướng dẫn sử dụng" },
  { href: "/docs/test", label: "Kiểm thử" },
];

export function DocsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-soft dark:border-dark-600 dark:bg-dark-700">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={clsx(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary-600 text-white shadow-soft"
                : "text-gray-600 hover:bg-gray-100 dark:text-dark-200 dark:hover:bg-dark-600",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
