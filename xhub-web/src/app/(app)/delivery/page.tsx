import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { getPipeline, listEngagements, stageLabel, formatValue, STATUS_TONES } from "@/xhub/delivery/delivery-data";

export const metadata = { title: "Tổng quan pipeline · Solution Delivery" };
export const dynamic = "force-dynamic";

export default async function DeliveryOverviewPage() {
  const [{ pipeline, source }, { items }] = await Promise.all([getPipeline(), listEngagements({ pageSize: 100 })]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Solution Delivery</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Không gian triển khai giải pháp của T001 (X-TECH) — quản lý vòng đời khách hàng từ tiềm năng đến go-live &amp; customer success. Không gian thứ ba, tách khỏi 5 workspace tenant và Platform Console.
          </p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Dự án triển khai" value={String(pipeline.total)} icon="📦" tone="primary" />
        <StatCard label="Giá trị pipeline" value={formatValue(pipeline.pipelineValue)} sub="đang mở" icon="💰" tone="info" />
        <StatCard label="Sẵn sàng launch" value={String(pipeline.launchReady)} sub="tại GO_LIVE" icon="🚀" tone="warning" />
        <StatCard label="Đã khởi chạy tenant" value={String(pipeline.launched)} sub="qua Launch Factory" icon="✅" tone="success" />
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Pipeline theo giai đoạn</h2>
        <div className="mt-3 space-y-2">
          {(pipeline.stageOrder ?? []).map((st) => {
            const n = pipeline.byStage[st] ?? 0;
            const max = Math.max(1, ...Object.values(pipeline.byStage));
            return (
              <div key={st} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 text-gray-600 dark:text-dark-200">{stageLabel(st)}</span>
                <div className="h-2 flex-1 rounded-full bg-gray-100 dark:bg-dark-700">
                  <div className="h-2 rounded-full bg-primary-500" style={{ width: `${(n / max) * 100}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right font-semibold text-gray-800 dark:text-dark-50">{n}</span>
              </div>
            );
          })}
          {(pipeline.stageOrder ?? []).length === 0 ? <p className="text-sm text-gray-400">Chưa có dữ liệu.</p> : null}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Dự án gần đây</h2>
          <Link href="/delivery/engagements" className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400">
            Tất cả dự án →
          </Link>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 6).map((e) => (
            <Link key={e.id} href={`/delivery/engagements/${e.id}`} className="rounded-lg border border-gray-200 p-3 text-sm hover:border-primary-400 dark:border-dark-600">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800 dark:text-dark-50">{e.code}</span>
                <Badge tone={STATUS_TONES[e.status] ?? "neutral"}>{e.status}</Badge>
              </div>
              <p className="mt-1 truncate text-gray-600 dark:text-dark-200">{e.customerName}</p>
              <p className="mt-1 text-xs text-gray-400">{stageLabel(e.stage)}</p>
            </Link>
          ))}
          {items.length === 0 ? <p className="text-sm text-gray-400">Chưa có dự án triển khai nào.</p> : null}
        </div>
      </Card>
    </div>
  );
}
