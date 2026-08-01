"use client";

// Rail (72–80px) + Context sidebar (~240px). Reuses the ported Tailux
// MainPanel/PrimePanel, fed by the SHARED navigation tree via the adapter.
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { useBreakpointsContext } from "@/contexts/breakpoint/context";
import { useSidebarContext } from "@/contexts/sidebar/context";
import { useDidUpdate } from "@/hooks";
import { MainPanel } from "@/components/layout/MainLayout/Sidebar/MainPanel";
import { PrimePanel } from "@/components/layout/MainLayout/Sidebar/PrimePanel";
import { useNavigation } from "@/xhub/nav/NavigationProvider";
import { findActivePrimary } from "@/xhub/nav/resolver";
import { toRailTree, platformGroupIds } from "./railTreeAdapter";

type SegmentPath = string | undefined;

export function RailContextNavigation() {
  const pathname = usePathname() ?? "";
  const { tree } = useNavigation();
  const { name, lgAndDown } = useBreakpointsContext();
  const { isExpanded, close } = useSidebarContext();

  const nav = useMemo(() => toRailTree(tree), [tree]);
  const platformIds = useMemo(() => platformGroupIds(tree), [tree]);

  // Resolve the active WORKSPACE from the shared tree using the full `match`
  // array + descendant check (not just the first match path). The adapter's
  // rail item.path === base(item) === match[0], so map back to that base path.
  const activeBasePath = useMemo<SegmentPath>(() => {
    const ws = findActivePrimary(tree, pathname);
    return ws ? ws.match?.[0] ?? ws.href : undefined;
  }, [tree, pathname]);

  const [activeSegmentPath, setActiveSegmentPath] =
    useState<SegmentPath>(activeBasePath);

  const currentSegment = useMemo(
    () => nav.find((item) => item.path === activeSegmentPath),
    [nav, activeSegmentPath],
  );

  useDidUpdate(() => {
    setActiveSegmentPath(activeBasePath);
  }, [activeBasePath]);

  useDidUpdate(() => {
    if (lgAndDown && isExpanded) close();
  }, [name]);

  return (
    <>
      <MainPanel
        nav={nav}
        platformIds={platformIds}
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
