"use client";

// Client-side preference mutation. The server derives the authenticated user;
// we still pass the demo identity headers so the backend can scope the write.
import type { PatchMyUiPreferencesRequest } from "./preferences.contract";

import { XOFFICE_BASE_CLIENT as API_BASE } from "@/lib/api-base";

/** PATCH /api/me/ui-preferences. Throws on failure so callers can roll back. */
export async function patchUiPreferences(
  identity: { userId: string; tenantId: string },
  body: PatchMyUiPreferencesRequest,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/me/ui-preferences`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": identity.userId,
      "x-tenant-id": identity.tenantId,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`PATCH ui-preferences failed (${res.status})`);
  }
}
