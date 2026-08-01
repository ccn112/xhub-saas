import { Badge } from "@/xhub/ui/Badge";
import { getPortfolio } from "@/xoffice/lib/work-projects-data";
import { PortfolioClient } from "@/xoffice/work/PortfolioClient";

export const metadata = { title: "Portfolio · XHub" };
export const dynamic = "force-dynamic";

// Portfolio cockpit (W3, WK-11). Read-only roll-up over the tenant's
// ExecutionProjects: health/status buckets + per-project overdue/blocked/progress.
// Degrades to an empty state with an offline badge when the backend is down.
export default async function WorkPortfolioPage() {
  const { portfolio, source } = await getPortfolio();
  return (
    <div className="space-y-3">
      {source !== "api" && (
        <div className="flex justify-end">
          <Badge tone="warning">Backend offline</Badge>
        </div>
      )}
      <PortfolioClient portfolio={portfolio} />
    </div>
  );
}
