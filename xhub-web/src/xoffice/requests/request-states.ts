import type { Tone } from "@/xhub/ui/Badge";

// Vietnamese labels + badge tones for the request state machine (PH-02a).
export const STATE_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  SUBMITTED: "Đã gửi",
  IN_REVIEW: "Đang xem xét",
  WAITING_SUPPLEMENT: "Chờ bổ sung",
  RESUBMITTED: "Đã gửi lại",
  APPROVED: "Đã duyệt",
  EXECUTING: "Đang thực hiện",
  DONE: "Hoàn tất",
  COMPLETED: "Hoàn tất",
  REJECTED: "Từ chối",
  WITHDRAWN: "Đã thu hồi",
  CANCELLED: "Đã hủy",
};

export const STATE_TONE: Record<string, Tone> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  IN_REVIEW: "info",
  WAITING_SUPPLEMENT: "warning",
  RESUBMITTED: "info",
  APPROVED: "success",
  EXECUTING: "primary",
  DONE: "success",
  COMPLETED: "success",
  REJECTED: "error",
  WITHDRAWN: "neutral",
  CANCELLED: "neutral",
};

// Action code → button label + tone (used by the detail action bar).
export const ACTION_LABEL: Record<string, { label: string; tone: Tone }> = {
  submit: { label: "Gửi duyệt", tone: "primary" },
  approve: { label: "Duyệt", tone: "success" },
  reject: { label: "Từ chối", tone: "error" },
  "request-supplement": { label: "Yêu cầu bổ sung", tone: "warning" },
  resubmit: { label: "Gửi lại", tone: "primary" },
  withdraw: { label: "Thu hồi", tone: "neutral" },
  cancel: { label: "Hủy", tone: "neutral" },
  execute: { label: "Thực hiện (thủ công)", tone: "primary" },
};

export const ALL_STATES = [
  "DRAFT", "SUBMITTED", "IN_REVIEW", "WAITING_SUPPLEMENT", "RESUBMITTED",
  "APPROVED", "EXECUTING", "DONE", "COMPLETED", "REJECTED", "WITHDRAWN", "CANCELLED",
];

export function fmtAmount(amount?: number | null, currency?: string | null): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("vi-VN").format(amount) + " " + (currency ?? "VND");
  } catch {
    return String(amount);
  }
}

export function fmtTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
