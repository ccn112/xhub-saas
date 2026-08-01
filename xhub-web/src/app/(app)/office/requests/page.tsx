import { Badge } from "@/xhub/ui/Badge";
import { listRequests } from "@/xoffice/lib/requests-data";
import { RequestsClient } from "@/xoffice/requests/RequestsClient";

export const metadata = { title: "Trung tâm yêu cầu · X.Office" };

// Always render fresh runtime state (backend state changes per action).
export const dynamic = "force-dynamic";

export default async function RequestCenterPage() {
  const { items, source } = await listRequests({ scope: "all" });
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>
      <RequestsClient rows={items} basePath="/office/requests" heading="Trung tâm yêu cầu" />
    </div>
  );
}
