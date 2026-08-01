"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionCard } from "@/xhub/ui/Card";
import { BarChart } from "@/xhub/ui/charts/BarChart";
import type { WorkDimension } from "@/xoffice/lib/work-items-data";
import type { StatMetric, WorkStats } from "@/xoffice/lib/work-stats-data";
import { STATUS_LABEL, TYPE_LABEL, PRIORITY_LABEL } from "./work-states";

const METRIC_LABEL: Record<StatMetric, string> = { count: "Số lượng", progress: "Tiến độ TB (%)", overdue: "Việc trễ hạn" };
const METRIC_UNIT: Record<StatMetric, string> = { count: "việc", progress: "%", overdue: "việc" };

/**
 * "Thống kê đa chiều" (owner requirement #2). A pivot report: choose a row axis
 * (any tag / tenant dimension / status·type·priority) × an optional column axis,
 * and a metric → a cross-tab table + a bar chart. Fetches GET /api/work/stats
 * through the BFF proxy on every change.
 */
export function ReportsClient({
  dimensions,
  initialGroupBy,
  initialStats,
}: {
  dimensions: WorkDimension[];
  initialGroupBy: string;
  initialStats: WorkStats | null;
}) {
  const [groupBy, setGroupBy] = useState(initialGroupBy);
  const [col, setCol] = useState("");
  const [metric, setMetric] = useState<StatMetric>("count");
  const [stats, setStats] = useState<WorkStats | null>(initialStats);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const axisOptions = [
    { value: "status", label: "Trạng thái" },
    { value: "type", label: "Loại công việc" },
    { value: "priority", label: "Ưu tiên" },
    { value: "project", label: "Dự án" },
    ...dimensions.map((d) => ({ value: `dimension:${d.key}`, label: d.label })),
    { value: "tag", label: "Thẻ (tag)" },
  ];

  const axisLabel = (v: string) => axisOptions.find((o) => o.value === v)?.label ?? v;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ groupBy, metric });
      if (col) qs.set("col", col);
      const res = await fetch(`/api/work/stats?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Không tải được thống kê");
        setStats(null);
        return;
      }
      setStats((await res.json()) as WorkStats);
    } catch {
      setError("Backend không phản hồi");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [groupBy, col, metric]);

  useEffect(() => {
    load();
  }, [load]);

  // Pretty labels for built-in facet keys.
  const prettyRow = (key: string, label: string) => {
    if (groupBy === "status") return STATUS_LABEL[key] ?? label;
    if (groupBy === "type") return TYPE_LABEL[key] ?? label;
    if (groupBy === "priority") return PRIORITY_LABEL[key] ?? label;
    return label;
  };
  const prettyCol = (key: string, label: string) => {
    if (col === "status") return STATUS_LABEL[key] ?? label;
    if (col === "type") return TYPE_LABEL[key] ?? label;
    if (col === "priority") return PRIORITY_LABEL[key] ?? label;
    return label;
  };

  const rows = stats?.rows ?? [];
  const columns = stats?.columns ?? [];
  const hasCross = !!col && columns.length > 0 && !(columns.length === 1 && columns[0].key === "__all__");

  const chartCategories = rows.map((r) => prettyRow(r.key, r.label));
  const chartValues = rows.map((r) => r.total);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Thống kê đa chiều</h1>
        <p className="text-sm text-gray-500 dark:text-dark-300">Pivot theo thẻ hoặc chiều phân tích (Loại việc · Giai đoạn · Nhóm chi phí · Bộ phận) — {stats?.itemCount ?? 0} việc</p>
      </div>

      <SectionCard title="Cấu hình báo cáo" accent="primary">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            Nhóm theo (hàng)
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="h-9 w-48 rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50">
              {axisOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            Cắt chéo theo (cột)
            <select value={col} onChange={(e) => setCol(e.target.value)} className="h-9 w-48 rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50">
              <option value="">— Không —</option>
              {axisOptions.filter((o) => o.value !== groupBy).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            Chỉ số
            <select value={metric} onChange={(e) => setMetric(e.target.value as StatMetric)} className="h-9 w-44 rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50">
              {(Object.keys(METRIC_LABEL) as StatMetric[]).map((m) => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}
            </select>
          </label>
          {loading && <span className="pb-2 text-xs text-gray-400">Đang tải…</span>}
          {error && <span className="pb-2 text-xs text-error">{error}</span>}
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={`Bảng chéo — ${METRIC_LABEL[metric]}`} accent="info">
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600">
                    <th className="py-2 pr-3 font-medium">{axisLabel(groupBy)}</th>
                    {hasCross
                      ? columns.map((c) => <th key={c.key} className="px-2 py-2 text-right font-medium">{prettyCol(c.key, c.label)}</th>)
                      : null}
                    <th className="py-2 pl-2 text-right font-semibold">Tổng</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-b border-gray-100 dark:border-dark-700">
                      <td className="py-2 pr-3 text-gray-700 dark:text-dark-100">{prettyRow(r.key, r.label)}</td>
                      {hasCross
                        ? columns.map((c) => <td key={c.key} className="px-2 py-2 text-right tabular-nums text-gray-600 dark:text-dark-200">{r.cells[c.key] ?? 0}</td>)
                        : null}
                      <td className="py-2 pl-2 text-right font-semibold tabular-nums text-gray-800 dark:text-dark-50">{r.total}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 text-sm font-semibold dark:border-dark-500">
                    <td className="py-2 pr-3 text-gray-700 dark:text-dark-100">Tổng cộng</td>
                    {hasCross ? columns.map((c) => <td key={c.key} />) : null}
                    <td className="py-2 pl-2 text-right tabular-nums text-primary-700 dark:text-primary-300">{stats?.grandTotal ?? 0}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-gray-400">Không có dữ liệu.</p>
          )}
        </SectionCard>

        <SectionCard title={`Biểu đồ — ${METRIC_LABEL[metric]} theo ${axisLabel(groupBy)}`} accent="success">
          {rows.length ? (
            <BarChart categories={chartCategories} values={chartValues} seriesName={METRIC_LABEL[metric]} unitLabel={METRIC_UNIT[metric]} horizontal height={Math.max(240, rows.length * 42)} />
          ) : (
            <p className="py-10 text-center text-sm text-gray-400">Không có dữ liệu.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
