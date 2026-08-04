// Request module — server-side data access (:4000, tenant-scoped). Reuses the
// XOffice tenant context. On the CLOSED path we do NOT fall back to demo data:
// the list simply degrades to an empty array with source='offline' (dev only).
import { xofficeContext, type XOfficeContext } from "./workflow-data";

import { XOFFICE_BASE_SERVER as API_BASE } from "@/lib/api-base";

export interface RequestRow {
  id: string;
  code: string;
  kind: string;
  procedureCode: string;
  procedureName?: string | null;
  title: string;
  summary?: string | null;
  requesterId: string;
  orgUnitId?: string | null;
  amount?: number | null;
  currency?: string | null;
  state: string;
  approverId?: string | null;
  approverRole?: string | null;
  workflowInstanceId?: string | null;
  payload?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  legalActions?: string[];
}

export interface RequestEventRow {
  id: string;
  type: string;
  actorId: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface RequestCommentRow {
  id: string;
  authorId: string;
  body: string;
  mentions: string[];
  createdAt: string;
}

export interface RequestAttachmentRow {
  id: string;
  title: string;
  kind: string;
  byteSize?: number;
  versionCount?: number;
  createdAt: string;
}

export interface RequestExecutionRow {
  id: string;
  connectorCode: string;
  actionCode: string;
  mode: string;
  status: string;
  referenceCode?: string | null;
  referenceSystem?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface RequestDetail {
  request: RequestRow;
  events: RequestEventRow[];
  comments: RequestCommentRow[];
  attachments: RequestAttachmentRow[];
  executions: RequestExecutionRow[];
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

export async function listRequests(
  filters: { scope?: string; state?: string; procedureCode?: string; q?: string } = {},
): Promise<{ items: RequestRow[]; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = await xofficeContext();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, String(v));
  const rows = await get<RequestRow[]>(`/api/requests?${qs.toString()}`, ctx);
  return { items: rows ?? [], source: rows ? "api" : "offline", ctx };
}

export async function getRequest(id: string): Promise<{ detail: RequestDetail | null; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = await xofficeContext();
  const detail = await get<RequestDetail>(`/api/requests/${id}`, ctx);
  return { detail, source: detail ? "api" : "offline", ctx };
}
