import { Badge } from "@/xhub/ui/Badge";
import { listWorkItems, listWorkDimensions } from "@/xoffice/lib/work-items-data";
import { WorkListClient } from "@/xoffice/work/WorkListClient";

export const metadata = { title: "Tôi giao · XHub" };
export const dynamic = "force-dynamic";

// WK-02b — Tôi giao (created by me — the ones I assigned out).
export default async function AssignedByMePage() {
  const [{ items, source }, dimensions] = await Promise.all([
    listWorkItems({ scope: "created", pageSize: 500 }),
    listWorkDimensions(),
  ]);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>
      <WorkListClient rows={items} dimensions={dimensions} title="Tôi giao" subtitle="công việc do tôi tạo / giao cho người khác" />
    </div>
  );
}
