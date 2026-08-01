import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { StatCard } from "@/xhub/ui/StatCard";
import { listInstancesPaged } from "@/xoffice/lib/monitor-data";
import { InstancesTable } from "./InstancesTable";

export const metadata = { title: "Vận hành · Instances · X.Office" };

// Always render fresh runtime state; pagination is server-driven via ?page=.
export const dynamic = "force-dynamic";

export default async function InstancesListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = [10, 20, 50].includes(Number(sp.pageSize)) ? Number(sp.pageSize) : 20;

  const { items, total, source } = await listInstancesPaged(page, pageSize);
  const running = items.filter((i) => i.status === "running").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Vận hành · Instances</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            Danh sách phiên chạy quy trình X.Office — bấm một dòng để xem timeline chi tiết
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={source === "api" ? "success" : "warning"}>
            {source === "api" ? "Kết nối backend" : "Backend offline"}
          </Badge>
          <Link
            href="/office/monitor"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary-300 px-3.5 text-sm font-medium text-primary-600 transition hover:bg-primary-600/10 dark:border-primary-900 dark:text-primary-400"
          >
            Giám sát vận hành →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Tổng instance (trang này)" value={String(total)} icon="🗂️" tone="primary" />
        <StatCard label="Đang chạy (trang này)" value={String(running)} icon="⚙️" tone="info" />
        <StatCard label="Kích thước trang" value={String(pageSize)} icon="📄" tone="neutral" />
      </div>

      <InstancesTable rows={items} page={page} pageSize={pageSize} total={total} />
    </div>
  );
}
