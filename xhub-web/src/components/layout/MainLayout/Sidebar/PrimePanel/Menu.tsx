"use client";

// Import Dependencies
import { useLayoutEffect, useMemo, useState } from "react";

// Local Imports
import { isRouteActive } from "@/utils/isRouteActive";
import { useDataScrollOverflow, useDidUpdate } from "@/hooks";
import { CollapsibleItem } from "./CollapsibleItem";
import { Accordion } from "@/components/ui";
import { MenuItem } from "./MenuItem";
import { Divider } from "./Divider";
import { NavigationTree } from "@/@types/navigation";

// ----------------------------------------------------------------------

export interface MenuProps {
  nav: NavigationTree[];
  pathname: string;
}

export function Menu({ nav, pathname }: MenuProps) {
  // Multi-open accordion: each collapse group opens/closes independently, so
  // opening one (e.g. "Tài liệu & Kiểm thử") never hides another (e.g. "Quản
  // trị"). The initially-open set = every group whose route is active.
  const initialActivePaths = useMemo(
    () =>
      nav
        .filter((item) => isRouteActive(item.path, pathname))
        .map((item) => item.path)
        .filter((path): path is string => Boolean(path)),
    [nav, pathname],
  );

  const { ref } = useDataScrollOverflow({ updateDeps: nav });
  const [expanded, setExpanded] = useState<string[]>(initialActivePaths);

  // On route change, ensure the active group is OPEN — but additively: never
  // collapse groups the user opened manually.
  useDidUpdate(() => {
    const activePath = nav.find((item) =>
      isRouteActive(item.path, pathname),
    )?.path;

    if (activePath) {
      setExpanded((prev) =>
        prev.includes(activePath) ? prev : [...prev, activePath],
      );
    }
  }, [nav, pathname]);

  useLayoutEffect(() => {
    const activeItem = ref?.current?.querySelector("[data-menu-active=true]");
    activeItem?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <Accordion
      multiple
      value={expanded}
      onChange={(v) => setExpanded(Array.isArray(v) ? v : [v])}
      className="flex flex-col overflow-hidden"
    >
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="h-full overflow-x-hidden overflow-y-auto pb-6"
        style={{ "--scroll-shadow-size": "32px" } as React.CSSProperties}
      >
        <div className="flex h-full flex-1 flex-col px-4">
          {nav.map((item) => {
            switch (item.type) {
              case "collapse":
                return <CollapsibleItem key={item.path} data={item} />;
              case "item":
                return <MenuItem key={item.path} data={item} pathname={pathname} />;
              case "divider":
                return <Divider key={item.id} />;
              default:
                return null;
            }
          })}
        </div>
      </div>
    </Accordion>
  );
}
