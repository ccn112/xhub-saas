import Link from "next/link";

import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { num } from "@/xhub/lib/format";
import { listWorkflows } from "@/xoffice/lib/workflow-data";
import { WorkflowsTable } from "./WorkflowsTable";

export const metadata = { title: "Danh mục quy trình · X.Office" };

export default async function WorkflowCatalogPage() {
  const { items, source } = await listWorkflows();
  const totalNodes = items.reduce((s, w) => s + w.nodeCount, 0);
  const totalUsage = items.reduce((s, w) => s + (w.usage ?? 0), 0);
  const firstCode = items[0]?.code;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">
            Danh mục quy trình
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            Thiết kế, mô phỏng và vận hành quy trình nghiệp vụ X.Office
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={source === "api" ? "success" : "warning"}>
            {source === "api" ? "Kết nối backend" : "Dữ liệu seed (offline)"}
          </Badge>
          {firstCode ? (
            <Link
              href={`/office/workflows/${firstCode}/builder?ai=1`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 text-sm font-medium text-white transition hover:bg-primary-700"
            >
              <span aria-hidden>✨</span> Tạo bằng AI
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Quy trình" value={num(items.length)} icon="🗂️" tone="primary" />
        <StatCard label="Tổng số node" value={num(totalNodes)} icon="🔗" tone="info" />
        <StatCard label="Lượt sử dụng" value={num(totalUsage)} icon="📈" tone="success" />
        <StatCard label="Đã publish" value={num(items.length)} icon="🚀" tone="warning" />
      </div>

      <WorkflowsTable items={items} />
    </div>
  );
}
