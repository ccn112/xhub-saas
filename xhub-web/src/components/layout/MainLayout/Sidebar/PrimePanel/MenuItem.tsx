"use client";

// Import Dependencies
import Link from "next/link";
import clsx from "clsx";

// Local Imports
import { useBreakpointsContext } from "@/contexts/breakpoint/context";
import { useSidebarContext } from "@/contexts/sidebar/context";
import { isRouteActive } from "@/utils/isRouteActive";
import { NavigationTree } from "@/@types/navigation";
import { navigationIcons } from "@/navigation/icons";

// ----------------------------------------------------------------------

export function MenuItem({
  data,
  pathname,
}: {
  data: NavigationTree;
  pathname: string;
}) {
  const { path, title, icon } = data;
  const { lgAndDown } = useBreakpointsContext();
  const { close } = useSidebarContext();

  const isActive = isRouteActive(path, pathname);
  const Icon = icon ? navigationIcons[icon] : undefined;

  const handleMenuItemClick = () => {
    if (lgAndDown) close();
  };

  return (
    <Link
      href={path as string}
      onClick={handleMenuItemClick}
      className={clsx(
        "outline-hidden transition-colors duration-300 ease-in-out",
        isActive
          ? "text-primary-600 dark:text-primary-400 font-medium"
          : "dark:text-dark-200 dark:hover:text-dark-50 text-gray-600 hover:text-gray-900",
      )}
    >
      <div
        data-menu-active={isActive}
        style={{ height: "40px" }}
        className="flex items-center gap-2.5 text-sm tracking-wide"
      >
        {Icon ? (
          <Icon className={clsx("size-4.5 shrink-0", isActive ? "text-primary-600 dark:text-primary-400" : "text-gray-400 dark:text-dark-300")} />
        ) : (
          <span className="ml-1 size-1.5 shrink-0 rounded-full bg-current opacity-40" />
        )}
        <span className="truncate">{title}</span>
      </div>
    </Link>
  );
}
