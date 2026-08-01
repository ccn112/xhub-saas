import { Badge } from "@/xhub/ui/Badge";
import { listWorkDimensions } from "@/xoffice/lib/work-items-data";
import { getWorkStats } from "@/xoffice/lib/work-stats-data";
import { ReportsClient } from "@/xoffice/work/ReportsClient";

export const metadata = { title: "Báo cáo đa chiều · XHub" };
export const dynamic = "force-dynamic";

// Multi-dimensional statistics (W3, WK-12, owner requirement #2). Pick a group-by
// (any tag or tenant dimension: Loại việc/Giai đoạn/Nhóm chi phí/Bộ phận) + a
// metric (count / avg progress / overdue), optionally cross-tabbed by a second
// axis → a pivot table + chart. Reads GET /api/work/stats.
export default async function WorkReportsPage() {
  const dimensions = await listWorkDimensions();
  const firstGroupBy = dimensions.length ? `dimension:${dimensions[0].key}` : "status";
  const { stats, source } = await getWorkStats({ groupBy: firstGroupBy, metric: "count" });
  return (
    <div className="space-y-3">
      {source !== "api" && (
        <div className="flex justify-end">
          <Badge tone="warning">Backend offline</Badge>
        </div>
      )}
      <ReportsClient dimensions={dimensions} initialGroupBy={firstGroupBy} initialStats={stats} />
    </div>
  );
}
