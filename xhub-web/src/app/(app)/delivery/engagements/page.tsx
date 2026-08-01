import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { listEngagements, stageLabel, formatValue, STATUS_TONES } from "@/xhub/delivery/delivery-data";

export const metadata = { title: "Dự án triển khai · Solution Delivery" };
export const dynamic = "force-dynamic";

export default async function EngagementsListPage({ searchParams }: { searchParams: Promise<{ stage?: string; status?: string }> }) {
  const sp = await searchParams;
  const { items, total, source } = await listEngagements({ stage: sp.stage, status: sp.status, pageSize: 100 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Dự án triển khai</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">Danh mục engagement — vòng đời triển khai khách hàng của X-TECH. {total} dự án.</p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-400 dark:border-dark-700">
                <th className="p-3">Mã</th>
                <th className="p-3">Khách hàng</th>
                <th className="p-3">Giai đoạn</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Giá trị</th>
                <th className="p-3">Launch</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50 dark:border-dark-800 dark:hover:bg-dark-800">
                  <td className="p-3">
                    <Link href={`/delivery/engagements/${e.id}`} className="font-medium text-primary-600 hover:underline dark:text-primary-400">{e.code}</Link>
                  </td>
                  <td className="p-3 text-gray-700 dark:text-dark-100">{e.customerName}</td>
                  <td className="p-3 text-gray-600 dark:text-dark-200">{stageLabel(e.stage)}</td>
                  <td className="p-3"><Badge tone={STATUS_TONES[e.status] ?? "neutral"}>{e.status}</Badge></td>
                  <td className="p-3 text-gray-600 dark:text-dark-200">{formatValue(e.value)}</td>
                  <td className="p-3">{e.launchId ? <Badge tone="success">đã khởi chạy</Badge> : e.launchReady ? <Badge tone="warning">sẵn sàng</Badge> : <span className="text-gray-300">—</span>}</td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-gray-400">Chưa có dự án triển khai nào.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
