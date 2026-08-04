// Announcement / read-acknowledgement module — server-side data access (:4000,
// tenant-scoped). Reuses the XOffice tenant context. We do NOT fall back to demo
// data: the list degrades to an empty array with source='offline' (dev only).
import { xofficeContext, type XOfficeContext } from "./workflow-data";

import { API_BASE_SERVER as API_BASE } from "@/lib/api-base";

export interface MyReceipt {
  readAt?: string | null;
  acknowledgedAt?: string | null;
  unread?: boolean;
  needsAck?: boolean;
}

export interface AnnouncementRow {
  id: string;
  code: string;
  title: string;
  body?: string | null;
  authorId: string;
  audienceType: string;
  audienceId?: string | null;
  priority: string;
  requireAck: boolean;
  publishAt?: string | null;
  expireAt?: string | null;
  state: string;
  createdAt: string;
  updatedAt: string;
  legalActions?: string[];
  myReceipt?: MyReceipt;
}

export interface AnnouncementEventRow {
  id: string;
  type: string;
  actorId: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface AnnouncementAttachmentRow {
  id: string;
  title: string;
  kind: string;
  createdAt: string;
}

export interface AnnouncementReportRecipient {
  userId: string;
  deliveredAt: string;
  readAt?: string | null;
  acknowledgedAt?: string | null;
  remindCount: number;
}

export interface AnnouncementReport {
  counts: { delivered: number; read: number; acknowledged: number; pending: number };
  recipients: AnnouncementReportRecipient[];
}

export interface AnnouncementDetail {
  announcement: AnnouncementRow;
  events: AnnouncementEventRow[];
  attachments: AnnouncementAttachmentRow[];
  report: AnnouncementReport;
  myReceipt: MyReceipt | null;
}

interface AnnouncementList {
  items: AnnouncementRow[];
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

export async function listAnnouncements(
  filters: { scope?: string; state?: string; q?: string; page?: number; pageSize?: number } = {},
): Promise<{ items: AnnouncementRow[]; total: number; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = await xofficeContext();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v != null && v !== "") qs.set(k, String(v));
  const data = await get<AnnouncementList>(`/api/announcements?${qs.toString()}`, ctx);
  return { items: data?.items ?? [], total: data?.total ?? 0, source: data ? "api" : "offline", ctx };
}

export async function getAnnouncement(
  id: string,
): Promise<{ detail: AnnouncementDetail | null; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = await xofficeContext();
  const detail = await get<AnnouncementDetail>(`/api/announcements/${id}`, ctx);
  return { detail, source: detail ? "api" : "offline", ctx };
}
