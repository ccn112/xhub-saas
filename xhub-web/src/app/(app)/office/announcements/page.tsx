import { Badge } from "@/xhub/ui/Badge";
import { listAnnouncements } from "@/xoffice/lib/announcements-data";
import { AnnouncementsClient } from "@/xoffice/announcements/AnnouncementsClient";

export const metadata = { title: "Thông báo nội bộ · X.Office" };

// Always render fresh runtime state (backend state changes per action).
export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const { items, source, ctx } = await listAnnouncements({ scope: "all", pageSize: 200 });
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>
      <AnnouncementsClient rows={items} basePath="/office/announcements" currentUserId={ctx.userId} />
    </div>
  );
}
