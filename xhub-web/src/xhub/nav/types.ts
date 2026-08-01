export type NavigationMode = "rail-context" | "expanded";
export type ThemeMode = "system" | "light" | "dark";
export type DensityMode = "comfortable" | "compact";

export interface NavigationItem {
  id: string;
  label: string;
  icon?: string;
  href: string;
  permission?: string;
  entitlement?: string;
  featureFlag?: string;
  badgeKey?: string;
  children?: NavigationItem[];
}

export interface NavigationGroup {
  id: string;
  label?: string;
  items: NavigationItem[];
  collapsible?: boolean;
}

export interface UserInterfacePreference {
  tenantId: string;
  userId: string;
  navigationMode: NavigationMode;
  sidebarCollapsed?: boolean;
  theme: ThemeMode;
  density: DensityMode;
  updatedAt?: string;
}

export interface EffectiveNavigationState {
  savedMode: NavigationMode;
  effectiveMode: NavigationMode;
  isResponsiveOverride: boolean;
  isCollapsed: boolean;
}
