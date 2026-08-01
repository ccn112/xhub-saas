import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import type { BusinessReview, ReviewPreReadItem, DecisionRecord, ActionCommitment } from "@/xoffice/lib/manage-data";

type FullReview = BusinessReview & {
  preRead: ReviewPreReadItem[];
  exceptions: ReviewPreReadItem[];
  decisions: DecisionRecord[];
  actions: ActionCommitment[];
};

const ragTone: Record<string, "success" | "warning" | "error" | "neutral"> = { GREEN: "success", AMBER: "warning", RED: "error", UNKNOWN: "neutral" };

/**
 * Renders ONE business review as the connected management loop: pre-read metric
 * snapshot (computed from Work) → exceptions → decisions (RAPID) → actions each
 * bridged to a REAL NativeWorkItem. Server component (read-only).
 */
export function ReviewLoop({ review, heading }: { review: FullReview; heading?: string }) {
  return (
    <SectionCard title={heading ?? `${review.title ?? review.type}`} accent="info">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-dark-300">
        <Badge tone={review.status === "CLOSED" ? "success" : "info"}>{review.status}</Badge>
        <span>{review.type}</span>
        <span>·</span>
        <span>{new Date(review.periodStart).toLocaleDateString("vi-VN")} → {new Date(review.periodEnd).toLocaleDateString("vi-VN")}</span>
      </div>

      {/* 1. Pre-read snapshot (metric observations computed from Work) */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Pre-read · ảnh chụp KPI từ Công việc</p>
        {review.preRead.length ? review.preRead.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1.5 text-sm dark:bg-dark-600/40">
            <span className="truncate text-gray-700 dark:text-dark-100">{p.metricCode} · {p.metricName}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="font-semibold">{p.value}{p.unit}</span>
              <Badge tone={ragTone[p.rag]}>{p.rag}</Badge>
            </span>
          </div>
        )) : <p className="text-sm text-gray-400">Chưa có ảnh chụp KPI.</p>}
        {review.exceptions.length > 0 && (
          <p className="text-xs text-warning">⚠ {review.exceptions.length} ngoại lệ (AMBER/RED) cần thảo luận</p>
        )}
      </div>

      {/* 2. Decisions (RAPID) */}
      <div className="mt-4 space-y-1.5">
        <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Quyết định (RAPID)</p>
        {review.decisions.length ? review.decisions.map((d) => (
          <div key={d.id} className="rounded-lg border border-gray-100 px-2 py-1.5 text-sm dark:border-dark-600">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-gray-700 dark:text-dark-100">{d.question}</span>
              <Badge tone="neutral">{d.status}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-dark-300">→ {d.decision}</p>
          </div>
        )) : <p className="text-sm text-gray-400">Chưa có quyết định.</p>}
      </div>

      {/* 3. Actions → linked NativeWorkItem (the bridge) */}
      <div className="mt-4 space-y-1.5">
        <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Cam kết → Công việc thật (bridge #13)</p>
        {review.actions.length ? review.actions.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-2 py-1.5 text-sm dark:border-dark-600">
            <span className="min-w-0 truncate text-gray-700 dark:text-dark-100">{a.title}</span>
            <span className="flex shrink-0 items-center gap-2">
              <Badge tone={a.status === "DONE" ? "success" : "info"}>{a.status}</Badge>
              {a.nativeWorkItemId ? (
                <Link href={`/work/items/${a.nativeWorkItemId}`} className="text-xs font-medium text-primary-600 hover:underline">
                  {a.workItem ? `${a.workItem.type} · ${a.workItem.progressPercent}%` : "Xem việc"} →
                </Link>
              ) : (
                <span className="text-xs text-gray-400">chưa gắn việc</span>
              )}
            </span>
          </div>
        )) : <p className="text-sm text-gray-400">Chưa có cam kết.</p>}
      </div>
    </SectionCard>
  );
}
