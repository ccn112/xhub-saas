import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge, type Tone } from "@/xhub/ui/Badge";
import { listOkrCycles, listOkrs, getKpiTree } from "@/xoffice/lib/manage-data";

export const metadata = { title: "OKR · XHub" };
export const dynamic = "force-dynamic";

const statusTone: Record<string, Tone> = {
  ACTIVE: "info",
  ACHIEVED: "success",
  AT_RISK: "warning",
  DRAFT: "neutral",
  CANCELLED: "error",
  CLOSED: "neutral",
};

// Worst-case KPI icon for an objective's linked StrategicObjective(s) — a
// glance-able signal distinct from the OKR's own `status`/`confidence`
// (Constitution #9: KPI ≠ OKR, this only SHOWS the KPI side, never blends it
// into the OKR's own score).
const KPI_ICON: Record<string, string> = { RED: "🔴", YELLOW: "🟡", GREEN: "🟢", STALE: "⚪", UNKNOWN: "⚪" };
const KPI_SEVERITY: Record<string, number> = { RED: 3, YELLOW: 2, STALE: 1, UNKNOWN: 1, GREEN: 0 };

function worstKpiStatus(kpis: { objectiveId: string; status: string }[], strategicObjectiveIds: string[]): string | null {
  const relevant = kpis.filter((k) => strategicObjectiveIds.includes(k.objectiveId));
  if (!relevant.length) return null;
  return relevant.reduce((worst, k) => (KPI_SEVERITY[k.status] ?? 0) > (KPI_SEVERITY[worst] ?? 0) ? k.status : worst, relevant[0].status);
}

// MG-03 OKR — cycle list → objective drill-down. KeyResults link Initiative/
// ActionCommitment (never a raw task list, Constitution #9); confidence is
// shown alongside each Objective, distinct from any KPI status.
export default async function OkrsPage() {
  const { items: cycles, source } = await listOkrCycles();
  const current = cycles[0] ?? null;
  const [{ items: objectives }, { groups: kpiGroups }] = await Promise.all([
    current ? listOkrs(current.id) : Promise.resolve({ items: [] }),
    getKpiTree(),
  ]);
  const allKpis = kpiGroups.flatMap((g) => g.kpis);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">OKR</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">Mục tiêu tham vọng theo chu kỳ — Key Result link Initiative/Action, không phải danh sách task (Constitution #9)</p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      {!current && (
        <SectionCard accent="warning" title="Chưa có chu kỳ OKR">
          <p className="text-sm text-gray-400">Chạy <code>npm run seed:manage-okr</code> để tạo chu kỳ 2026Q3 mẫu.</p>
        </SectionCard>
      )}

      {current && (
        <>
          <div className="flex flex-wrap gap-2">
            {cycles.map((c) => (
              <Badge key={c.id} tone={c.id === current.id ? "primary" : "neutral"}>{c.code} · {c.status}</Badge>
            ))}
          </div>

          <SectionCard title={`Objectives · chu kỳ ${current.code} (${objectives.length})`} accent="primary">
            <ul className="divide-y divide-gray-100 dark:divide-dark-600">
              {objectives.map((o) => {
                const avgProgress = o.keyResults.length
                  ? Math.round(
                      (o.keyResults.reduce((s, kr) => {
                        const span = kr.target - kr.baseline;
                        const p = span !== 0 ? (kr.current - kr.baseline) / span : 0;
                        return s + Math.max(0, Math.min(1, p));
                      }, 0) /
                        o.keyResults.length) *
                        100,
                    )
                  : 0;
                const kpiStatus = worstKpiStatus(allKpis, o.strategicObjectiveIds ?? []);
                return (
                  <li key={o.id}>
                    <Link href={`/manage/okrs/${o.id}`} className="flex items-center justify-between gap-3 px-1 py-2.5 hover:bg-gray-50 dark:hover:bg-dark-600/40">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-50">
                          {kpiStatus && <span title={`KPI liên kết: ${kpiStatus}`}>{KPI_ICON[kpiStatus]} </span>}
                          {o.objective}
                        </p>
                        <p className="text-xs text-gray-400">{o.keyResults.length} Key Result · confidence {o.confidence != null ? `${Math.round(o.confidence * 100)}%` : "—"} · tiến độ trung bình {avgProgress}%</p>
                      </div>
                      <Badge tone={statusTone[o.status] ?? "neutral"}>{o.status}</Badge>
                    </Link>
                  </li>
                );
              })}
              {objectives.length === 0 && <li className="py-3 text-sm text-gray-400">Chưa có objective trong chu kỳ này.</li>}
            </ul>
          </SectionCard>
        </>
      )}
    </div>
  );
}
