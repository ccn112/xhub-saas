// Ticket / Service Desk module — server-side data access (:4000, tenant-scoped).
// Reuses the XOffice tenant context. On the CLOSED path we do NOT fall back to
// demo data: the list degrades to an empty array with source='offline' (dev only).
import { xofficeContext, type XOfficeContext } from "./workflow-data";

import { API_BASE_SERVER as API_BASE } from "@/lib/api-base";

export interface TicketRow {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  requesterId: string;
  catalogItemId?: string | null;
  category: string;
  priority: string;
  state: string;
  assigneeId?: string | null;
  orgUnitId?: string | null;
  slaDueAt?: string | null;
  resolvedAt?: string | null;
  csatScore?: number | null;
  csatComment?: string | null;
  createdAt: string;
  updatedAt: string;
  overdue?: boolean;
  legalActions?: string[];
}

export interface TicketEventRow {
  id: string;
  type: string;
  actorId: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface TicketAttachmentRow {
  id: string;
  title: string;
  kind: string;
  createdAt: string;
}

export interface ServiceCatalogItemRow {
  id: string;
  code: string;
  name: string;
  category: string;
  defaultSlaHours: number;
  description?: string | null;
}

export interface TicketDetail {
  ticket: TicketRow;
  catalogItem: ServiceCatalogItemRow | null;
  events: TicketEventRow[];
  attachments: TicketAttachmentRow[];
}

interface TicketList {
  items: TicketRow[];
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

export async function listTickets(
  filters: { scope?: string; state?: string; category?: string; q?: string; page?: number; pageSize?: number } = {},
): Promise<{ items: TicketRow[]; total: number; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = await xofficeContext();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v != null && v !== "") qs.set(k, String(v));
  const data = await get<TicketList>(`/api/tickets?${qs.toString()}`, ctx);
  return { items: data?.items ?? [], total: data?.total ?? 0, source: data ? "api" : "offline", ctx };
}

export async function getTicket(
  id: string,
): Promise<{ detail: TicketDetail | null; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = await xofficeContext();
  const detail = await get<TicketDetail>(`/api/tickets/${id}`, ctx);
  return { detail, source: detail ? "api" : "offline", ctx };
}

export async function listServiceCatalog(): Promise<{ items: ServiceCatalogItemRow[]; source: "api" | "offline" }> {
  const ctx = await xofficeContext();
  const data = await get<{ items: ServiceCatalogItemRow[] }>(`/api/service-catalog`, ctx);
  return { items: data?.items ?? [], source: data ? "api" : "offline" };
}
