"use client";

// Import Dependencies
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Local Imports
import { useBreakpointsContext } from "@/contexts/breakpoint/context";
import { useSidebarContext } from "@/contexts/sidebar/context";
import { isRouteActive } from "@/utils/isRouteActive";
import { NavigationTree } from "@/@types/navigation";

// ----------------------------------------------------------------------

export function MenuItem({ data }: { data: NavigationTree }) {
  const { path, title } = data;
  const pathname = usePathname() ?? "";
  const { lgAndDown } = useBreakpointsContext();
  const { close } = useSidebarContext();

  const isActive = isRouteActive(path, pathname);

  const handleMenuItemClick = () => {
    if (lgAndDown) close();
  };

  return (
    <Link
      href={path as string}
      onClick={handleMenuItemClick}
      className={clsx(
        "text-xs-plus flex items-center justify-between px-2 tracking-wide outline-hidden transition-[color,padding-left,padding-right] duration-300 ease-in-out hover:ltr:pl-4 hover:rtl:pr-4",
        isActive
          ? "text-primary-600 dark:text-primary-400 font-medium"
          : "dark:text-dark-200 dark:hover:text-dark-50 text-gray-600 hover:text-gray-900",
      )}
    >
      <div
        data-menu-active={isActive}
        className="flex min-w-0 items-center justify-between"
        style={{ height: "34px" }}
      >
        <div className="flex min-w-0 items-center space-x-2 rtl:space-x-reverse">
          <div
            className={clsx(
              isActive
                ? "bg-primary-600 dark:bg-primary-400 opacity-80"
                : "opacity-50 transition-all",
              "size-1.5 rounded-full border border-current",
            )}
          ></div>
          <span className="truncate">{title}</span>
        </div>
      </div>
    </Link>
  );
}
