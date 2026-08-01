import { Badge } from "@/xhub/ui/Badge";
import { listDirectives } from "@/xoffice/lib/directives-data";
import { DirectivesClient } from "@/xoffice/directives/DirectivesClient";

export const metadata = { title: "Chỉ đạo & cam kết · X.Office" };

// Always render fresh runtime state (backend state changes per action).
export const dynamic = "force-dynamic";

export default async function DirectivesPage() {
  const { items, source, ctx } = await listDirectives({ scope: "all", pageSize: 100 });
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>
      <DirectivesClient rows={items} basePath="/office/directives" currentUserId={ctx.userId} />
    </div>
  );
}
