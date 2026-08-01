"use client";

// Import Dependencies
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

// Local Imports
import { useBreakpointsContext } from "@/contexts/breakpoint/context";
import { useSidebarContext } from "@/contexts/sidebar/context";
import { navigation } from "@/navigation";
import { useDidUpdate } from "@/hooks";
import { isRouteActive } from "@/utils/isRouteActive";
import { MainPanel } from "./MainPanel";
import { PrimePanel } from "./PrimePanel";

// ----------------------------------------------------------------------

export type SegmentPath = string | undefined;

export function Sidebar() {
  const pathname = usePathname() ?? "";
  const { name, lgAndDown } = useBreakpointsContext();
  const { isExpanded, close } = useSidebarContext();

  const initialSegment = useMemo(
    () => navigation.find((item) => isRouteActive(item.path, pathname)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [activeSegmentPath, setActiveSegmentPath] = useState<SegmentPath>(
    initialSegment?.path,
  );

  const currentSegment = useMemo(() => {
    return navigation.find((item) => item.path === activeSegmentPath);
  }, [activeSegmentPath]);

  useDidUpdate(() => {
    const activePath = navigation.find((item) =>
      isRouteActive(item.path, pathname),
    )?.path;

    setActiveSegmentPath(activePath);
  }, [pathname]);

  useDidUpdate(() => {
    if (lgAndDown && isExpanded) close();
  }, [name]);

  return (
    <>
      <MainPanel
        nav={navigation}
        activeSegmentPath={activeSegmentPath}
        setActiveSegmentPath={setActiveSegmentPath}
      />
      <PrimePanel
        close={close}
        currentSegment={currentSegment}
        pathname={pathname}
      />
    </>
  );
}
