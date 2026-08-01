import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/xhub/ui/Badge";
import { getWorkflow, getNodeCatalog } from "@/xoffice/lib/workflow-data";
import { WorkflowBuilder } from "@/xoffice/builder/WorkflowBuilder";

export const metadata = { title: "Trình thiết kế quy trình · X.Office" };

export default async function WorkflowBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ ai?: string }>;
}) {
  const { code } = await params;
  const { ai } = await searchParams;

  const [{ definition, source }, catalog] = await Promise.all([
    getWorkflow(code),
    getNodeCatalog(),
  ]);

  if (!definition) notFound();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href="/office/workflows"
            className="text-sm text-gray-400 transition hover:text-primary-600"
          >
            Danh mục quy trình
          </Link>
          <span className="text-gray-300">/</span>
          <div>
            <h1 className="font-heading text-lg font-bold text-gray-800 dark:text-dark-50">
              {definition.metadata.name}
            </h1>
            <p className="font-mono text-tiny text-gray-400">{definition.metadata.code}</p>
          </div>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Dữ liệu seed (offline)"}
        </Badge>
      </div>

      <WorkflowBuilder
        definition={definition}
        catalog={catalog}
        source={source}
        openAiInitially={ai === "1"}
      />
    </div>
  );
}
