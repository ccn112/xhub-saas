import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { getRevenueKpis, formatMoney } from "@/xoffice/lib/revenue-data";

export const metadata = { title: "KPI Kinh doanh & Hợp đồng · X.Office" };
export const dynamic = "force-dynamic";

export default async function RevenueKpiPage() {
  const { kpis, currency, source } = await getRevenueKpis();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">KPI Kinh doanh &amp; Hợp đồng</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Mỗi chỉ số ghi rõ công thức &amp; nguồn dữ liệu (BO-0209) — &quot;Deal Won&quot; KHÔNG được tính là doanh
            thu, chỉ Hợp đồng/Yêu cầu xuất hoá đơn mới tính.
          </p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.code} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-400">{k.code}</span>
              {k.unavailable ? <Badge tone="neutral">Chưa khả dụng</Badge> : null}
            </div>
            <p className="mt-1 text-sm font-medium text-gray-700 dark:text-dark-100">{k.name}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-dark-50">
              {k.value === null ? "—" : formatMoney(k.value, currency)}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              <span className="font-medium">Công thức:</span> {k.formula}
            </p>
            <p className="text-xs text-gray-400">
              <span className="font-medium">Nguồn:</span> {k.source}
            </p>
            {k.note ? <p className="mt-1 text-xs italic text-gray-400">{k.note}</p> : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
