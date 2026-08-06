// Product Customer Support module — server-side data access (:4001,
// tenant-scoped, 2026-08-06). Mirrors customers-data.ts. Degrades to an
// empty list with source='offline' if the backend is unreachable (dev only).
import { xofficeContext, type XOfficeContext } from "./workflow-data";
import { XOFFICE_BASE_SERVER as API_BASE } from "@/lib/api-base";

export interface SupportCaseRow {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  productCode: string;
  customerId?: string | null;
  customer?: { id: string; name: string; code: string } | null;
  customerTenantRef?: string | null;
  requesterName?: string | null;
  requesterContact?: string | null;
  channel: string;
  category: string;
  priority: string;
  status: string;
  assigneeId?: string | null;
  escalationType?: string | null;
  escalatedItemId?: string | null;
  escalatedItemCode?: string | null;
  legalActions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SupportCaseEventRow {
  id: string;
  type: string;
  actorId: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface SupportCaseDetail {
  case: SupportCaseRow;
  customer: { id: string; name: string; code: string } | null;
  events: SupportCaseEventRow[];
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

export async function listSupportCases(
  filters: { status?: string; category?: string; priority?: string; productCode?: string; q?: string } = {},
): Promise<{ items: SupportCaseRow[]; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = xofficeContext();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v != null && v !== "") qs.set(k, String(v));
  const data = await get<{ items: SupportCaseRow[]; total: number }>(`/api/support-cases?${qs.toString()}`, ctx);
  return { items: data?.items ?? [], source: data ? "api" : "offline", ctx };
}

export async function getSupportCase(
  id: string,
): Promise<{ detail: SupportCaseDetail | null; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = xofficeContext();
  const detail = await get<SupportCaseDetail>(`/api/support-cases/${id}`, ctx);
  return { detail, source: detail ? "api" : "offline", ctx };
}

export const SUPPORT_CASE_STATUS_LABEL: Record<string, string> = {
  NEW: "Mới", TRIAGED: "Đã phân loại", IN_PROGRESS: "Đang xử lý",
  WAITING_CUSTOMER: "Chờ khách hàng", RESOLVED: "Đã xử lý xong", CLOSED: "Đã đóng", CANCELLED: "Đã hủy",
};

export const SUPPORT_CASE_STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "error"> = {
  NEW: "info", TRIAGED: "info", IN_PROGRESS: "warning", WAITING_CUSTOMER: "warning",
  RESOLVED: "success", CLOSED: "neutral", CANCELLED: "error",
};

export const SUPPORT_CASE_CATEGORY_LABEL: Record<string, string> = {
  OPERATION_SUPPORT: "Hỗ trợ thao tác", DATA_FIX: "Sửa dữ liệu", USAGE_QUESTION: "Hướng dẫn sử dụng",
  BUG_REPORT: "Báo lỗi phần mềm", FEATURE_REQUEST: "Đề xuất nâng cấp", OTHER: "Khác",
};

export const SUPPORT_CASE_PRIORITY_LABEL: Record<string, string> = {
  LOW: "Thấp", MEDIUM: "Trung bình", HIGH: "Cao", URGENT: "Khẩn cấp",
};

export const SUPPORT_CASE_PRIORITY_TONE: Record<string, "neutral" | "info" | "warning" | "error"> = {
  LOW: "neutral", MEDIUM: "info", HIGH: "warning", URGENT: "error",
};

export const SUPPORT_CASE_CHANNEL_LABEL: Record<string, string> = {
  ZALO: "Zalo", EMAIL: "Email", PHONE: "Điện thoại", PORTAL: "Cổng tự phục vụ", OTHER: "Khác",
};

export const SUPPORT_CASE_ACTION_LABEL: Record<string, string> = {
  triage: "Phân loại", start: "Bắt đầu xử lý", wait: "Chờ khách hàng", resume: "Tiếp tục xử lý",
  resolve: "Đánh dấu xử lý xong", close: "Đóng case", cancel: "Hủy case",
};

export const SUPPORT_CASE_EVENT_LABEL: Record<string, string> = {
  created: "Tạo case", triage: "Phân loại", start: "Bắt đầu xử lý", wait: "Chuyển chờ khách hàng",
  resume: "Tiếp tục xử lý", resolve: "Đánh dấu xử lý xong", close: "Đóng case", cancel: "Hủy case",
  assign: "Phân công xử lý", comment: "Ghi chú", escalate: "Chuyển kỹ thuật (backlog/defect)",
  seeded: "Khởi tạo dữ liệu mẫu",
};
