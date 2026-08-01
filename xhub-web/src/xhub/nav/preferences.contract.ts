import type { NavigationMode, ThemeMode, DensityMode } from "./types";

export interface GetMyUiPreferencesResponse {
  tenantId: string;
  navigationMode: NavigationMode;
  tenantDefaultNavigationMode: NavigationMode;
  allowedNavigationModes: NavigationMode[];
  theme: ThemeMode;
  density: DensityMode;
  sidebarCollapsed?: boolean;
}

export interface PatchMyUiPreferencesRequest {
  navigationMode?: NavigationMode;
  theme?: ThemeMode;
  density?: DensityMode;
  sidebarCollapsed?: boolean;
}

// Endpoint contract:
// GET   /api/me/ui-preferences
// PATCH /api/me/ui-preferences
// Server derives authenticated userId and tenantId from session/context.
