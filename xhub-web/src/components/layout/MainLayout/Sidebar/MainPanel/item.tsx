"use client";

// Import Dependencies
import { ElementType, ComponentPropsWithoutRef } from "react";
import clsx from "clsx";

// Local Imports
import { createScopedKeydownHandler } from "@/utils/dom/createScopedKeydownHandler";
import { navigationIcons } from "@/navigation/icons";

// ----------------------------------------------------------------------

export interface ItemProps {
  id: string;
  title: string;
  href?: string;
  isActive?: boolean;
  icon?: string;
  component?: ElementType;
  onClick?: (path: string) => void;
  onKeyDown?: ComponentPropsWithoutRef<"button">["onKeyDown"];
}

export function Item({
  id,
  title,
  isActive,
  icon,
  component,
  onKeyDown,
  ...rest
}: ItemProps) {
  if (!icon || !navigationIcons[icon]) {
    throw new Error(`Icon ${icon} not found in navigationIcons`);
  }

  const Element = component || "button";
  const Icon = navigationIcons[icon];

  return (
    <Element
      data-root-menu-item
      data-tooltip-content={title}
      title={title}
      className={clsx(
        "relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-hidden transition-colors duration-200",
        isActive
          ? "bg-primary-600/10 text-primary-600 dark:bg-primary-400/15 dark:text-primary-400"
          : "hover:bg-primary-600/20 focus:bg-primary-600/20 active:bg-primary-600/25 dark:text-dark-200 dark:hover:bg-dark-300/20 dark:focus:bg-dark-300/20 dark:active:bg-dark-300/25 text-gray-500",
      )}
      onKeyDown={createScopedKeydownHandler({
        siblingSelector: "[data-root-menu-item]",
        parentSelector: "[data-root-menu]",
        activateOnFocus: false,
        loop: true,
        orientation: "vertical",
        onKeyDown,
      })}
      {...rest}
    >
      <Icon className="size-7" />
    </Element>
  );
}
