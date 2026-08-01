import { notFound } from "next/navigation";
import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { DefRow } from "@/features/tenant-admin/AdminHeader";
import { fetchDocument } from "@/features/documents/records.server";
import { kindMeta, fmtBytes } from "@/features/documents/kinds";
import { dateTimeVN } from "@/xhub/lib/format";
import { userName } from "@/xhub/lib/repo";
import { DocumentVersions } from "./DocumentVersions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { detail } = await fetchDocument(id);
  return { title: `${detail?.document.title ?? id} · Tài liệu · XHub` };
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { source, detail } = await fetchDocument(id);
  if (!detail) notFound();

  const { document: doc, versions } = detail;
  const live = source === "live";
  const m = kindMeta(doc.kind);
  const totalBytes = versions.reduce((s, v) => s + (v.byteSize ?? 0), 0);
  const latest = versions.reduce((a, b) => (b.versionNo > a.versionNo ? b : a), versions[0]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/documents" className="mb-1 inline-block text-sm text-primary-600 hover:underline">← Tài liệu</Link>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">
            <span className="mr-2">{m.icon}</span>{doc.title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">{doc.id}</p>
        </div>
        <Badge tone={live ? "success" : "warning"}>{live ? "Trực tiếp (/api/records)" : "Dữ liệu demo"}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Loại" value={m.label} icon={m.icon} tone={m.tone} />
        <StatCard label="Số phiên bản" value={String(versions.length)} icon="🧬" tone="info" />
        <StatCard label="Dung lượng" value={fmtBytes(totalBytes)} icon="🗄️" tone="neutral" />
        <StatCard label="Bản hiện hành" value={latest ? `v${latest.versionNo}` : "—"} icon="⭐" tone="primary" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard accent="neutral" title="Thông tin" className="xl:col-span-1">
          <dl className="space-y-2 text-sm">
            <DefRow label="Loại" value={<Badge tone={m.tone}>{m.label}</Badge>} />
            <DefRow label="Gắn với" value={doc.subjectType ? `${doc.subjectType}: ${doc.subjectId}` : "—"} />
            <DefRow label="Tạo lúc" value={dateTimeVN(doc.createdAt)} />
            <DefRow label="Thẻ" value={doc.tags.length ? <span className="flex flex-wrap justify-end gap-1">{doc.tags.map((t) => <Badge key={t} tone="neutral">#{t}</Badge>)}</span> : "—"} />
          </dl>
        </SectionCard>

        <div className="xl:col-span-2">
          <DocumentVersions
            documentId={doc.id}
            live={live}
            versions={versions.map((v) => ({
              id: v.id,
              versionNo: v.versionNo,
              contentHash: v.contentHash,
              byteSize: v.byteSize,
              mimeType: v.mimeType,
              author: userName(v.createdBy ?? undefined),
              createdAt: v.createdAt,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
