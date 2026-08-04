// NativeWorkItem module — server-side data access (:4000, tenant-scoped).
// Reuses the XOffice tenant context. On backend-down we degrade to empty with
// source='offline' (no fake data). The API decides FULL vs SUMMARY per actor
// (owner requirement #1) — the FE never receives hidden fields for summary rows.
import { xofficeContext, type XOfficeContext } from "./workflow-data";

import { API_BASE_SERVER as API_BASE } from "@/lib/api-base";

export type WorkTier = "FULL" | "SUMMARY";

export interface WorkItemRow {
  tier: WorkTier;
  id: string;
  title: string;
  type: string;
  status: string;
  isMilestone?: boolean;
  progressPercent: number;
  priority?: string;
  ownerId?: string | null;
  assigneeIds?: string[];
  projectId?: string | null;
  parentId?: string | null;
  wbsCode?: string | null;
  plannedStart?: string | null;
  dueAt?: string | null;
  description?: string | null;
  tags?: string[];
  dimensions?: Record<string, string>;
  overdue?: boolean;
  legalStatusTargets?: string[];
  createdAt?: string;
}

export interface WorkItemComment { id: string; authorId: string; body: string; createdAt: string; }
export interface WorkChecklistItem { id: string; label: string; done: boolean; doneBy?: string | null; }
export interface WorkItemEvent { id: string; type: string; actorId: string; data: Record<string, unknown>; createdAt: string; }
export interface WorkAttachment { id: string; title: string; kind: string; createdAt: string; }
export interface WorkItemChild { id: string; title: string; type: string; status: string; progressPercent: number; }

export interface WorkItemDetail {
  item: WorkItemRow;
  comments?: WorkItemComment[];
  checklist?: WorkChecklistItem[];
  events?: WorkItemEvent[];
  attachments?: WorkAttachment[];
  children?: WorkItemChild[];
}

export interface WorkDimension {
  id: string;
  key: string;
  label: string;
  allowedValues: { value: string; label: string; color?: string }[];
  active: boolean;
}

interface WorkList { items: WorkItemRow[]; total: number; page: number; pageSize: number; }

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

export interface WorkFilters {
  scope?: "mine" | "assigned" | "created" | "all";
  status?: string;
  type?: string;
  q?: string;
  tags?: string[];
  dimensions?: Record<string, string>;
  page?: number;
  pageSize?: number;
}

export async function listWorkItems(
  filters: WorkFilters = {},
): Promise<{ items: WorkItemRow[]; total: number; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = xofficeContext();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v == null || v === "") continue;
    if (k === "tags" && Array.isArray(v)) { if (v.length) qs.set("tags", v.join(",")); }
    else if (k === "dimensions" && typeof v === "object") { qs.set("dimensions", JSON.stringify(v)); }
    else qs.set(k, String(v));
  }
  const data = await get<WorkList>(`/api/work/items?${qs.toString()}`, ctx);
  return { items: data?.items ?? [], total: data?.total ?? 0, source: data ? "api" : "offline", ctx };
}

export async function getWorkItem(
  id: string,
): Promise<{ detail: WorkItemDetail | null; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = xofficeContext();
  const detail = await get<WorkItemDetail>(`/api/work/items/${id}`, ctx);
  return { detail, source: detail ? "api" : "offline", ctx };
}

export async function listWorkDimensions(): Promise<WorkDimension[]> {
  const ctx = xofficeContext();
  const data = await get<WorkDimension[]>(`/api/work/items/dimensions`, ctx);
  return Array.isArray(data) ? data : [];
}
