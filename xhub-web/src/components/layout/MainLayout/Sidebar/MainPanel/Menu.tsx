"use client";

// Import Dependencies
import { Dispatch, ElementType, SetStateAction } from "react";
import Link from "next/link";

// Local Imports
import { ScrollShadow } from "@/components/ui";
import { useSidebarContext } from "@/contexts/sidebar/context";
import { Item } from "./item";
import { NavigationTree } from "@/@types/navigation";
import { SegmentPath } from "../index";

// ----------------------------------------------------------------------

export interface MenuProps {
  nav: NavigationTree[];
  /** ids rendered as a separate, bottom-pinned cluster below a divider —
   * keeps platform-operator / cross-tenant surfaces (Platform Console,
   * Solution Delivery, IOC) visually apart from the core tenant workspaces
   * instead of one long flat icon list (U1 feedback: "too many icons"). */
  platformIds?: Set<string>;
  activeSegmentPath: SegmentPath;
  setActiveSegmentPath?: Dispatch<SetStateAction<SegmentPath>>;
}

export function Menu({ nav, platformIds, setActiveSegmentPath, activeSegmentPath }: MenuProps) {
  const { isExpanded, open } = useSidebarContext();

  const handleSegmentSelect = (path: string) => {
    setActiveSegmentPath?.(path);
    if (!isExpanded) {
      open();
    }
  };

  const getProps = ({ path, type, title }: NavigationTree) => {
    const isLink = type === "item";

    return {
      component: isLink ? Link : ("button" as ElementType),
      ...(isLink ? { href: path } : {}),
      onClick: isLink ? undefined : () => handleSegmentSelect(path as string),
      isActive: path === activeSegmentPath,
      title: title as string,
    };
  };

  const core = platformIds?.size ? nav.filter((item) => !platformIds.has(item.id)) : nav;
  const platform = platformIds?.size ? nav.filter((item) => platformIds.has(item.id)) : [];

  const renderItem = ({ id, icon, path, type, title }: NavigationTree) => (
    <Item key={path} {...getProps({ id, icon, path, type, title })} id={id} icon={icon} />
  );

  return (
    <ScrollShadow
      data-root-menu
      className="hide-scrollbar flex w-full grow flex-col items-center overflow-y-auto pt-5 xl:pt-5"
    >
      <div className="flex w-full flex-col items-center space-y-4 lg:space-y-3 2xl:space-y-4">
        {core.map(renderItem)}
      </div>
      {platform.length > 0 && (
        <div className="mt-auto flex w-full flex-col items-center">
          <p className="dark:text-dark-400 px-1 pt-4 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Vận hành nền tảng
          </p>
          <div className="border-gray-150 dark:border-dark-600/80 flex w-full flex-col items-center space-y-4 border-t pt-2 pb-1 lg:space-y-3 2xl:space-y-4">
            {platform.map(renderItem)}
          </div>
        </div>
      )}
    </ScrollShadow>
  );
}
