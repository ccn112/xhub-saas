import { Badge } from "@/xhub/ui/Badge";
import { listTickets, listServiceCatalog } from "@/xoffice/lib/tickets-data";
import { TicketsClient } from "@/xoffice/tickets/TicketsClient";

export const metadata = { title: "Yêu cầu hỗ trợ · X.Office" };

// Always render fresh runtime state (backend state changes per action).
export const dynamic = "force-dynamic";

export default async function ServiceDeskPage() {
  const [{ items, source, ctx }, { items: catalog }] = await Promise.all([
    listTickets({ scope: "all", pageSize: 100 }),
    listServiceCatalog(),
  ]);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>
      <TicketsClient rows={items} catalog={catalog} basePath="/office/service-desk" currentUserId={ctx.userId} />
    </div>
  );
}
