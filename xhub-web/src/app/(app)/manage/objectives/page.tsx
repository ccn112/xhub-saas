import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { listObjectives } from "@/xoffice/lib/manage-data";

export const metadata = { title: "Mục tiêu chiến lược · XHub" };
export const dynamic = "force-dynamic";

const statusTone: Record<string, "success" | "warning" | "info" | "neutral" | "error"> = {
  ACTIVE: "info",
  ACHIEVED: "success",
  AT_RISK: "warning",
  DRAFT: "neutral",
  CANCELLED: "error",
  ARCHIVED: "neutral",
};

// MG-03 Strategic Objectives — the "Align" layer. List with perspective + status;
// each links to a detail view resolving its linked metric definitions.
export default async function ObjectivesPage() {
  const { items, source } = await listObjectives();
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Mục tiêu chiến lược</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">Định hướng tenant steer theo — tách bạch với KPI và chỉ đạo (Constitution #3)</p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <SectionCard title={`Danh sách mục tiêu (${items.length})`} accent="primary">
        <ul className="divide-y divide-gray-100 dark:divide-dark-600">
          {items.map((o) => (
            <li key={o.id}>
              <Link href={`/manage/objectives/${o.id}`} className="flex items-center justify-between gap-3 px-1 py-2.5 hover:bg-gray-50 dark:hover:bg-dark-600/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-50">{o.code} · {o.name}</p>
                  <p className="text-xs text-gray-400">{o.perspective ?? "—"} · {o.linkedMetricIds.length} KPI liên kết</p>
                </div>
                <Badge tone={statusTone[o.status] ?? "neutral"}>{o.status}</Badge>
              </Link>
            </li>
          ))}
          {items.length === 0 && <li className="py-3 text-sm text-gray-400">Chưa có mục tiêu — chạy npm run seed:manage</li>}
        </ul>
      </SectionCard>
    </div>
  );
}
