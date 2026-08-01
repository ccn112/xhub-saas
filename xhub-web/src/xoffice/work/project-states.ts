// Shared label/tone maps for ExecutionProject (X.Office Work v2 — W2).
import type { Tone } from "@/xhub/ui/Badge";

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  PLANNED: "Đã lên kế hoạch",
  ACTIVE: "Đang chạy",
  ON_HOLD: "Tạm dừng",
  AT_RISK: "Rủi ro",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã huỷ",
};

export const PROJECT_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "neutral",
  PLANNED: "info",
  ACTIVE: "primary",
  ON_HOLD: "warning",
  AT_RISK: "warning",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

export const HEALTH_LABEL: Record<string, string> = { GREEN: "Tốt", YELLOW: "Cảnh báo", RED: "Nguy cơ", UNKNOWN: "Chưa rõ" };
export const HEALTH_TONE: Record<string, Tone> = { GREEN: "success", YELLOW: "warning", RED: "error", UNKNOWN: "neutral" };

export const KIND_LABEL: Record<string, string> = {
  INTERNAL: "Nội bộ",
  IMPLEMENTATION: "Triển khai",
  PRODUCT: "Sản phẩm",
  CUSTOMER_SUCCESS: "Customer Success",
  OPERATIONS: "Vận hành",
  OTHER: "Khác",
};

export const METHOD_LABEL: Record<string, string> = {
  MANUAL: "Thủ công",
  TASK_WEIGHTED: "Theo trọng số việc",
  MILESTONE_WEIGHTED: "Theo mốc",
  DELIVERABLE_WEIGHTED: "Theo bàn giao",
};

export const ROLE_LABEL: Record<string, string> = {
  PROJECT_MANAGER: "Quản lý dự án",
  SPONSOR: "Bảo trợ",
  DELIVERY_LEAD: "Trưởng triển khai",
  MEMBER: "Thành viên",
  OBSERVER: "Quan sát",
  DATA_STEWARD: "Quản lý dữ liệu",
};

export const DEP_LABEL: Record<string, string> = { FS: "Finish→Start", SS: "Start→Start", FF: "Finish→Finish", SF: "Start→Finish" };

export function fmtDate(v?: string | null): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}
