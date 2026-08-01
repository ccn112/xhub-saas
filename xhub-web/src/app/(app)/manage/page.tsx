import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { listObjectives, listMetrics, listReviews, listDecisions, listActions, getMetricObservations } from "@/xoffice/lib/manage-data";

export const metadata = { title: "Tổng quan điều hành · XHub" };
export const dynamic = "force-dynamic";

// MG-01 Management Home — enterprise health over the ONE reference loop:
// objectives on-track, red KPIs, open decisions, overdue commitments. Reads live
// via the BFF; degrades to an offline badge when the API is down.
export default async function ManageHomePage() {
  const [objectives, metrics, reviews, decisions, actions] = await Promise.all([
    listObjectives(),
    listMetrics(),
    listReviews(),
    listDecisions(),
    listActions(),
  ]);
  const source = objectives.source;

  const onTrack = objectives.items.filter((o) => o.status === "ACTIVE" || o.status === "ACHIEVED").length;
  const atRisk = objectives.items.filter((o) => o.status === "AT_RISK").length;
  const openDecisions = decisions.items.filter((d) => ["PROPOSED", "DECIDED", "IN_EXECUTION"].includes(d.status)).length;
  const now = Date.now();
  const overdueActions = actions.items.filter((a) => a.dueAt && new Date(a.dueAt).getTime() < now && a.status !== "DONE" && a.status !== "CANCELLED").length;

  // Red KPIs: pull the latest observation for each XOFFICE_WORK metric and RAG it.
  const workMetrics = metrics.items.filter((m) => m.sourceSystem === "XOFFICE_WORK");
  const rags = await Promise.all(workMetrics.map((m) => getMetricObservations(m.id)));
  const redKpis = rags.filter((r) => {
    const v = r?.latest?.value;
    const red = r?.metric?.thresholdRed;
    if (v == null || red == null) return false;
    return r!.metric.direction === "DOWN" ? v >= red : v <= red;
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Tổng quan điều hành</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            Một vòng lặp quản trị: Mục tiêu → KPI (đo từ Công việc) → Rà soát → Quyết định → Cam kết
          </p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Mục tiêu đúng hướng" value={`${onTrack}/${objectives.items.length}`} icon="🎯" tone="success" />
        <StatCard label="KPI báo động đỏ" value={String(redKpis)} sub={`${workMetrics.length} KPI từ Công việc`} icon="🔴" tone="error" />
        <StatCard label="Quyết định đang mở" value={String(openDecisions)} icon="🗳️" tone="info" />
        <StatCard label="Cam kết quá hạn" value={String(overdueActions)} sub={`${actions.items.length} cam kết`} icon="⏰" tone="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Mục tiêu chiến lược" accent="primary">
          <ul className="space-y-2">
            {objectives.items.map((o) => (
              <li key={o.id}>
                <Link href={`/manage/objectives/${o.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-dark-600/40">
                  <span className="truncate text-gray-700 dark:text-dark-100">{o.code} · {o.name}</span>
                  <Badge tone={o.status === "AT_RISK" ? "warning" : o.status === "ACHIEVED" ? "success" : "info"}>{o.status}</Badge>
                </Link>
              </li>
            ))}
            {objectives.items.length === 0 && <li className="text-sm text-gray-400">Chưa có mục tiêu — chạy seed:manage</li>}
          </ul>
          <div className="mt-2">
            <Link href="/manage/objectives" className="text-sm font-medium text-primary-600 hover:underline">Xem tất cả mục tiêu →</Link>
          </div>
        </SectionCard>

        <SectionCard title="Nhịp điều hành" accent="info">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-dark-200">Kỳ rà soát (Business Review)</span>
              <Badge tone="info">{reviews.items.length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-dark-200">Nhật ký quyết định (RAPID)</span>
              <Badge tone="neutral">{decisions.items.length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-dark-200">Cam kết đang theo dõi</span>
              <Badge tone="neutral">{actions.items.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/manage/metrics" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-primary-400 dark:border-dark-500 dark:text-dark-100">Chỉ số / KPI</Link>
              <Link href="/manage/reviews" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-primary-400 dark:border-dark-500 dark:text-dark-100">Rà soát</Link>
              <Link href="/manage/decisions" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-primary-400 dark:border-dark-500 dark:text-dark-100">Quyết định</Link>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
