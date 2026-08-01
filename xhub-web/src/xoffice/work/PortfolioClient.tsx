"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import { DonutChart } from "@/xhub/ui/charts/DonutChart";
import type { Portfolio, PortfolioRow } from "@/xoffice/lib/work-projects-data";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE, HEALTH_LABEL, HEALTH_TONE, KIND_LABEL, fmtDate } from "./project-states";

/**
 * Portfolio cockpit (WK-11). KPI tiles (active / health / overdue / blocked),
 * a health distribution donut, and a drill-down projects table. Read-only over
 * the one authoritative work dataset — click a row to open the project.
 */
export function PortfolioClient({ portfolio }: { portfolio: Portfolio | null }) {
  const router = useRouter();
  const [health, setHealth] = useState("ALL");

  const rows = portfolio?.projects ?? [];
  const totals = portfolio?.totals;

  const filtered = useMemo(() => rows.filter((r) => health === "ALL" || r.health === health), [rows, health]);

  const healthOrder = ["GREEN", "YELLOW", "RED", "UNKNOWN"];
  const donutLabels = healthOrder.map((h) => HEALTH_LABEL[h]);
  const donutValues = healthOrder.map((h) => totals?.byHealth?.[h] ?? 0);

  const columns: Column<PortfolioRow>[] = [
    {
      key: "name",
      header: "Dự án",
      cell: (r) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium text-gray-800 dark:text-dark-100">
            <span className="font-mono text-[11px] text-gray-400">{r.code}</span>
            <span className="truncate">{r.name}</span>
          </p>
          <p className="mt-0.5 text-xs text-gray-400">{KIND_LABEL[r.projectKind] ?? r.projectKind}</p>
        </div>
      ),
    },
    { key: "status", header: "Trạng thái", cell: (r) => <Badge tone={PROJECT_STATUS_TONE[r.status] ?? "neutral"}>{PROJECT_STATUS_LABEL[r.status] ?? r.status}</Badge> },
    { key: "health", header: "Sức khoẻ", cell: (r) => <Badge tone={HEALTH_TONE[r.health] ?? "neutral"}>{HEALTH_LABEL[r.health] ?? r.health}</Badge> },
    {
      key: "progress",
      header: "Tiến độ",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-150 dark:bg-dark-600">
            <div className="h-full rounded-full bg-primary-500" style={{ width: `${r.progressPercent}%` }} />
          </div>
          <span className="text-xs text-gray-500">{r.progressPercent}%</span>
        </div>
      ),
    },
    { key: "overdue", header: "Trễ hạn", cell: (r) => <span className={r.overdueItems > 0 ? "text-error font-medium" : "text-gray-400"}>{r.overdueItems}</span> },
    { key: "blocked", header: "Bị chặn", cell: (r) => <span className={r.blockedItems > 0 ? "text-warning-darker font-medium dark:text-warning-lighter" : "text-gray-400"}>{r.blockedItems}</span> },
    { key: "milestones", header: "Mốc trễ", cell: (r) => <span className={r.overdueMilestones > 0 ? "text-error font-medium" : "text-gray-400"}>{r.overdueMilestones}/{r.milestoneCount}</span> },
    { key: "finish", header: "Kết thúc (KH)", cell: (r) => <span className="text-xs text-gray-500">{fmtDate(r.plannedFinish)}</span> },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Portfolio — Cockpit quản lý</h1>
        <p className="text-sm text-gray-500 dark:text-dark-300">Sức khoẻ, tiến độ, việc trễ hạn/bị chặn trên toàn bộ dự án thực thi</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Dự án đang chạy" value={String(totals?.active ?? 0)} sub={`${totals?.projects ?? 0} tổng dự án`} icon="📁" tone="primary" />
        <StatCard label="Nguy cơ (Đỏ)" value={String(totals?.byHealth?.RED ?? 0)} sub={`${totals?.byHealth?.YELLOW ?? 0} cảnh báo`} icon="🚨" tone="error" />
        <StatCard label="Việc trễ hạn" value={String(totals?.overdueItems ?? 0)} sub={`${totals?.overdueMilestones ?? 0} mốc trễ`} icon="⏰" tone="warning" />
        <StatCard label="Việc bị chặn" value={String(totals?.blockedItems ?? 0)} sub={`${totals?.highRisk ?? 0} rủi ro cao`} icon="⛔" tone="error" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Phân bố sức khoẻ" accent="primary" className="lg:col-span-1">
          {donutValues.some((v) => v > 0) ? (
            <DonutChart labels={donutLabels} values={donutValues} unit="dự án" height={260} />
          ) : (
            <p className="py-10 text-center text-sm text-gray-400">Chưa có dữ liệu dự án.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Danh sách dự án"
          accent="info"
          className="lg:col-span-2"
          action={
            <select value={health} onChange={(e) => setHealth(e.target.value)} className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50">
              <option value="ALL">Mọi sức khoẻ</option>
              {healthOrder.map((h) => <option key={h} value={h}>{HEALTH_LABEL[h]}</option>)}
            </select>
          }
        >
          {filtered.length ? (
            <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} onRowClick={(r) => router.push(`/work/projects/${r.id}`)} />
          ) : (
            <p className="py-10 text-center text-sm text-gray-400">Không có dự án phù hợp bộ lọc.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
