import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { getSeedPack, CATALOG_STATUS_TONES } from "@/xhub/platform/platform-data";
import { PublishCatalogButton } from "@/xhub/platform/PublishCatalogButton";

export const dynamic = "force-dynamic";

export default async function SeedPackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { seedPack } = await getSeedPack(id);
  if (!seedPack) notFound();

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
          <Link href="/platform/seed-packs" className="text-sm text-primary-600 hover:underline dark:text-primary-400">← Seed Pack Catalog</Link>
          <h1 className="mt-1 font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">
            {seedPack.code} · v{seedPack.version}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">{seedPack.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={CATALOG_STATUS_TONES[seedPack.status] ?? "neutral"}>{seedPack.status}</Badge>
          <PublishCatalogButton kind="seed-packs" id={seedPack.id} status={seedPack.status} />
        </div>
      </div>

      <Card className="space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {field("Blueprint", seedPack.blueprintCode ?? "—")}
          {field("Dependencies", seedPack.dependencies)}
          {field("Checksum", seedPack.checksum)}
          {field("Published at", seedPack.publishedAt ?? "—")}
        </div>
        {field("Datasets (manifest tham số hoá theo tenant)", seedPack.datasets)}
      </Card>
    </div>
  );
}
