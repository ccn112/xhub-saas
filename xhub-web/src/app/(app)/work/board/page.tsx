import { Badge } from "@/xhub/ui/Badge";
import { listWorkItems, listWorkDimensions } from "@/xoffice/lib/work-items-data";
import { KanbanClient } from "@/xoffice/work/KanbanClient";

export const metadata = { title: "Kanban · XHub" };
export const dynamic = "force-dynamic";

// Kanban board (W3, WK-04). Columns by NativeWorkItem status; drag a card to
// change status (optimistic → server FSM validate → rollback on reject).
// Swimlanes group by any tag or dimension (owner requirement #2).
export default async function WorkBoardPage() {
  const [{ items, source }, dimensions] = await Promise.all([
    listWorkItems({ scope: "all", pageSize: 200 }),
    listWorkDimensions(),
  ]);
  return (
    <div className="space-y-3">
      {source !== "api" && (
        <div className="flex justify-end">
          <Badge tone="warning">Backend offline</Badge>
        </div>
      )}
      <KanbanClient rows={items} dimensions={dimensions} />
    </div>
  );
}
