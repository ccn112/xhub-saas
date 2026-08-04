// Work statistics module — server-side data access (:4000, tenant-scoped).
// Reads the multi-dimensional pivot (owner requirement #2). Degrades to null on
// backend-down (no fake data). X.Office Work v2 — W3.
import { xofficeContext, type XOfficeContext } from "./workflow-data";

import { API_BASE_SERVER as API_BASE } from "@/lib/api-base";

export type StatMetric = "count" | "progress" | "overdue";

export interface StatColumn {
  key: string;
  label: string;
}
export interface StatRow {
  key: string;
  label: string;
  cells: Record<string, number>;
  total: number;
}
export interface WorkStats {
  groupBy: string;
  col: string | null;
  metric: StatMetric;
  columns: StatColumn[];
  rows: StatRow[];
  grandTotal: number;
  itemCount: number;
}

export interface StatsParams {
  groupBy: string;
  col?: string;
  metric?: StatMetric;
  status?: string;
  type?: string;
  priority?: string;
  projectId?: string;
  tags?: string[];
  dimensions?: Record<string, string>;
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

export async function getWorkStats(
  params: StatsParams,
): Promise<{ stats: WorkStats | null; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = xofficeContext();
  const qs = new URLSearchParams();
  qs.set("groupBy", params.groupBy);
  if (params.col) qs.set("col", params.col);
  if (params.metric) qs.set("metric", params.metric);
  if (params.status) qs.set("status", params.status);
  if (params.type) qs.set("type", params.type);
  if (params.priority) qs.set("priority", params.priority);
  if (params.projectId) qs.set("projectId", params.projectId);
  if (params.tags?.length) qs.set("tags", params.tags.join(","));
  if (params.dimensions && Object.keys(params.dimensions).length) qs.set("dimensions", JSON.stringify(params.dimensions));
  const stats = await get<WorkStats>(`/api/work/stats?${qs.toString()}`, ctx);
  return { stats, source: stats ? "api" : "offline", ctx };
}
