import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { AreaChart } from "@/xhub/ui/charts/AreaChart";
import { DonutChart } from "@/xhub/ui/charts/DonutChart";
import { collection, byId } from "@/xhub/lib/seed";
import { vnd, vndShort, num } from "@/xhub/lib/format";
import { orgName, userName } from "@/xhub/lib/repo";
import type { KpiSnapshot, RevenueByProduct, RevenuePoint } from "@/xhub/lib/screen-types";

export const metadata = { title: "Báo cáo tổng hợp · XHub" };

const monthLabel = (ym: string) => `T${ym.split("-")[1]}`;

interface DeptPerf { id: string; departmentId: string; kpiCompletion: number; overdueTasks: number; alerts: number }
interface SalesPerf { id: string; userId: string; quota: number; sales: number; openOpportunities: number }

export default function ReportsPage() {
  const kpi = byId<KpiSnapshot>("kpiSnapshots", "kpi-exec-202608");
  const m = kpi?.metrics ?? {};
  const revenue = collection<RevenuePoint>("revenueSeries");
  const revByProduct = collection<RevenueByProduct>("revenueByProduct");
  const depts = collection<DeptPerf>("departmentPerformance");
  const sales = collection<SalesPerf>("salesTeamPerformance");
  const productName = (id: string) => byId<{ name: string }>("products", id)?.name ?? id;

  const totalRevenue = revenue.reduce((a, r) => a + r.value, 0);
  const totalQuota = sales.reduce((a, s) => a + s.quota, 0);
  const totalSales = sales.reduce((a, s) => a + s.sales, 0);
  const quotaPct = totalQuota ? Math.round((totalSales / totalQuota) * 100) : 0;
  const avgKpi = depts.length ? Math.round(depts.reduce((a, d) => a + d.kpiCompletion, 0) / depts.length) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Báo cáo tổng hợp</h1>
        <p className="text-sm text-gray-500 dark:text-dark-300">Doanh thu, hiệu suất phòng ban và đội ngũ kinh doanh — kỳ {kpi?.period ?? "—"}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Doanh thu tháng" value={vndShort(m.monthlyRevenue)} icon="💰" tone="success" />
        <StatCard label="Doanh thu 6 tháng" value={vndShort(totalRevenue)} icon="📈" tone="primary" />
        <StatCard label="Công nợ phải thu" value={vndShort(m.receivables)} icon="🧾" tone="warning" />
        <StatCard label="Đạt quota" value={`${quotaPct}%`} sub={`${vndShort(totalSales)}/${vndShort(totalQuota)}`} icon="🎯" tone={quotaPct >= 80 ? "success" : "warning"} />
        <StatCard label="KPI phòng ban TB" value={`${avgKpi}%`} icon="🏢" tone={avgKpi >= 85 ? "success" : "warning"} />
        <StatCard label="Dự án đang chạy" value={num(m.activeProjects)} icon="📁" tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard accent="success" title="Doanh thu 6 tháng">
          <AreaChart categories={revenue.map((r) => monthLabel(r.month))} values={revenue.map((r) => +(r.value / 1e9).toFixed(1))} />
        </SectionCard>
        <SectionCard accent="success" title="Doanh thu theo sản phẩm">
          <DonutChart labels={revByProduct.map((r) => productName(r.productId))} values={revByProduct.map((r) => +(r.value / 1e9).toFixed(2))} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard accent="success" title="Hiệu suất phòng ban" bodyClassName="p-0">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-gray-200 text-left text-xs text-gray-400 uppercase dark:border-dark-600 dark:text-dark-300">
              <tr><th className="px-4 py-3">Phòng ban</th><th className="px-4 py-3 w-40">Hoàn thành KPI</th><th className="px-4 py-3 text-center">Quá hạn</th><th className="px-4 py-3 text-center">Cảnh báo</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
              {depts.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-dark-100">{orgName(d.departmentId)}</td>
                  <td className="px-4 py-3">
                    <div className="h-1.5 w-full rounded-full bg-gray-150 dark:bg-dark-500">
                      <div className={`h-1.5 rounded-full ${d.kpiCompletion >= 90 ? "bg-success" : d.kpiCompletion >= 75 ? "bg-primary-600" : "bg-warning"}`} style={{ width: `${d.kpiCompletion}%` }} />
                    </div>
                    <span className="text-xs text-gray-400">{d.kpiCompletion}%</span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 dark:text-dark-200">{d.overdueTasks}</td>
                  <td className="px-4 py-3 text-center">{d.alerts ? <Badge tone="warning">{d.alerts}</Badge> : <span className="text-gray-400">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </SectionCard>

        <SectionCard accent="neutral" title="Đội ngũ kinh doanh" bodyClassName="p-0">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-gray-200 text-left text-xs text-gray-400 uppercase dark:border-dark-600 dark:text-dark-300">
              <tr><th className="px-4 py-3">Nhân viên</th><th className="px-4 py-3">Doanh số</th><th className="px-4 py-3 w-32">Đạt quota</th><th className="px-4 py-3 text-center">Cơ hội mở</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
              {sales.map((s) => {
                const pct = s.quota ? Math.round((s.sales / s.quota) * 100) : 0;
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-dark-100">{userName(s.userId)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{vnd(s.sales)}</td>
                    <td className="px-4 py-3">
                      <div className="h-1.5 w-full rounded-full bg-gray-150 dark:bg-dark-500">
                        <div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-success" : pct >= 70 ? "bg-primary-600" : "bg-warning"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">{pct}%</span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-dark-200">{s.openOpportunities}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
