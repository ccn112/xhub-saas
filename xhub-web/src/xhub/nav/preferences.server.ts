// Server-side preference read. Runs in the (app) layout so the shell renders in
// the saved navigation mode on first paint — no flash, no hydration mismatch.
import type { GetMyUiPreferencesResponse } from "./preferences.contract";
import type { NavigationMode } from "./types";

const API_BASE = process.env.XHUB_API_URL ?? "http://localhost:4000";
const PLATFORM_DEFAULT: NavigationMode = "rail-context";

export interface ResolvedPreferences extends GetMyUiPreferencesResponse {
  /** Whether the fetch succeeded (false → tenant/platform fallback in effect). */
  ok: boolean;
}

function fallback(tenantId: string): ResolvedPreferences {
  return {
    ok: false,
    tenantId,
    navigationMode: PLATFORM_DEFAULT,
    tenantDefaultNavigationMode: PLATFORM_DEFAULT,
    allowedNavigationModes: ["rail-context", "expanded"],
    theme: "system",
    density: "comfortable",
  };
}

/** GET /api/me/ui-preferences with the actor identity in headers. */
export async function fetchUiPreferences(
  userId: string,
  tenantId: string,
): Promise<ResolvedPreferences> {
  try {
    const res = await fetch(`${API_BASE}/api/me/ui-preferences`, {
      headers: { "x-user-id": userId, "x-tenant-id": tenantId },
      cache: "no-store",
    });
    if (!res.ok) return fallback(tenantId);
    const data = (await res.json()) as GetMyUiPreferencesResponse;
    return { ok: true, ...data };
  } catch {
    return fallback(tenantId);
  }
}
