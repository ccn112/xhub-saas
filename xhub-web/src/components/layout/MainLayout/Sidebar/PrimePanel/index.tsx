"use client";

// Import Dependencies
import clsx from "clsx";
import { ChevronLeftIcon } from "@heroicons/react/20/solid";

// Local Imports
import { useThemeContext } from "@/contexts/theme/context";
import { Button } from "@/components/ui";
import { Menu } from "./Menu";
import { NavigationTree } from "@/@types/navigation";

// ----------------------------------------------------------------------

export interface PrimePanelProps {
  currentSegment?: NavigationTree;
  pathname: string;
  close: () => void;
}

export function PrimePanel({ currentSegment, pathname, close }: PrimePanelProps) {
  const { cardSkin } = useThemeContext();

  const title = currentSegment?.title;

  return (
    <div
      className={clsx(
        "prime-panel flex h-full flex-col",
        cardSkin === "shadow"
          ? "shadow-soft dark:shadow-dark-900/60"
          : "dark:border-dark-600/80 ltr:border-r rtl:border-l",
      )}
    >
      <div
        className={clsx(
          "flex h-full grow flex-col bg-white ltr:pl-(--main-panel-width) rtl:pr-(--main-panel-width)",
          cardSkin === "shadow" ? "dark:bg-dark-750" : "dark:bg-dark-900",
        )}
      >
        <div className="relative flex h-16 w-full shrink-0 items-center justify-between pr-1 pl-4 rtl:pr-4 rtl:pl-1">
          <p className="dark:text-dark-100 truncate text-base tracking-wider text-gray-800">
            {title}
          </p>
          <Button
            onClick={close}
            isIcon
            variant="flat"
            className="size-7 rounded-full xl:hidden"
          >
            <ChevronLeftIcon className="size-6 rtl:rotate-180" />
          </Button>
        </div>
        {currentSegment?.childs && (
          <Menu nav={currentSegment.childs} pathname={pathname} />
        )}
      </div>
    </div>
  );
}
