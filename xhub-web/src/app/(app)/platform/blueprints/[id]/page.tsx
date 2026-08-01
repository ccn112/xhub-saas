import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { getBlueprint, CATALOG_STATUS_TONES } from "@/xhub/platform/platform-data";
import { PublishCatalogButton } from "@/xhub/platform/PublishCatalogButton";

export const dynamic = "force-dynamic";

export default async function BlueprintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { blueprint } = await getBlueprint(id);
  if (!blueprint) notFound();

  const field = (label: string, value: unknown) => (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-dark-600">
      <div className="text-xs text-gray-500 dark:text-dark-300">{label}</div>
      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-xs text-gray-700 dark:text-dark-100">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/platform/blueprints" className="text-sm text-primary-600 hover:underline dark:text-primary-400">← Blueprint Catalog</Link>
          <h1 className="mt-1 font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">
            {blueprint.code} · v{blueprint.version}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">{blueprint.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={CATALOG_STATUS_TONES[blueprint.status] ?? "neutral"}>{blueprint.status}</Badge>
          <PublishCatalogButton kind="blueprints" id={blueprint.id} status={blueprint.status} />
        </div>
      </div>

      <Card className="space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {field("Ngành", blueprint.industry ?? "—")}
          {field("Kế thừa (inheritsCode)", blueprint.inheritsCode ?? "—")}
          {field("Apps enabled", blueprint.appsEnabled)}
          {field("Compatible plans", blueprint.compatiblePlans)}
          {field("Checksum", blueprint.checksum)}
          {field("Published at", blueprint.publishedAt ?? "—")}
        </div>
        {field("Role set", blueprint.roleSet)}
        {field("Org template", blueprint.orgTemplate)}
        {field("Workflow set", blueprint.workflowSet)}
        {field("Menu entitlement", blueprint.menuEntitlement)}
      </Card>
    </div>
  );
}
