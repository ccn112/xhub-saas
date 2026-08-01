import Link from "next/link";
import { notFound } from "next/navigation";

import { getWorkflow } from "@/xoffice/lib/workflow-data";
import { getVersionHistory } from "@/xoffice/lib/versions-data";
import { VersionDiff } from "@/xoffice/versions/VersionDiff";

export const metadata = { title: "Phiên bản & kiểm duyệt · X.Office" };
export const dynamic = "force-dynamic";

export default async function VersionsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { definition } = await getWorkflow(code);
  if (!definition) notFound();

  const { versions, source } = await getVersionHistory(code, definition);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link href={`/office/workflows/${code}/builder`} className="text-sm text-gray-400 transition hover:text-primary-600">
          ← Builder
        </Link>
        <span className="text-gray-300">/</span>
        <div className="flex-1">
          <h1 className="font-heading text-lg font-bold text-gray-800 dark:text-dark-50">
            Phiên bản & kiểm duyệt
          </h1>
          <p className="font-mono text-tiny text-gray-400">{definition.metadata.code}</p>
        </div>
        <Link href={`/office/workflows/${code}/publish`} className="text-sm text-primary-600 transition hover:text-primary-700">
          Publish & triển khai →
        </Link>
      </div>
      <VersionDiff code={code} history={versions} source={source} />
    </div>
  );
}
