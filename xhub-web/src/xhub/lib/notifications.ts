// Notification Center — shared types + fetch helpers (frontend only).
// Backend: X.Office notifications API on XHUB_API_URL, scoped by
// x-user-id / x-tenant-id headers (same demo identity used elsewhere).
import { CANONICAL_TENANT_ID } from "./seed";

// Demo identity — mirrors inbox/page.tsx and preferences fetches.
export const NOTIF_USER_ID = "user-nam";
export const NOTIF_TENANT_ID = CANONICAL_TENANT_ID; // tenant-xtech

// Server components read XHUB_API_URL; client components read the public var.
export const NOTIF_API_SERVER =
  process.env.XHUB_API_URL ?? "http://localhost:4000";
export const NOTIF_API_CLIENT =
  process.env.NEXT_PUBLIC_XHUB_API_URL ?? "http://localhost:4000";

export interface XNotification {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  sourceSystem?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  deepLink?: string | null;
  channelHint?: string | null;
  createdAt: string;
  readAt?: string | null;
}

function headers() {
  return {
    "x-user-id": NOTIF_USER_ID,
    "x-tenant-id": NOTIF_TENANT_ID,
  } as Record<string, string>;
}

/** GET all notifications. Empty array on any failure (never throws). */
export async function fetchNotifications(
  base: string,
): Promise<XNotification[]> {
  try {
    const res = await fetch(`${base}/api/xoffice/notifications`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as unknown;
    return Array.isArray(rows) ? (rows as XNotification[]) : [];
  } catch {
    return [];
  }
}

/** GET unread count. Accepts {count} or a bare number. 0 on failure. */
export async function fetchUnreadCount(base: string): Promise<number> {
  try {
    const res = await fetch(`${base}/api/xoffice/notifications/unread-count`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as unknown;
    if (typeof data === "number") return data;
    if (data && typeof data === "object" && "count" in data) {
      const c = (data as { count: unknown }).count;
      return typeof c === "number" ? c : 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

/** POST mark one read. Returns success flag (never throws). */
export async function markNotificationRead(
  base: string,
  id: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${base}/api/xoffice/notifications/${encodeURIComponent(id)}/read`,
      { method: "POST", headers: headers() },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** POST mark all read. Returns success flag (never throws). */
export async function markAllNotificationsRead(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/api/xoffice/notifications/read-all`, {
      method: "POST",
      headers: headers(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Heroicon key per notification type (resolved in the UI layer).
export function iconKeyForType(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("approval")) return "approval";
  if (t.includes("task") || t.includes("work")) return "task";
  if (t.includes("message") || t.includes("chat") || t.includes("comment"))
    return "chat";
  if (t.includes("alert") || t.includes("warn") || t.includes("error"))
    return "alert";
  if (t.includes("doc") || t.includes("file")) return "doc";
  return "bell";
}
