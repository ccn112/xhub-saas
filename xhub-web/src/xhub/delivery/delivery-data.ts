// Solution Delivery Workspace — server-side data access (:4000, tenant-scoped
// under T001). The THIRD workspace type (X-TECH as solution provider). Reads the
// delivery API with the canonical T001 operator identity. Degrades gracefully to
// an empty result with source='offline' (dev only) — never demo data.
import { XOFFICE_BASE_SERVER as API_BASE } from "@/lib/api-base";
// user-nam holds the tenant PLATFORM_ADMIN=['*'] grant, which satisfies
// delivery.read/manage in dev (mirrors platform-data.ts).
const HEADERS = { "content-type": "application/json", "x-tenant-id": "tenant-xtech", "x-user-id": "user-nam" } as const;

export type Source = "api" | "offline";

export interface EngagementRow {
  id: string;
  code: string;
  customerName: string;
  prospectTenantNo: number | null;
  targetTenantId: string | null;
  industry: string | null;
  blueprintCode: string | null;
  seedPackCode: string | null;
  stage: string;
  status: string;
  ownerId: string;
  value: number | null;
  notes: string | null;
  launchId: string | null;
  createdAt: string;
  updatedAt: string;
  legalActions?: string[];
  launchReady?: boolean;
  onHold?: boolean;
}

export interface EngagementEventRow {
  id: string;
  type: string;
  actorId: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface EngagementAttachmentRow {
  id: string;
  title: string;
  kind: string;
  createdAt: string;
}

export interface LaunchStep {
  id: string;
  stepKey: string;
  seq: number;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED";
  attempts: number;
  error: string | null;
}

export interface LaunchRef {
  id: string;
  targetTenantId: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  blueprintId: string | null;
  seedPackId: string | null;
  createdAt: string;
  finishedAt: string | null;
  steps?: LaunchStep[];
}

export interface EngagementDetail {
  engagement: EngagementRow;
  events: EngagementEventRow[];
  attachments: EngagementAttachmentRow[];
  launch: LaunchRef | null;
}

export interface Pipeline {
  total: number;
  stageOrder: string[];
  byStage: Record<string, number>;
  byStatus: Record<string, number>;
  pipelineValue: number;
  wonValue: number;
  launchReady: number;
  launched: number;
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function listEngagements(
  filters: { stage?: string; status?: string; ownerId?: string; q?: string; page?: number; pageSize?: number } = {},
): Promise<{ items: EngagementRow[]; total: number; source: Source }> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v != null && v !== "") qs.set(k, String(v));
  const data = await get<{ items: EngagementRow[]; total: number }>(`/api/delivery/engagements?${qs.toString()}`);
  return { items: data?.items ?? [], total: data?.total ?? 0, source: data ? "api" : "offline" };
}

export async function getEngagement(id: string): Promise<{ detail: EngagementDetail | null; source: Source }> {
  const detail = await get<EngagementDetail>(`/api/delivery/engagements/${encodeURIComponent(id)}`);
  return { detail, source: detail ? "api" : "offline" };
}

export async function getPipeline(): Promise<{ pipeline: Pipeline; source: Source }> {
  const data = await get<Pipeline>(`/api/delivery/pipeline`);
  return {
    pipeline: data ?? { total: 0, stageOrder: [], byStage: {}, byStatus: {}, pipelineValue: 0, wonValue: 0, launchReady: 0, launched: 0 },
    source: data ? "api" : "offline",
  };
}

// ---- presentation helpers ---------------------------------------------------

export const STAGE_LABELS: Record<string, string> = {
  LEAD: "Tiềm năng",
  QUALIFIED: "Đủ điều kiện",
  SURVEY: "Khảo sát",
  SOLUTION_DESIGN: "Thiết kế giải pháp",
  PROPOSAL: "Đề xuất / báo giá",
  WON: "Chốt hợp đồng",
  IMPLEMENTATION: "Triển khai",
  MIGRATION: "Chuyển đổi dữ liệu",
  UAT: "Nghiệm thu (UAT)",
  GO_LIVE: "Go-live",
  HYPERCARE: "Hypercare",
  CUSTOMER_SUCCESS: "Customer Success",
  LOST: "Thất bại",
};

export const STATUS_TONES: Record<string, "success" | "warning" | "neutral" | "error" | "info"> = {
  OPEN: "info",
  WON: "warning",
  LIVE: "success",
  ON_HOLD: "neutral",
  LOST: "error",
};

export const LAUNCH_STATUS_TONES: Record<string, "success" | "warning" | "neutral" | "error" | "info"> = {
  QUEUED: "neutral",
  RUNNING: "info",
  COMPLETED: "success",
  FAILED: "error",
};

/** Label + tone for a lifecycle action (used by the action bar). */
export const ACTION_LABELS: Record<string, string> = {
  qualify: "Đủ điều kiện",
  survey: "Khảo sát",
  design: "Thiết kế giải pháp",
  propose: "Đề xuất",
  win: "Chốt hợp đồng",
  implement: "Triển khai",
  migrate: "Chuyển đổi",
  uat: "Nghiệm thu",
  golive: "Go-live",
  hypercare: "Hypercare",
  success: "Customer Success",
  lose: "Đánh dấu thất bại",
};

export function stageLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return STAGE_LABELS[s] ?? s;
}

export function formatValue(v: number | null | undefined): string {
  if (!v) return "—";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v);
}
