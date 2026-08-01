import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { fetchDocuments } from "@/features/documents/records.server";
import { fmtBytes } from "@/features/documents/kinds";
import { DocumentsBrowser, type DocRow } from "./DocumentsBrowser";

export const metadata = { title: "Tài liệu · XHub" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const { source, documents, versionCount, byteSize } = await fetchDocuments();
  const live = source === "live";

  const rows: DocRow[] = documents.map((d) => ({
    id: d.id,
    title: d.title,
    kind: d.kind,
    tags: d.tags,
    subjectType: d.subjectType,
    subjectId: d.subjectId,
    createdAt: d.createdAt,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Tài liệu</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">Kho tài liệu có phiên bản — tạo mới, thêm phiên bản, xem lịch sử.</p>
        </div>
        <Badge tone={live ? "success" : "warning"}>
          {live ? "Kho tài liệu trực tiếp (/api/records)" : "Backend chưa sẵn — dữ liệu demo"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tổng tài liệu" value={String(documents.length)} icon="🗂️" tone="primary" />
        <StatCard label="Phiên bản" value={String(versionCount)} icon="🧬" tone="info" sub={live ? "gồm mọi phiên bản bất biến" : undefined} />
        <StatCard label="Dung lượng" value={byteSize ? fmtBytes(byteSize) : "—"} icon="🗄️" tone="neutral" />
        <StatCard label="Nguồn" value={live ? "Trực tiếp" : "Demo"} icon={live ? "🟢" : "🟡"} tone={live ? "success" : "warning"} />
      </div>

      <DocumentsBrowser docs={rows} live={live} />
    </div>
  );
}
