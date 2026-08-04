// ExecutionProject module — server-side data access (:4000, tenant-scoped).
// Reuses the XOffice tenant context. On backend-down we degrade to empty with
// source='offline' (no fake data). The API decides FULL vs SUMMARY access per
// actor (CoordinationShare — owner requirement #1); the FE never receives hidden
// fields for a summary viewer. X.Office Work v2 — W2.
import { xofficeContext, type XOfficeContext } from "./workflow-data";

import { API_BASE_SERVER as API_BASE } from "@/lib/api-base";

export interface ProjectRow {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  projectKind: string;
  status: string;
  health: string;
  progressMethod: string;
  progressPercent: number;
  plannedStart?: string | null;
  plannedFinish?: string | null;
  forecastFinish?: string | null;
  projectManagerId?: string | null;
  sponsorId?: string | null;
  ownerId?: string | null;
  currentBaselineVersion?: number | null;
  tags?: string[];
  createdAt?: string;
}

export interface ProjectWorkItem {
  id: string;
  title: string;
  type: string;
  status: string;
  isMilestone?: boolean;
  parentId?: string | null;
  wbsCode?: string | null;
  progressPercent: number;
  rolledUpProgress?: number;
  weight?: number | null;
  plannedStart?: string | null;
  dueAt?: string | null;
  overdue?: boolean;
  tier?: "FULL" | "SUMMARY";
}

export interface WorkDependencyRow {
  id: string;
  predecessorId: string;
  successorId: string;
  type: string;
  lagMinutes: number;
}

export interface ProjectRole {
  id: string;
  subjectType: string;
  subjectId: string;
  role: string;
  visibilityTier: string;
}

export interface ProjectBaselineRow {
  id: string;
  version: number;
  label?: string | null;
  note?: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ProjectDetail {
  access: "FULL" | "SUMMARY";
  project: ProjectRow & { computedProgress?: number; tier?: "SUMMARY" };
  workItems: ProjectWorkItem[];
  milestones?: ProjectWorkItem[];
  roles?: ProjectRole[];
  baselines?: ProjectBaselineRow[];
  dependencies?: WorkDependencyRow[];
}

interface ProjectList {
  items: ProjectRow[];
  total: number;
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

export interface ProjectFilters {
  status?: string;
  projectKind?: string;
  health?: string;
  q?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}

export async function listProjects(
  filters: ProjectFilters = {},
): Promise<{ items: ProjectRow[]; total: number; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = xofficeContext();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v == null || v === "") continue;
    if (k === "tags" && Array.isArray(v)) { if (v.length) qs.set("tags", v.join(",")); }
    else qs.set(k, String(v));
  }
  const data = await get<ProjectList>(`/api/work/projects?${qs.toString()}`, ctx);
  return { items: data?.items ?? [], total: data?.total ?? 0, source: data ? "api" : "offline", ctx };
}

export async function getProject(
  id: string,
): Promise<{ detail: ProjectDetail | null; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = xofficeContext();
  const detail = await get<ProjectDetail>(`/api/work/projects/${id}`, ctx);
  return { detail, source: detail ? "api" : "offline", ctx };
}

// ---- Coordination Gantt (owner requirement #1) ------------------------------
export interface GanttBar {
  tier: "SUMMARY";
  id: string;
  title: string;
  type: string;
  isMilestone: boolean;
  status: string;
  progressPercent: number;
  plannedStart?: string | null;
  dueAt?: string | null;
  overdue?: boolean;
  rolledUp?: boolean;
}
export interface CoordinationGantt {
  view: "coordination";
  access: "FULL" | "SUMMARY";
  project: ProjectRow & { tier?: "SUMMARY" };
  bars: GanttBar[];
}

export async function getProjectGantt(
  id: string,
): Promise<{ gantt: CoordinationGantt | null; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = xofficeContext();
  const gantt = await get<CoordinationGantt>(`/api/work/projects/${id}/gantt?view=coordination`, ctx);
  return { gantt, source: gantt ? "api" : "offline", ctx };
}

// ---- Portfolio cockpit (W3) -------------------------------------------------
export interface PortfolioRow {
  id: string;
  code: string;
  name: string;
  status: string;
  projectKind: string;
  health: string;
  progressPercent: number;
  itemCount: number;
  overdueItems: number;
  blockedItems: number;
  milestoneCount: number;
  overdueMilestones: number;
  highRisk: number;
  plannedFinish?: string | null;
  forecastFinish?: string | null;
}
export interface Portfolio {
  totals: {
    projects: number;
    active: number;
    byHealth: Record<string, number>;
    byStatus: Record<string, number>;
    overdueItems: number;
    blockedItems: number;
    overdueMilestones: number;
    highRisk: number;
  };
  projects: PortfolioRow[];
}

export async function getPortfolio(): Promise<{ portfolio: Portfolio | null; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = xofficeContext();
  const portfolio = await get<Portfolio>(`/api/work/portfolio`, ctx);
  return { portfolio, source: portfolio ? "api" : "offline", ctx };
}
