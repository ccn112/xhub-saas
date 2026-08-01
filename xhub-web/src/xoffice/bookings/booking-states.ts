import type { Tone } from "@/xhub/ui/Badge";

// Vietnamese labels + badge tones for the Booking state machine (PH-02d — NX-027).
export const BOOKING_STATE_LABEL: Record<string, string> = {
  REQUESTED: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  CHECKED_IN: "Đã nhận phòng",
  CHECKED_OUT: "Đã trả phòng",
  NO_SHOW: "Vắng mặt",
  REJECTED: "Bị từ chối",
  CANCELLED: "Đã hủy",
};

export const BOOKING_STATE_TONE: Record<string, Tone> = {
  REQUESTED: "warning",
  APPROVED: "info",
  CHECKED_IN: "primary",
  CHECKED_OUT: "success",
  NO_SHOW: "error",
  REJECTED: "neutral",
  CANCELLED: "neutral",
};

// Booking action code → label + tone (state-gated action bar).
export const BOOKING_ACTION_LABEL: Record<string, { label: string; tone: Tone }> = {
  approve: { label: "Duyệt", tone: "primary" },
  reject: { label: "Từ chối", tone: "neutral" },
  cancel: { label: "Hủy", tone: "neutral" },
  "check-in": { label: "Nhận phòng", tone: "primary" },
  "check-out": { label: "Trả phòng", tone: "success" },
  "no-show": { label: "Báo vắng mặt", tone: "error" },
};

export const BOOKING_ALL_STATES = [
  "REQUESTED",
  "APPROVED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "NO_SHOW",
  "REJECTED",
  "CANCELLED",
];

export const RESOURCE_TYPE_LABEL: Record<string, string> = {
  ROOM: "Phòng họp",
  ASSET: "Thiết bị",
  VEHICLE: "Phương tiện",
};

export function fmtTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function fmtRange(startIso?: string | null, endIso?: string | null): string {
  if (!startIso) return "—";
  try {
    const s = new Date(startIso);
    const e = endIso ? new Date(endIso) : null;
    const day = s.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    const hm = (d: Date) => d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return e ? `${day} · ${hm(s)}–${hm(e)}` : `${day} · ${hm(s)}`;
  } catch {
    return startIso;
  }
}
