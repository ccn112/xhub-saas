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
  activeSegmentPath: SegmentPath;
  setActiveSegmentPath?: Dispatch<SetStateAction<SegmentPath>>;
}

export function Menu({ nav, setActiveSegmentPath, activeSegmentPath }: MenuProps) {
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

  return (
    <ScrollShadow
      data-root-menu
      className="hide-scrollbar flex w-full grow flex-col items-center space-y-4 overflow-y-auto pt-5 lg:space-y-3 xl:pt-5 2xl:space-y-4"
    >
      {nav.map(({ id, icon, path, type, title }) => (
        <Item
          key={path}
          {...getProps({ id, icon, path, type, title })}
          id={id}
          icon={icon}
        />
      ))}
    </ScrollShadow>
  );
}
