// Booking / resource booking module — server-side data access (:4000, tenant-
// scoped). Reuses the XOffice tenant context. We do NOT fall back to demo data:
// the list degrades to an empty array with source='offline' (dev only).
import { xofficeContext, type XOfficeContext } from "./workflow-data";

import { XOFFICE_BASE_SERVER as API_BASE } from "@/lib/api-base";

export interface BookingRow {
  id: string;
  code: string;
  title: string;
  purpose?: string | null;
  resourceId: string;
  requesterId: string;
  state: string;
  startAt: string;
  endAt: string;
  attendees?: number | null;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  noShow?: boolean;
  orgUnitId?: string | null;
  createdAt: string;
  updatedAt: string;
  overdue?: boolean;
  legalActions?: string[];
}

export interface BookingEventRow {
  id: string;
  type: string;
  actorId: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface BookingAttachmentRow {
  id: string;
  title: string;
  kind: string;
  createdAt: string;
}

export interface BookableResourceRow {
  id: string;
  code: string;
  name: string;
  type: string;
  capacity?: number | null;
  location?: string | null;
  orgUnitId?: string | null;
  active?: boolean;
}

export interface BookingDetail {
  booking: BookingRow;
  resource: BookableResourceRow | null;
  events: BookingEventRow[];
  attachments: BookingAttachmentRow[];
}

interface BookingList {
  items: BookingRow[];
  total: number;
  page: number;
  pageSize: number;
}

async function get<T>(path: string, ctx: XOfficeContext): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "x-tenant-id": ctx.tenantId, "x-user-id": ctx.userId, "content-type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function listBookings(
  filters: { scope?: string; state?: string; resourceId?: string; q?: string; page?: number; pageSize?: number } = {},
): Promise<{ items: BookingRow[]; total: number; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = await xofficeContext();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v != null && v !== "") qs.set(k, String(v));
  const data = await get<BookingList>(`/api/bookings?${qs.toString()}`, ctx);
  return { items: data?.items ?? [], total: data?.total ?? 0, source: data ? "api" : "offline", ctx };
}

export async function getBooking(
  id: string,
): Promise<{ detail: BookingDetail | null; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = await xofficeContext();
  const detail = await get<BookingDetail>(`/api/bookings/${id}`, ctx);
  return { detail, source: detail ? "api" : "offline", ctx };
}

export async function listBookableResources(): Promise<{ items: BookableResourceRow[]; source: "api" | "offline" }> {
  const ctx = await xofficeContext();
  const data = await get<{ items: BookableResourceRow[] }>(`/api/bookable-resources`, ctx);
  return { items: data?.items ?? [], source: data ? "api" : "offline" };
}
