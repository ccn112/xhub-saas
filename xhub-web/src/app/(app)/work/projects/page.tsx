import { Badge } from "@/xhub/ui/Badge";
import { listProjects } from "@/xoffice/lib/work-projects-data";
import { ProjectsListClient } from "@/xoffice/work/ProjectsListClient";

export const metadata = { title: "Dự án thực thi · XHub" };
export const dynamic = "force-dynamic";

// Execution Project list (W2). Live over the tenant's ExecutionProjects. Degrades
// to an empty state with an offline badge when the backend is down (no fake data).
export default async function WorkProjectsPage() {
  const { items, source } = await listProjects({ pageSize: 200 });
  return (
    <div className="space-y-3">
      {source !== "api" && (
        <div className="flex justify-end">
          <Badge tone="warning">Backend offline</Badge>
        </div>
      )}
      <ProjectsListClient rows={items} />
    </div>
  );
}
