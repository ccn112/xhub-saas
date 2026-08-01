import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { BarChart } from "@/xhub/ui/charts/BarChart";
import { collection, byId } from "@/xhub/lib/seed";
import { vnd, vndShort, num, dateVN, timeVN } from "@/xhub/lib/format";
import { userName, initials } from "@/xhub/lib/repo";
import type { KpiSnapshot, Opportunity, Customer, Approval, CalendarEvent } from "@/xhub/lib/screen-types";

export const metadata = { title: "Bảng điều hành kinh doanh · XHub" };

interface SalesPerf { id: string; userId: string; period: string; quota: number; sales: number; openOpportunities: number }

const STAGE_LABEL: Record<string, string> = {
  consulting: "Tư vấn",
  proposal: "Đề xuất",
  negotiation: "Đàm phán",
  implementation: "Triển khai",
};
const STAGE_ORDER = ["consulting", "proposal", "negotiation", "implementation"];
const stageTone: Record<string, "neutral" | "info" | "warning" | "success"> = {
  consulting: "neutral", proposal: "info", negotiation: "warning", implementation: "success",
};
const prio: Record<string, "error" | "warning" | "neutral"> = { critical: "error", high: "error", medium: "warning", low: "neutral" };

export default function SalesHome() {
  const kpi = byId<KpiSnapshot>("kpiSnapshots", "kpi-sales-202608");
  const m = kpi?.metrics ?? {};
  const opportunities = collection<Opportunity>("opportunities");
  const customers = collection<Customer>("customers");
  const team = collection<SalesPerf>("salesTeamPerformance");
  const approvals = collection<Approval>("approvals").filter((a) => a.departmentId === "dept-sales");
  const events = collection<CalendarEvent>("calendarEvents").filter((e) => e.type === "customer");
  const recap = byId<{ bullets: string[]; generatedAt: string }>("aiInsights", "ai-sales-recap");
  const customerName = (id: string) => byId<Customer>("customers", id)?.name ?? id;

  // Pipeline theo giai đoạn (tỷ VND)
  const pipeline = STAGE_ORDER.map((stage) => {
    const opps = opportunities.filter((o) => o.stage === stage);
    return { stage, count: opps.length, value: opps.reduce((s, o) => s + (o.amount ?? 0), 0) };
  });

  // Khách hàng ưu tiên: theo healthScore/segment A + có cơ hội mở
  const priorityCustomers = [...customers]
    .filter((c) => ["implementing", "negotiation", "proposal"].includes(c.status))
    .sort((a, b) => (b.healthScore ?? 0) - (a.healthScore ?? 0))
    .slice(0, 4);

  const winRatePct = m.winRate != null ? Math.round(m.winRate * 100) : undefined;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Bảng điều hành kinh doanh</h1>
        <p className="text-sm text-gray-500 dark:text-dark-300">Pipeline, đội ngũ và hành động bán hàng trong ngày</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Doanh số tháng" value={vndShort(m.salesRevenue)} icon="💵" tone="success" />
        <StatCard label="Giá trị pipeline" value={vndShort(m.pipeline)} icon="📊" tone="primary" />
        <StatCard label="Cơ hội đang mở" value={num(m.openOpportunities)} icon="🎯" tone="info" />
        <StatCard label="Tỷ lệ chốt" value={winRatePct != null ? `${winRatePct}%` : "—"} icon="🏆" tone="warning" />
        <StatCard label="HĐ chờ ký" value={num(m.contractsAwaitingSignature)} icon="✍️" tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <SectionCard title="Pipeline cơ hội theo giai đoạn">
            <BarChart
              categories={pipeline.map((p) => STAGE_LABEL[p.stage])}
              values={pipeline.map((p) => +(p.value / 1e9).toFixed(2))}
              seriesName="Giá trị cơ hội"
            />
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {pipeline.map((p) => (
                <div key={p.stage} className="rounded-lg border border-gray-200 p-2 text-center dark:border-dark-600">
                  <p className="text-xs text-gray-400">{STAGE_LABEL[p.stage]}</p>
                  <p className="font-heading text-sm font-semibold text-gray-800 dark:text-dark-100">{vndShort(p.value)}</p>
                  <p className="text-xs text-gray-400">{p.count} cơ hội</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Cơ hội trọng điểm" bodyClassName="p-0">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-gray-200 text-left text-xs text-gray-400 uppercase dark:border-dark-600 dark:text-dark-300">
                <tr>
                  <th className="px-4 py-3">Cơ hội</th><th className="px-4 py-3">Giai đoạn</th>
                  <th className="px-4 py-3">Phụ trách</th><th className="px-4 py-3">Giá trị</th><th className="px-4 py-3">Dự kiến chốt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                {opportunities.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 dark:text-dark-100">{o.name}</p>
                      <p className="text-xs text-gray-400">{customerName(o.customerId)}</p>
                    </td>
                    <td className="px-4 py-3"><Badge tone={stageTone[o.stage] ?? "neutral"}>{STAGE_LABEL[o.stage] ?? o.stage}</Badge></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{userName(o.ownerId)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-dark-100">{vndShort(o.amount)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{dateVN(o.expectedCloseDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </SectionCard>

          <SectionCard accent="success" title="Hiệu suất đội ngũ" bodyClassName="p-0">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-gray-200 text-left text-xs text-gray-400 uppercase dark:border-dark-600 dark:text-dark-300">
                <tr>
                  <th className="px-4 py-3">Nhân sự</th><th className="px-4 py-3">Doanh số / Chỉ tiêu</th>
                  <th className="px-4 py-3 w-40">Đạt chỉ tiêu</th><th className="px-4 py-3">Cơ hội mở</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                {team.map((t) => {
                  const pct = t.quota ? Math.round((t.sales / t.quota) * 100) : 0;
                  return (
                    <tr key={t.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex size-8 items-center justify-center rounded-full bg-primary-600/10 text-xs font-semibold text-primary-600 uppercase">{initials(userName(t.userId))}</span>
                          <span className="font-medium text-gray-800 dark:text-dark-100">{userName(t.userId)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{vndShort(t.sales)} / {vndShort(t.quota)}</td>
                      <td className="px-4 py-3">
                        <div className="h-1.5 w-full rounded-full bg-gray-150 dark:bg-dark-500"><div className={`h-1.5 rounded-full ${pct >= 90 ? "bg-success" : pct >= 70 ? "bg-primary-600" : "bg-warning"}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                        <span className="text-xs text-gray-400">{pct}%</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{t.openOpportunities}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          {recap ? <AiRecap points={recap.bullets} footnote={`X.AI tạo lúc ${dateVN(recap.generatedAt)} · chỉ hỗ trợ đọc, không tự phê duyệt.`} /> : null}

          <SectionCard title="Khách hàng ưu tiên">
            <div className="space-y-2">
              {priorityCustomers.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-600/10 text-xs font-semibold text-primary-600 uppercase">{initials(c.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-100">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.industry} · Phân khúc {c.segment}</p>
                  </div>
                  <Badge tone={(c.healthScore ?? 0) >= 80 ? "success" : (c.healthScore ?? 0) >= 70 ? "warning" : "neutral"}>{c.healthScore}</Badge>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard accent="warning" title="Phê duyệt bán hàng" action={<Link href="/approvals" className="text-sm text-primary-600 hover:underline">Xem tất cả</Link>}>
            <div className="space-y-2">
              {approvals.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-100">{a.title}</p>
                    <p className="text-xs text-gray-400">{a.code}{a.amount != null ? ` · ${vnd(a.amount)}` : ""}</p>
                  </div>
                  <Badge tone={a.status === "overdue" ? "error" : prio[a.priority] ?? "neutral"}>{a.status === "overdue" ? "quá hạn" : a.priority}</Badge>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard accent="info" title="Lịch hẹn khách hàng">
            <div className="space-y-3">
              {events.length === 0 ? (
                <p className="text-sm text-gray-400">Không có lịch hẹn khách hàng hôm nay.</p>
              ) : events.map((e) => (
                <div key={e.id} className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary-600/10 text-primary-600">📅</span>
                  <div><p className="text-sm font-medium text-gray-800 dark:text-dark-100">{e.title}</p><p className="text-xs text-gray-400">{timeVN(e.start)} · {dateVN(e.start)}</p></div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
