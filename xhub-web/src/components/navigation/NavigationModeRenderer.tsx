"use client";

// Chooses the active renderer from the SHARED effective mode. Switching modes
// only swaps the renderer on the client — no route change, no reload.
import { useNavigation } from "@/xhub/nav/NavigationProvider";
import { RailContextNavigation } from "./RailContextNavigation";
import { ExpandedSidebarNavigation } from "./ExpandedSidebarNavigation";
import { MobileBottomNavigation } from "./MobileBottomNavigation";

export function NavigationModeRenderer() {
  const { effectiveMode, isMobile } = useNavigation();

  if (isMobile) return <MobileBottomNavigation />;
  return effectiveMode === "expanded" ? (
    <ExpandedSidebarNavigation />
  ) : (
    <RailContextNavigation />
  );
}
