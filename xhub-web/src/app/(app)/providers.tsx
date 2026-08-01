"use client";

import { ReactNode } from "react";

import { BreakpointProvider } from "@/contexts/breakpoint/Provider";
import { ThemeProvider } from "@/contexts/theme/Provider";
import { SidebarProvider } from "@/contexts/sidebar/Provider";
import { ToastProvider } from "@/components/ui/Toast";
import {
  NavigationProvider,
  type NavigationIdentity,
} from "@/xhub/nav/NavigationProvider";
import { AppShell } from "@/components/navigation/AppShell";
import type { XNavItem } from "@/xhub/nav/navigation.model";
import type { NavigationMode, DensityMode } from "@/xhub/nav/types";

export interface ProvidersProps {
  children: ReactNode;
  identity: NavigationIdentity;
  tree: XNavItem[];
  badges: Record<string, number>;
  initialMode: NavigationMode;
  tenantDefaultMode: NavigationMode;
  allowedModes: NavigationMode[];
  initialDensity: DensityMode;
}

// Provider order: breakpoint → theme → sidebar → toast → navigation.
export function Providers({ children, ...nav }: ProvidersProps) {
  return (
    <BreakpointProvider>
      <ThemeProvider>
        <SidebarProvider>
          <ToastProvider>
            <NavigationProvider
              identity={nav.identity}
              tree={nav.tree}
              badges={nav.badges}
              initialMode={nav.initialMode}
              tenantDefaultMode={nav.tenantDefaultMode}
              allowedModes={nav.allowedModes}
              initialDensity={nav.initialDensity}
            >
              <AppShell>{children}</AppShell>
            </NavigationProvider>
          </ToastProvider>
        </SidebarProvider>
      </ThemeProvider>
    </BreakpointProvider>
  );
}
