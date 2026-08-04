// Server-side nav-permission read (PH-01 / NX-016). Runs in the (app) layout so
// the shell is rendered with the ALREADY-FILTERED tree on first paint — no flash,
// no client round-trip, consistent across every renderer (rail, prime panel,
// mobile bottom-nav, header horizontal menu, mobile drawer) since they all read
// the single provider `tree`.
//
// DEFAULT-SAFE: mirrors the backend enforcement gate. `menuEnforce` comes from
// the server (isEnforcing(): AUTH_ENFORCE / x-authz-enforce). When enforcement is
// OFF (dev default), the fetch fails, or the caller holds `*`, the FULL tree is
// used — an admin/dev always sees everything and there is never a whole-menu
// blackout.
import { API_BASE_SERVER as API_BASE } from "@/lib/api-base";

export interface ResolvedNavPermissions {
  /** Effective permission codes for the caller (may include wildcards / `"*"`). */
  permissions: string[];
  /** Role codes (informational). */
  roles: string[];
  /** Server-authoritative: hide unpermitted items only when true. */
  menuEnforce: boolean;
  /** False → fetch failed; caller MUST degrade to show-all. */
  ok: boolean;
}

function fallback(): ResolvedNavPermissions {
  // Fetch failed → show everything (never hide the whole menu).
  return { permissions: [], roles: [], menuEnforce: false, ok: false };
}

/** GET /api/identity/me/nav-permissions with the actor identity in headers. */
export async function fetchNavPermissions(
  userId: string,
  tenantId: string,
): Promise<ResolvedNavPermissions> {
  try {
    const res = await fetch(`${API_BASE}/api/identity/me/nav-permissions`, {
      headers: { "x-user-id": userId, "x-tenant-id": tenantId },
      cache: "no-store",
    });
    if (!res.ok) return fallback();
    const data = (await res.json()) as {
      permissions?: string[];
      roles?: string[];
      menuEnforce?: boolean;
    };
    return {
      permissions: data.permissions ?? [],
      roles: data.roles ?? [],
      menuEnforce: Boolean(data.menuEnforce),
      ok: true,
    };
  } catch {
    return fallback();
  }
}
