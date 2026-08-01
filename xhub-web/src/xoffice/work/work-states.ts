import type { Tone } from "@/xhub/ui/Badge";

export const WORK_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "BLOCKED", "DONE", "CANCELLED"] as const;

export const STATUS_LABEL: Record<string, string> = {
  BACKLOG: "Chờ xử lý",
  TODO: "Cần làm",
  IN_PROGRESS: "Đang làm",
  REVIEW: "Đang duyệt",
  BLOCKED: "Bị chặn",
  DONE: "Hoàn thành",
  CANCELLED: "Đã huỷ",
};

export const STATUS_TONE: Record<string, Tone> = {
  BACKLOG: "neutral",
  TODO: "info",
  IN_PROGRESS: "primary",
  REVIEW: "warning",
  BLOCKED: "error",
  DONE: "success",
  CANCELLED: "neutral",
};

export const TYPE_LABEL: Record<string, string> = {
  TASK: "Công việc",
  SUBTASK: "Việc con",
  ACTION: "Hành động",
  MILESTONE: "Mốc",
  DELIVERABLE: "Sản phẩm",
  FOLLOW_UP: "Theo dõi",
};

export const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Thấp",
  NORMAL: "Bình thường",
  HIGH: "Cao",
  URGENT: "Khẩn",
};

export const PRIORITY_TONE: Record<string, Tone> = {
  LOW: "neutral",
  NORMAL: "info",
  HIGH: "warning",
  URGENT: "error",
};

export function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}
