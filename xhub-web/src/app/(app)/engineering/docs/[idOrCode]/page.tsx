import { notFound } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { MarkdownDoc } from "@/components/docs/MarkdownDoc";
import { getDocument, DOCUMENT_TYPE_LABEL, DOC_STATUS_TONE } from "@/xhub/engineering/engineering-data";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({ params }: { params: Promise<{ idOrCode: string }> }) {
  const { idOrCode } = await params;
  const { document, source } = await getDocument(idOrCode);
  if (source === "api" && !document) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">{document?.title ?? idOrCode}</h1>
          {document ? (
            <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
              {document.code} · {DOCUMENT_TYPE_LABEL[document.documentType] ?? document.documentType} · v{document.version} ·{" "}
              {document.classification}
            </p>
          ) : null}
        </div>
        {document ? <Badge tone={DOC_STATUS_TONE[document.status] ?? "neutral"}>{document.status}</Badge> : null}
      </div>

      {!document ? (
        <Card className="p-4 text-sm text-gray-400">Không tải được tài liệu (backend offline).</Card>
      ) : (
        <>
          {document.standardsRefs.length > 0 ? (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Tiêu chuẩn/khung áp dụng</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {document.standardsRefs.map((s) => (
                  <span key={s} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-dark-700 dark:text-dark-200">
                    {s}
                  </span>
                ))}
              </div>
            </Card>
          ) : null}

          <Card className="p-4">
            {document.body ? <MarkdownDoc markdown={document.body} /> : <p className="text-sm text-gray-400">Tài liệu chưa có nội dung.</p>}
          </Card>
        </>
      )}
    </div>
  );
}
