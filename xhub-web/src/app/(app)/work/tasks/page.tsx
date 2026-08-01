import { Badge } from "@/xhub/ui/Badge";
import { listWorkItems, listWorkDimensions } from "@/xoffice/lib/work-items-data";
import { WorkListClient } from "@/xoffice/work/WorkListClient";

export const metadata = { title: "Việc của tôi · XHub" };
export const dynamic = "force-dynamic";

// WK-02 — Việc của tôi (assignee/owner/creator = me).
export default async function MyTasksPage() {
  const [{ items, source }, dimensions] = await Promise.all([
    listWorkItems({ scope: "mine", pageSize: 500 }),
    listWorkDimensions(),
  ]);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>
      <WorkListClient rows={items} dimensions={dimensions} title="Việc của tôi" subtitle="công việc tôi phụ trách, được giao hoặc tạo" />
    </div>
  );
}
