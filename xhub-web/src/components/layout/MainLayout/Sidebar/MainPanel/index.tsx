"use client";

// Import Dependencies
import Link from "next/link";
import clsx from "clsx";
import { SetStateAction, Dispatch } from "react";

// Local Imports
import { Menu } from "./Menu";
import { useThemeContext } from "@/contexts/theme/context";
import { NavigationTree } from "@/@types/navigation";
import { SegmentPath } from "../index";

// ----------------------------------------------------------------------

interface MainPanelProps {
  nav: NavigationTree[];
  /** ids rendered as a separate, bottom-pinned cluster (see Menu.tsx). */
  platformIds?: Set<string>;
  setActiveSegmentPath?: Dispatch<SetStateAction<SegmentPath>>;
  activeSegmentPath: SegmentPath;
}

export function MainPanel({
  nav,
  platformIds,
  setActiveSegmentPath,
  activeSegmentPath,
}: MainPanelProps) {
  const { cardSkin } = useThemeContext();

  return (
    <div className="main-panel">
      <div
        className={clsx(
          "border-gray-150 dark:border-dark-600/80 flex h-full w-full flex-col items-center bg-white ltr:border-r rtl:border-l",
          cardSkin === "shadow" ? "dark:bg-dark-750" : "dark:bg-dark-900",
        )}
      >
        {/* Application Logo */}
        <div className="flex pt-3.5">
          <Link
            href="/home/executive"
            className="flex size-10 items-center justify-center rounded-lg bg-primary-600 font-heading text-lg font-bold text-white"
          >
            X
          </Link>
        </div>

        <Menu
          nav={nav}
          platformIds={platformIds}
          activeSegmentPath={activeSegmentPath}
          setActiveSegmentPath={setActiveSegmentPath}
        />
      </div>
    </div>
  );
}
