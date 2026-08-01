"use client";

// Central client context for navigation: effective mode (with responsive
// override), collapse (session/device only), density, settings drawer, the
// shared filtered tree and resolved badges. One source of truth for renderers.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useBreakpointsContext } from "@/contexts/breakpoint/context";
import { useToast } from "@/components/ui/Toast";
import { useNavigationMode } from "./use-navigation-mode";
import { patchUiPreferences } from "./preferences.client";
import type { XNavItem } from "./navigation.model";
import type { NavigationMode, DensityMode } from "./types";

export interface NavigationIdentity {
  userId: string;
  tenantId: string;
  // Display info (additive). Populated from the authenticated session when
  // present; falls back to the demo actor otherwise.
  name?: string;
  title?: string;
  // True when identity came from a real `xhub_session` (not the demo default).
  authenticated?: boolean;
}

interface NavigationContextValue {
  identity: NavigationIdentity;
  tree: XNavItem[];
  badges: Record<string, number>;
  savedMode: NavigationMode;
  effectiveMode: NavigationMode;
  allowedModes: NavigationMode[];
  isResponsiveOverride: boolean;
  isMobile: boolean;
  pending: boolean;
  setMode: (mode: NavigationMode) => void;
  // Collapse (session/device only — never required on the server).
  isCollapsed: boolean;
  toggleCollapse: () => void;
  // Density.
  density: DensityMode;
  setDensity: (d: DensityMode) => void;
  // Settings drawer.
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useNavigation must be used within <NavigationProvider>");
  return ctx;
}

export interface NavigationProviderProps {
  children: ReactNode;
  identity: NavigationIdentity;
  tree: XNavItem[];
  badges: Record<string, number>;
  initialMode: NavigationMode;
  tenantDefaultMode: NavigationMode;
  allowedModes: NavigationMode[];
  initialDensity: DensityMode;
}

export function NavigationProvider({
  children,
  identity,
  tree,
  badges,
  initialMode,
  allowedModes,
  initialDensity,
}: NavigationProviderProps) {
  const toast = useToast();
  const { isMd, smAndDown } = useBreakpointsContext();

  // Only trust breakpoints AFTER mount; the server render (and first client
  // render) must use the saved mode so hydration matches exactly.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isMobile = mounted && smAndDown;
  // 768–1023px: rail-context forced (rail fixed + context drawer).
  const forcedResponsiveMode: NavigationMode | undefined =
    mounted && isMd ? "rail-context" : undefined;

  const persist = useCallback(
    (mode: NavigationMode) => patchUiPreferences(identity, { navigationMode: mode }),
    [identity],
  );

  const nav = useNavigationMode({
    initialSavedMode: initialMode,
    forcedResponsiveMode,
    persist,
  });

  const setMode = useCallback(
    (mode: NavigationMode) => {
      nav.updateMode(mode).catch(() => {
        toast.error("Không thể lưu kiểu điều hướng. Đã hoàn tác thay đổi.");
      });
    },
    [nav, toast],
  );

  // Collapse — session/device scoped, namespaced key. No server write required.
  const storageKey = `xhub:${identity.tenantId}:${identity.userId}:ui`;
  const [isCollapsed, setIsCollapsed] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setIsCollapsed(Boolean(JSON.parse(raw).sidebarCollapsed));
    } catch {
      /* ignore */
    }
  }, [storageKey]);
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ sidebarCollapsed: next }),
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [storageKey]);

  // Density — optimistic + PATCH, applied via body[data-density].
  const [density, setDensityState] = useState<DensityMode>(initialDensity);
  const setDensity = useCallback(
    (d: DensityMode) => {
      const prev = density;
      setDensityState(d);
      patchUiPreferences(identity, { density: d }).catch(() => {
        setDensityState(prev);
        toast.error("Không thể lưu mật độ hiển thị. Đã hoàn tác thay đổi.");
      });
    },
    [density, identity, toast],
  );

  // Settings drawer.
  const [isSettingsOpen, setSettingsOpen] = useState(false);

  // Reflect state on <body> so CSS can drive layout offsets without JS layout shift.
  const bodyMode: string = isMobile ? "mobile" : nav.effectiveMode;
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    body.dataset.navigationMode = bodyMode;
    body.dataset.density = density;
    return () => {
      delete body.dataset.navigationMode;
    };
  }, [bodyMode, density]);

  const value = useMemo<NavigationContextValue>(
    () => ({
      identity,
      tree,
      badges,
      savedMode: nav.savedMode,
      effectiveMode: nav.effectiveMode,
      allowedModes,
      isResponsiveOverride: nav.isResponsiveOverride,
      isMobile,
      pending: nav.pending,
      setMode,
      isCollapsed,
      toggleCollapse,
      density,
      setDensity,
      isSettingsOpen,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
    }),
    [
      identity,
      tree,
      badges,
      nav.savedMode,
      nav.effectiveMode,
      nav.isResponsiveOverride,
      nav.pending,
      allowedModes,
      isMobile,
      setMode,
      isCollapsed,
      toggleCollapse,
      density,
      setDensity,
      isSettingsOpen,
    ],
  );

  return <NavigationContext value={value}>{children}</NavigationContext>;
}
