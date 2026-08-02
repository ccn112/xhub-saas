import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { listRequests } from "@/xoffice/lib/requests-data";
import { RequestsClient } from "@/xoffice/requests/RequestsClient";

export const metadata = { title: "Yêu cầu của tôi · X.Office" };

export const dynamic = "force-dynamic";

export default async function MyRequestsPage() {
  const { items, source } = await listRequests({ scope: "mine" });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/office/my-requests/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 text-sm font-medium text-white transition hover:bg-primary-700"
        >
          <span aria-hidden>+</span> Tạo yêu cầu mới
        </Link>
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>
      <RequestsClient rows={items} basePath="/office/requests" heading="Yêu cầu của tôi" />
    </div>
  );
}
