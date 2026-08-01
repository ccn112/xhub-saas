import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { BarChart } from "@/xhub/ui/charts/BarChart";
import { listMetrics, getMetricObservations, type MetricObservation } from "@/xoffice/lib/manage-data";

export const metadata = { title: "Chỉ số / KPI · XHub" };
export const dynamic = "force-dynamic";

function rag(direction: string, value: number | undefined, red?: number | null, amber?: number | null): "GREEN" | "AMBER" | "RED" | "UNKNOWN" {
  if (value == null || red == null || amber == null) return "UNKNOWN";
  if (direction === "DOWN") return value >= red ? "RED" : value >= amber ? "AMBER" : "GREEN";
  return value <= red ? "RED" : value <= amber ? "AMBER" : "GREEN";
}
const ragTone: Record<string, "success" | "warning" | "error" | "neutral"> = { GREEN: "success", AMBER: "warning", RED: "error", UNKNOWN: "neutral" };

// MG-05 Metric Catalog — the "Sense" layer. Definitions (Mgmt-owned) + observation
// VALUES computed by the API from the existing Work data (read model, #12). The
// primary XOFFICE_WORK metric shows its observation series as a live chart.
export default async function MetricsPage() {
  const { items, source } = await listMetrics();
  const enriched = await Promise.all(
    items.map(async (m) => {
      const obs = await getMetricObservations(m.id);
      return { metric: m, observations: obs?.observations ?? [], latest: obs?.latest ?? null };
    }),
  );
  const primary = enriched.find((e) => e.metric.sourceSystem === "XOFFICE_WORK" && e.observations.length) ?? enriched[0];
  const series: MetricObservation[] = primary ? [...primary.observations].reverse() : [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Chỉ số / KPI</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">Định nghĩa do X.Office quản trị; giá trị là read-model tính từ Công việc (không dual-write, #12)</p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {enriched.slice(0, 4).map((e) => (
          <StatCard
            key={e.metric.id}
            label={`${e.metric.code}`}
            value={e.latest ? `${e.latest.value}${e.metric.unit}` : "—"}
            sub={e.metric.name}
            icon={e.metric.sourceSystem === "XOFFICE_WORK" ? "🔗" : "📊"}
            tone={ragTone[rag(e.metric.direction, e.latest?.value, e.metric.thresholdRed, e.metric.thresholdAmber)]}
          />
        ))}
      </div>

      {primary && series.length > 0 && (
        <SectionCard title={`Quan sát: ${primary.metric.code} · ${primary.metric.name} (nguồn ${primary.metric.sourceSystem})`} accent="info">
          <BarChart
            categories={series.map((o) => new Date(o.periodStart).toLocaleDateString("vi-VN", { month: "short", year: "2-digit" }))}
            values={series.map((o) => o.value)}
            seriesName={primary.metric.name}
            unitLabel={primary.metric.unit}
            height={260}
          />
        </SectionCard>
      )}

      <SectionCard title={`Danh mục chỉ số (${items.length})`} accent="primary">
        <ul className="divide-y divide-gray-100 dark:divide-dark-600">
          {enriched.map((e) => {
            const r = rag(e.metric.direction, e.latest?.value, e.metric.thresholdRed, e.metric.thresholdAmber);
            return (
              <li key={e.metric.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-800 dark:text-dark-50">{e.metric.code} · {e.metric.name}</p>
                  <p className="text-xs text-gray-400">Nguồn {e.metric.sourceSystem} · {e.metric.frequency} · hướng {e.metric.direction} · target {e.metric.target ?? "—"}{e.metric.unit}</p>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700 dark:text-dark-100">{e.latest ? `${e.latest.value}${e.metric.unit}` : "—"}</span>
                  <Badge tone={ragTone[r]}>{r}</Badge>
                </span>
              </li>
            );
          })}
          {items.length === 0 && <li className="py-3 text-sm text-gray-400">Chưa có chỉ số — chạy npm run seed:manage</li>}
        </ul>
      </SectionCard>
    </div>
  );
}
