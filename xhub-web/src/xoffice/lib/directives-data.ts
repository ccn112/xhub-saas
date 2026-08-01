// Directive module — server-side data access (:4000, tenant-scoped). Reuses the
// XOffice tenant context. On the CLOSED path we do NOT fall back to demo data:
// the list degrades to an empty array with source='offline' (dev only).
import { xofficeContext, type XOfficeContext } from "./workflow-data";

const API_BASE = process.env.XOFFICE_API_BASE ?? "http://localhost:4000";

export interface DirectiveRow {
  id: string;
  code: string;
  title: string;
  body?: string | null;
  issuerId: string;
  audienceType: string;
  audienceId?: string | null;
  priority: string;
  dueAt?: string | null;
  state: string;
  createdAt: string;
  updatedAt: string;
  assignmentCount?: number;
  overdue?: boolean;
  legalActions?: string[];
}

export interface DirectiveAssignmentRow {
  id: string;
  assigneeId: string;
  state: string;
  committedAt?: string | null;
  dueAt?: string | null;
  progress?: number | null;
  note?: string | null;
  createdAt: string;
  overdue?: boolean;
  legalActions?: string[];
}

export interface DirectiveEventRow {
  id: string;
  type: string;
  actorId: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface DirectiveEvidenceRow {
  id: string;
  title: string;
  kind: string;
  createdAt: string;
}

export interface DirectiveDetail {
  directive: DirectiveRow;
  assignments: DirectiveAssignmentRow[];
  events: DirectiveEventRow[];
  evidence: DirectiveEvidenceRow[];
}

interface DirectiveList {
  items: DirectiveRow[];
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

export async function listDirectives(
  filters: { scope?: string; state?: string; q?: string; page?: number; pageSize?: number } = {},
): Promise<{ items: DirectiveRow[]; total: number; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = await xofficeContext();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v != null && v !== "") qs.set(k, String(v));
  const data = await get<DirectiveList>(`/api/directives?${qs.toString()}`, ctx);
  return { items: data?.items ?? [], total: data?.total ?? 0, source: data ? "api" : "offline", ctx };
}

export async function getDirective(
  id: string,
): Promise<{ detail: DirectiveDetail | null; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = await xofficeContext();
  const detail = await get<DirectiveDetail>(`/api/directives/${id}`, ctx);
  return { detail, source: detail ? "api" : "offline", ctx };
}
