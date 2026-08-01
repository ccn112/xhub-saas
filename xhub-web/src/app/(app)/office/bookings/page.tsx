import { Badge } from "@/xhub/ui/Badge";
import { listBookings, listBookableResources } from "@/xoffice/lib/bookings-data";
import { BookingsClient } from "@/xoffice/bookings/BookingsClient";

export const metadata = { title: "Đặt phòng & tài nguyên · X.Office" };

// Always render fresh runtime state (backend state changes per action).
export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const [{ items, source, ctx }, { items: resources }] = await Promise.all([
    listBookings({ scope: "all", pageSize: 200 }),
    listBookableResources(),
  ]);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>
      <BookingsClient rows={items} resources={resources} basePath="/office/bookings" currentUserId={ctx.userId} />
    </div>
  );
}
