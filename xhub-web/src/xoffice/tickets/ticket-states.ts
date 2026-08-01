import type { Tone } from "@/xhub/ui/Badge";

// Vietnamese labels + badge tones for the Ticket state machine (PH-02c — NX-026).
export const TICKET_STATE_LABEL: Record<string, string> = {
  NEW: "Mới",
  TRIAGED: "Đã phân loại",
  ASSIGNED: "Đã giao",
  IN_PROGRESS: "Đang xử lý",
  PENDING_REQUESTER: "Chờ người yêu cầu",
  RESOLVED: "Đã xử lý",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã hủy",
};

export const TICKET_STATE_TONE: Record<string, Tone> = {
  NEW: "neutral",
  TRIAGED: "info",
  ASSIGNED: "info",
  IN_PROGRESS: "primary",
  PENDING_REQUESTER: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
  CANCELLED: "neutral",
};

// Ticket action code → label + tone (state-gated action bar).
export const TICKET_ACTION_LABEL: Record<string, { label: string; tone: Tone }> = {
  triage: { label: "Phân loại", tone: "info" },
  assign: { label: "Giao xử lý", tone: "primary" },
  claim: { label: "Nhận việc", tone: "primary" },
  start: { label: "Bắt đầu", tone: "primary" },
  pending: { label: "Chờ người yêu cầu", tone: "warning" },
  resume: { label: "Tiếp tục", tone: "primary" },
  resolve: { label: "Đã xử lý xong", tone: "success" },
  close: { label: "Đóng", tone: "neutral" },
  cancel: { label: "Hủy", tone: "neutral" },
};

export const TICKET_ALL_STATES = [
  "NEW",
  "TRIAGED",
  "ASSIGNED",
  "IN_PROGRESS",
  "PENDING_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
];

export const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  NORMAL: "Bình thường",
  HIGH: "Cao",
  URGENT: "Khẩn",
};

export function fmtTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}
