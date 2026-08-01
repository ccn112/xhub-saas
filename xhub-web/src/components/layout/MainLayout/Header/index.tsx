"use client";

// Import Dependencies
import { useState } from "react";
import clsx from "clsx";
import { MagnifyingGlassIcon, Bars3Icon } from "@heroicons/react/24/outline";

// Local Imports
import { useThemeContext } from "@/contexts/theme/context";
import { Button } from "@/components/ui";
import { SidebarToggleBtn } from "../SidebarToggleBtn";
import { HeaderWorkspaceMenu } from "./HeaderWorkspaceMenu";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { Profile } from "../Profile";
import { NotificationBell } from "./NotificationBell";

// ----------------------------------------------------------------------

function SlashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="20"
      aria-hidden="true"
      {...props}
    >
      <path
        fill="none"
        stroke="currentColor"
        d="M3.5.5h12c1.7 0 3 1.3 3 3v13c0 1.7-1.3 3-3 3h-12c-1.7 0-3-1.3-3-3v-13c0-1.7 1.3-3 3-3z"
        opacity="0.4"
      />
      <path fill="currentColor" d="M11.8 6L8 15.1h-.9L10.8 6h1z" />
    </svg>
  );
}

export function Header() {
  const { cardSkin } = useThemeContext();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header
      className={clsx(
        "app-header transition-content sticky top-0 z-20 flex h-[65px] shrink-0 items-center justify-between border-b border-gray-200 bg-white/80 px-(--margin-x) backdrop-blur-sm backdrop-saturate-150 dark:border-dark-600",
        cardSkin === "shadow" ? "dark:bg-dark-750/80" : "dark:bg-dark-900/80",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {/* Mobile: hamburger opens the full nav drawer; logo stays for brand. */}
        <button
          type="button"
          aria-label="Mở menu"
          onClick={() => setMobileNavOpen(true)}
          className="flex size-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 md:hidden dark:text-dark-200 dark:hover:bg-dark-600"
        >
          <Bars3Icon className="size-6" />
        </button>
        <span className="flex items-center gap-2 md:hidden">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary-600 font-heading text-sm font-bold text-white">
            X
          </span>
          <span className="font-heading text-sm font-semibold text-gray-800 dark:text-dark-50">
            XHub
          </span>
        </span>
        <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        {/* Sidebar/context drawer toggle — only meaningful when a sidebar renders (md+). */}
        <span className="hidden md:inline-flex">
          <SidebarToggleBtn />
        </span>
        {/* When the vertical panel is collapsed, surface the active workspace's
            menu horizontally here (fills the otherwise-empty header row). */}
        <HeaderWorkspaceMenu />
      </div>
      <div className="flex items-center gap-2">
        {/* Full search pill from md up. */}
        <Button
          unstyled
          className="text-xs-plus dark:border-dark-500 dark:hover:border-dark-400 h-8 w-64 justify-between gap-2 rounded-full border border-gray-200 px-3 hover:border-gray-400 max-md:hidden"
        >
          <div className="flex items-center gap-2">
            <MagnifyingGlassIcon className="size-4" />
            <span className="dark:text-dark-300 text-gray-400">
              Tìm kiếm...
            </span>
          </div>
          <SlashIcon />
        </Button>
        {/* Compact search icon on mobile. */}
        <Button
          unstyled
          aria-label="Tìm kiếm"
          className="flex size-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 md:hidden dark:text-dark-200 dark:hover:bg-dark-600"
        >
          <MagnifyingGlassIcon className="size-5" />
        </Button>
        <NotificationBell />
        <Profile />
      </div>
    </header>
  );
}
