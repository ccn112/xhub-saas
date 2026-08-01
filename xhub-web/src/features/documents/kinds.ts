// Client-safe shared helpers for the Documents module (no server-only imports).
import type { Tone } from "@/xhub/ui/Badge";

export interface KindMeta { label: string; icon: string; tone: Tone }

export const DOC_KINDS: Record<string, KindMeta> = {
  MEETING_MINUTES: { label: "Biên bản họp", icon: "📝", tone: "info" },
  QUOTE: { label: "Báo giá", icon: "📗", tone: "success" },
  CONTRACT: { label: "Hợp đồng", icon: "📜", tone: "warning" },
  PROPOSAL: { label: "Đề xuất", icon: "📕", tone: "error" },
  TECH_DOC: { label: "Tài liệu kỹ thuật", icon: "📘", tone: "primary" },
  REQUIREMENT: { label: "Yêu cầu nghiệp vụ", icon: "📋", tone: "neutral" },
  GENERIC: { label: "Tài liệu chung", icon: "📄", tone: "neutral" },
};

export function kindMeta(kind: string): KindMeta {
  return DOC_KINDS[kind] ?? { label: kind, icon: "📄", tone: "neutral" };
}

/** Options for a kind <select> (creation form + filter). */
export const KIND_OPTIONS = Object.entries(DOC_KINDS).map(([value, m]) => ({ value, label: m.label }));

export function fmtBytes(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
  return `${bytes} B`;
}
