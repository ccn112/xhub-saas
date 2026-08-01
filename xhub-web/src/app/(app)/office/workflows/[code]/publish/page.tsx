import Link from "next/link";
import { notFound } from "next/navigation";

import { getWorkflow } from "@/xoffice/lib/workflow-data";
import { getPublishSnapshot } from "@/xoffice/lib/publish-data";
import { PublishPanel } from "@/xoffice/publish/PublishPanel";

export const metadata = { title: "Publish & triển khai · X.Office" };
export const dynamic = "force-dynamic";

export default async function PublishPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { definition } = await getWorkflow(code);
  if (!definition) notFound();

  const snapshot = await getPublishSnapshot(code, definition);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link href={`/office/workflows/${code}/builder`} className="text-sm text-gray-400 transition hover:text-primary-600">
          ← Builder
        </Link>
        <span className="text-gray-300">/</span>
        <div className="flex-1">
          <h1 className="font-heading text-lg font-bold text-gray-800 dark:text-dark-50">
            Publish &amp; triển khai
          </h1>
          <p className="font-mono text-tiny text-gray-400">{definition.metadata.code}</p>
        </div>
        <Link href={`/office/workflows/${code}/versions`} className="text-sm text-primary-600 transition hover:text-primary-700">
          Phiên bản &amp; kiểm duyệt →
        </Link>
      </div>
      <PublishPanel code={code} definition={definition} snapshot={snapshot} />
    </div>
  );
}
