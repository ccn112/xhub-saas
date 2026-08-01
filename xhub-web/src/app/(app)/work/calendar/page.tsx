import { Badge } from "@/xhub/ui/Badge";
import { listWorkItems } from "@/xoffice/lib/work-items-data";
import { CalendarClient } from "@/xoffice/work/CalendarClient";

export const metadata = { title: "Lịch công việc · XHub" };
export const dynamic = "force-dynamic";

// Work calendar (W3, WK-05). Month view of work items by dueAt + milestone
// diamonds. Click an entry to open the item detail.
export default async function WorkCalendarPage() {
  const { items, source } = await listWorkItems({ scope: "all", pageSize: 200 });
  return (
    <div className="space-y-3">
      {source !== "api" && (
        <div className="flex justify-end">
          <Badge tone="warning">Backend offline</Badge>
        </div>
      )}
      <CalendarClient rows={items} />
    </div>
  );
}
