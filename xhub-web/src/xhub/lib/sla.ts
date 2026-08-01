// SLA helpers computed against the fixed demo clock (NOW). Never uses Date.now().
import { NOW } from "./format";
import type { Tone } from "@/xhub/ui/Badge";

export interface SlaInfo {
  label: string;
  tone: Tone;
  overdue: boolean;
  /** due - now, in milliseconds (negative when overdue). */
  diffMs: number;
}

const HOUR = 3_600_000;

/** Human SLA label + tone relative to the seed snapshot clock. */
export function slaInfo(dueAt?: string | null): SlaInfo {
  if (!dueAt) return { label: "Không hạn", tone: "neutral", overdue: false, diffMs: 0 };
  const now = new Date(NOW).getTime();
  const due = new Date(dueAt).getTime();
  const diffMs = due - now;
  const overdue = diffMs < 0;
  const absH = Math.abs(diffMs) / HOUR;
  const human = absH >= 24 ? `${Math.round(absH / 24)} ngày` : absH >= 1 ? `${Math.round(absH)} giờ` : `${Math.max(1, Math.round(absH * 60))} phút`;
  const tone: Tone = overdue ? "error" : absH <= 8 ? "warning" : "success";
  const label = overdue ? `Quá hạn ${human}` : `Còn ${human}`;
  return { label, tone, overdue, diffMs };
}
