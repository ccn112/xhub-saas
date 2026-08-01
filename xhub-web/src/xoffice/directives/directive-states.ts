import type { Tone } from "@/xhub/ui/Badge";

// Vietnamese labels + badge tones for the Directive + Commitment state machines
// (PH-02b — NX-025). Directive states plus the seed status aliases (AT_RISK,
// OVERDUE) are rendered too.
export const DIR_STATE_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  ISSUED: "Đã ban hành",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  // seed status aliases
  AT_RISK: "Có rủi ro",
  OVERDUE: "Quá hạn",
};

export const DIR_STATE_TONE: Record<string, Tone> = {
  DRAFT: "neutral",
  ISSUED: "info",
  IN_PROGRESS: "primary",
  COMPLETED: "success",
  CANCELLED: "neutral",
  AT_RISK: "warning",
  OVERDUE: "error",
};

// Commitment (per-assignee) states.
export const COMMIT_STATE_LABEL: Record<string, string> = {
  ASSIGNED: "Được giao",
  ACKNOWLEDGED: "Đã tiếp nhận",
  IN_PROGRESS: "Đang làm",
  SUBMITTED: "Đã nộp",
  ACCEPTED: "Đã nghiệm thu",
  RETURNED: "Trả lại",
};

export const COMMIT_STATE_TONE: Record<string, Tone> = {
  ASSIGNED: "neutral",
  ACKNOWLEDGED: "info",
  IN_PROGRESS: "primary",
  SUBMITTED: "info",
  ACCEPTED: "success",
  RETURNED: "warning",
};

// Directive-level action code → label + tone (issuer action bar).
export const DIR_ACTION_LABEL: Record<string, { label: string; tone: Tone }> = {
  issue: { label: "Ban hành", tone: "primary" },
  complete: { label: "Hoàn thành", tone: "success" },
  cancel: { label: "Hủy", tone: "neutral" },
};

// Commitment action code → label + tone.
export const COMMIT_ACTION_LABEL: Record<string, { label: string; tone: Tone }> = {
  acknowledge: { label: "Tiếp nhận", tone: "info" },
  start: { label: "Bắt đầu", tone: "primary" },
  submit: { label: "Nộp", tone: "primary" },
  accept: { label: "Nghiệm thu", tone: "success" },
  return: { label: "Trả lại", tone: "warning" },
};

export const DIR_ALL_STATES = ["DRAFT", "ISSUED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "AT_RISK", "OVERDUE"];

export const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Thấp",
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
