"use client";

import clsx from "clsx";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

import { useSidebarContext } from "@/contexts/sidebar/context";

// Toggle prime panel.
//   - Expanded  → "‹ Thu gọn"  (narrow-back BEFORE the text)
//   - Collapsed → "Mở menu ›"  (narrow-next AFTER the text)
export function SidebarToggleBtn() {
  const { isExpanded, toggle } = useSidebarContext();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isExpanded ? "Thu gọn bảng điều hướng" : "Mở bảng điều hướng"}
      aria-expanded={isExpanded}
      className={clsx(
        "ml-0.5 flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-sm font-medium outline-hidden transition-colors",
        "text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-dark-200 dark:hover:bg-dark-600",
      )}
    >
      {isExpanded ? (
        <>
          <ChevronLeftIcon className="size-5" />
          <span>Thu gọn</span>
        </>
      ) : (
        <>
          <span>Mở menu</span>
          <ChevronRightIcon className="size-5" />
        </>
      )}
    </button>
  );
}
