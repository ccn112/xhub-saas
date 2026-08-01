import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { AreaChart } from "@/xhub/ui/charts/AreaChart";
import { DonutChart } from "@/xhub/ui/charts/DonutChart";
import { collection, byId } from "@/xhub/lib/seed";
import { vnd, vndShort, num, dateVN, timeVN } from "@/xhub/lib/format";
import { orgName, userName } from "@/xhub/lib/repo";
import type { Approval, Directive, KpiSnapshot, Project, RevenueByProduct, RevenuePoint } from "@/xhub/lib/screen-types";

export const metadata = { title: "Tổng quan điều hành · XHub" };

const monthLabel = (ym: string) => `T${ym.split("-")[1]}`;
const prio: Record<string, "error" | "warning" | "neutral"> = { critical: "error", high: "error", medium: "warning", low: "neutral" };

export default function ExecutiveHome() {
  const kpi = byId<KpiSnapshot>("kpiSnapshots", "kpi-exec-202608");
  const m = kpi?.metrics ?? {};
  const revenue = collection<RevenuePoint>("revenueSeries");
  const revByProduct = collection<RevenueByProduct>("revenueByProduct");
  const approvals = collection<Approval>("approvals").filter((a) => a.status === "pending");
  const events = collection<{ id: string; title: string; start: string; type: string }>("calendarEvents");
  const directives = collection<Directive>("directives");
  const risks = collection<{ id: string; title: string; severity: string; dueDate: string }>("projectRisks");
  const depts = collection<{ departmentId: string; kpiCompletion: number; overdueTasks: number; alerts: number }>("departmentPerformance");
  const recap = byId<{ bullets: string[]; generatedAt: string }>("aiInsights", "ai-exec-recap");
  const productName = (id: string) => byId<{ name: string }>("products", id)?.name ?? id;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Tổng quan điều hành</h1>
        <p className="text-sm text-gray-500 dark:text-dark-300">Sức khỏe doanh nghiệp, cảnh báo và việc cần quyết định</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Doanh thu tháng" value={vndShort(m.monthlyRevenue)} icon="💰" tone="success" />
        <StatCard label="Công nợ phải thu" value={vndShort(m.receivables)} icon="🧾" tone="warning" />
        <StatCard label="Chờ phê duyệt" value={num(m.pendingApprovals)} icon="🛡️" tone="primary" />
        <StatCard label="Dự án đang chạy" value={num(m.activeProjects)} icon="📁" tone="info" />
        <StatCard label="Việc quá hạn" value={num(m.overdueTasks)} icon="⏰" tone="error" />
        <StatCard label="HĐ sắp hết hạn" value={num(m.contractsExpiring)} icon="📄" tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard accent="success" title="Doanh thu 6 tháng">
              <AreaChart categories={revenue.map((r) => monthLabel(r.month))} values={revenue.map((r) => +(r.value / 1e9).toFixed(1))} />
            </SectionCard>
            <SectionCard accent="success" title="Doanh thu theo sản phẩm">
              <DonutChart labels={revByProduct.map((r) => productName(r.productId))} values={revByProduct.map((r) => +(r.value / 1e9).toFixed(2))} />
            </SectionCard>
          </div>

          <SectionCard title="Chỉ đạo & watchlist" bodyClassName="p-0">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-gray-200 text-left text-xs text-gray-400 uppercase dark:border-dark-600 dark:text-dark-300">
                <tr><th className="px-4 py-3">Chỉ đạo</th><th className="px-4 py-3">Phụ trách</th><th className="px-4 py-3">Hạn</th><th className="px-4 py-3 w-40">Tiến độ</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                {directives.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3"><Link href="/work" className="font-medium text-gray-800 hover:text-primary-600 dark:text-dark-100">{d.title}</Link></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{userName(d.ownerId)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{dateVN(d.dueDate)}</td>
                    <td className="px-4 py-3">
                      <div className="h-1.5 w-full rounded-full bg-gray-150 dark:bg-dark-500"><div className="h-1.5 rounded-full bg-primary-600" style={{ width: `${d.progress}%` }} /></div>
                      <span className="text-xs text-gray-400">{d.progress}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </SectionCard>

          <SectionCard accent="error" title="Cảnh báo rủi ro dự án">
            <div className="space-y-2">
              {risks.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                  <Badge tone={r.severity === "high" ? "error" : "warning"}>{r.severity}</Badge>
                  <span className="flex-1 text-sm text-gray-700 dark:text-dark-100">{r.title}</span>
                  <span className="text-xs text-gray-400">Hạn {dateVN(r.dueDate)}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          {recap ? <AiRecap points={recap.bullets} footnote={`X.AI tạo lúc ${dateVN(recap.generatedAt)} · chỉ hỗ trợ đọc, không tự phê duyệt.`} /> : null}

          <SectionCard accent="warning" title="Phê duyệt ưu tiên" action={<Link href="/approvals" className="text-sm text-primary-600 hover:underline">Xem tất cả</Link>}>
            <div className="space-y-2">
              {approvals.map((a) => (
                <Link key={a.id} href="/inbox/wi-payment-mp-02" className="flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 hover:border-primary-300 dark:border-dark-600">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-100">{a.title}</p>
                    <p className="text-xs text-gray-400">{a.code} · {vnd(a.amount)}</p>
                  </div>
                  <Badge tone={prio[a.priority] ?? "neutral"}>{a.priority}</Badge>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard accent="info" title="Lịch hôm nay">
            <div className="space-y-3">
              {events.map((e) => (
                <div key={e.id} className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary-600/10 text-primary-600">🗓️</span>
                  <div><p className="text-sm font-medium text-gray-800 dark:text-dark-100">{e.title}</p><p className="text-xs text-gray-400">{timeVN(e.start)} · {e.type}</p></div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard accent="success" title="Hiệu suất phòng ban">
            <div className="space-y-3">
              {depts.map((d) => (
                <div key={d.departmentId}>
                  <div className="mb-1 flex justify-between text-sm"><span className="text-gray-700 dark:text-dark-100">{orgName(d.departmentId)}</span><span className="font-medium">{d.kpiCompletion}%</span></div>
                  <div className="h-1.5 w-full rounded-full bg-gray-150 dark:bg-dark-500"><div className={`h-1.5 rounded-full ${d.kpiCompletion >= 90 ? "bg-success" : d.kpiCompletion >= 75 ? "bg-primary-600" : "bg-warning"}`} style={{ width: `${d.kpiCompletion}%` }} /></div>
                  <p className="mt-0.5 text-xs text-gray-400">{d.overdueTasks} việc quá hạn · {d.alerts} cảnh báo</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
