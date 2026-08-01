import type { Tone } from "@/xhub/ui/Badge";

// Vietnamese labels + badge tones for the Announcement state machine (PH-02e — NX-028).
export const ANNOUNCEMENT_STATE_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  PUBLISHED: "Đã phát hành",
  ARCHIVED: "Đã lưu trữ",
  CANCELLED: "Đã hủy",
};

export const ANNOUNCEMENT_STATE_TONE: Record<string, Tone> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "neutral",
  CANCELLED: "neutral",
};

// Author action code → label + tone (state-gated action bar).
export const ANNOUNCEMENT_ACTION_LABEL: Record<string, { label: string; tone: Tone }> = {
  publish: { label: "Phát hành", tone: "primary" },
  archive: { label: "Lưu trữ", tone: "neutral" },
  cancel: { label: "Hủy", tone: "neutral" },
};

export const ANNOUNCEMENT_ALL_STATES = ["DRAFT", "PUBLISHED", "ARCHIVED", "CANCELLED"];

export const AUDIENCE_LABEL: Record<string, string> = {
  ALL: "Toàn công ty",
  ORG_UNIT: "Đơn vị",
  POSITION: "Vị trí",
  GROUP: "Nhóm",
  USER: "Cá nhân",
};

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
