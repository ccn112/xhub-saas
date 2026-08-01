import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge, type Tone } from "@/xhub/ui/Badge";
import { getOkr } from "@/xoffice/lib/manage-data";
import { CheckInForm } from "./CheckInForm";

export const metadata = { title: "Chi tiết OKR · XHub" };
export const dynamic = "force-dynamic";

const statusTone: Record<string, Tone> = {
  ACTIVE: "info",
  ACHIEVED: "success",
  AT_RISK: "warning",
  DRAFT: "neutral",
  CANCELLED: "error",
  CLOSED: "neutral",
};

export default async function OkrDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const okr = await getOkr(id);
  if (!okr) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/manage/okrs" className="text-xs text-primary-600 hover:underline">← OKR</Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{okr.objective}</h1>
          <Badge tone={statusTone[okr.status] ?? "neutral"}>{okr.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
          Chủ sở hữu {okr.ownerId} · confidence {okr.confidence != null ? `${Math.round(okr.confidence * 100)}%` : "—"}
          {okr.strategicObjectiveIds.length > 0 && ` · liên kết ${okr.strategicObjectiveIds.length} mục tiêu chiến lược`}
        </p>
      </div>

      <div className="space-y-3">
        {okr.keyResults.map((kr) => {
          const span = kr.target - kr.baseline;
          const progress = span !== 0 ? Math.max(0, Math.min(1, (kr.current - kr.baseline) / span)) : 0;
          return (
            <SectionCard key={kr.id} title={kr.description} accent="info">
              <div className="mb-2 flex items-center gap-3 text-sm">
                <span className="text-gray-500 dark:text-dark-300">baseline {kr.baseline}{kr.unit}</span>
                <span className="font-semibold text-gray-800 dark:text-dark-50">→ hiện tại {kr.current}{kr.unit}</span>
                <span className="text-gray-500 dark:text-dark-300">→ target {kr.target}{kr.unit}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-150 dark:bg-dark-600">
                <div className="h-full rounded-full bg-primary-600" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              {kr.linkedActionIds.length > 0 && (
                <p className="mt-2 text-xs text-gray-400">Liên kết {kr.linkedActionIds.length} Action Commitment (không phải task list, #9)</p>
              )}

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Lịch sử check-in ({kr.checkIns?.length ?? 0}) — append-only</p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                    {(kr.checkIns ?? []).map((ci) => (
                      <li key={ci.id} className="rounded border border-gray-100 p-1.5 dark:border-dark-600">
                        <span className="font-medium text-gray-700 dark:text-dark-100">{ci.value}{kr.unit}</span>
                        {ci.confidence != null && <span className="ml-1 text-gray-400">(confidence {Math.round(ci.confidence * 100)}%)</span>}
                        <span className="ml-1 text-gray-400">— {new Date(ci.checkedAt).toLocaleString("vi-VN")}</span>
                        {ci.note && <p className="text-gray-500 dark:text-dark-300">{ci.note}</p>}
                      </li>
                    ))}
                    {(kr.checkIns ?? []).length === 0 && <li className="text-gray-400">Chưa có check-in.</li>}
                  </ul>
                </div>
                <CheckInForm okrId={okr.id} keyResultId={kr.id} unit={kr.unit} />
              </div>
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}
