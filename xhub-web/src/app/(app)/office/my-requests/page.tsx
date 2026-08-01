import { Badge } from "@/xhub/ui/Badge";
import { listRequests } from "@/xoffice/lib/requests-data";
import { RequestsClient } from "@/xoffice/requests/RequestsClient";

export const metadata = { title: "Yêu cầu của tôi · X.Office" };

export const dynamic = "force-dynamic";

export default async function MyRequestsPage() {
  const { items, source } = await listRequests({ scope: "mine" });
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>
      <RequestsClient rows={items} basePath="/office/requests" heading="Yêu cầu của tôi" />
    </div>
  );
}
