import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge, type Tone } from "@/xhub/ui/Badge";
import { listScorecards, getScorecard, type Rag } from "@/xoffice/lib/manage-data";

export const metadata = { title: "Scorecard (BSC) · XHub" };
export const dynamic = "force-dynamic";

const ragTone: Record<Rag, Tone> = { GREEN: "success", YELLOW: "warning", RED: "error", STALE: "neutral", UNKNOWN: "neutral" };

// MG-03 Scorecard — the BSC strategy map. Each perspective column REFERENCES
// StrategicObjective ids; the rollup shown is a WORST-OF status (never a single
// blended average, Constitution #5) with red KPI items always listed explicitly.
export default async function ScorecardsPage() {
  const { items, source } = await listScorecards();
  const current = items[0] ?? null;
  const detail = current ? await getScorecard(current.id) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Scorecard (BSC)</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">Bản đồ chiến lược 4 perspective — tham chiếu Mục tiêu chiến lược, không nhúng KPI thô. Rollup là worst-of, không có điểm gộp che KPI đỏ.</p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      {!current && (
        <SectionCard accent="warning" title="Chưa có scorecard">
          <p className="text-sm text-gray-400">Chạy <code>npm run seed:manage-okr</code> để tạo scorecard mẫu 2026Q3.</p>
        </SectionCard>
      )}

      {current && (
        <>
          <div className="text-sm text-gray-500 dark:text-dark-300">
            {current.name} · kỳ {current.period}
            {items.length > 1 && <span className="ml-2 text-xs text-gray-400">({items.length} scorecard, hiển thị mới nhất)</span>}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(detail?.perspectiveViews ?? []).map((pv) => (
              <SectionCard key={pv.code} title={pv.name} accent={pv.rollup === "RED" ? "error" : pv.rollup === "YELLOW" ? "warning" : "primary"}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-gray-400">{pv.code}</span>
                  <Badge tone={ragTone[pv.rollup]}>{pv.rollup === "UNKNOWN" ? "Chưa có dữ liệu" : pv.rollup}</Badge>
                </div>
                <ul className="space-y-2">
                  {pv.objectives.map((o) => (
                    <li key={o.id} className="rounded-lg border border-gray-100 p-2 dark:border-dark-600">
                      {"missing" in o ? (
                        <p className="text-xs text-gray-400">Mục tiêu {o.id} (không tìm thấy)</p>
                      ) : (
                        <>
                          <Link href={`/manage/objectives/${o.id}`} className="text-sm font-medium text-gray-800 hover:underline dark:text-dark-50">
                            {(o as any).code} · {(o as any).name}
                          </Link>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {o.kpis.length === 0 && <span className="text-xs text-gray-400">Chưa liên kết KPI</span>}
                            {o.kpis.map((k) => (
                              <Badge key={k.metricId} tone={ragTone[k.rag]}>
                                {k.metricCode ?? k.metricId}: {k.value ?? "—"} ({k.rag})
                              </Badge>
                            ))}
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {pv.objectives.length === 0 && <li className="text-xs text-gray-400">Chưa có mục tiêu trong perspective này.</li>}
                </ul>
                {pv.redItems.length > 0 && (
                  <div className="mt-3 rounded-lg bg-error/5 p-2 text-xs text-error-darker dark:text-error-lighter">
                    <p className="font-semibold">⚠ KPI đỏ (luôn hiển thị, không bị điểm gộp che):</p>
                    <ul className="mt-1 space-y-0.5">
                      {pv.redItems.map((r, i) => (
                        <li key={`${r.metricId}-${i}`}>{r.metricCode ?? r.metricId} = {r.value}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </SectionCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
