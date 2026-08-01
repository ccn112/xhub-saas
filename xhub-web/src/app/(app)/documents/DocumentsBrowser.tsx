"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import { Pagination } from "@/xhub/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { UploadDocumentDrawer } from "./UploadDocumentDrawer";
import { kindMeta } from "@/features/documents/kinds";
import { dateTimeVN } from "@/xhub/lib/format";

export interface DocRow {
  id: string;
  title: string;
  kind: string;
  tags: string[];
  subjectType?: string | null;
  subjectId?: string | null;
  createdAt: string;
}

export function DocumentsBrowser({ docs, live }: { docs: DocRow[]; live: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [kind, setKind] = useState("");
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [uploadOpen, setUploadOpen] = useState(false);

  const kinds = useMemo(() => [...new Set(docs.map((d) => d.kind))], [docs]);
  const tags = useMemo(() => [...new Set(docs.flatMap((d) => d.tags))].sort(), [docs]);

  const filtered = useMemo(
    () =>
      docs.filter(
        (d) =>
          (!kind || d.kind === kind) &&
          (!tag || d.tags.includes(tag)) &&
          (!q || d.title.toLowerCase().includes(q.toLowerCase())),
      ),
    [docs, kind, tag, q],
  );

  useEffect(() => { setPage(1); }, [kind, tag, q]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
    [filtered, page, pageSize],
  );

  const inputCls = "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-dark-500 dark:bg-dark-700 dark:text-dark-100";

  const columns: Column<DocRow>[] = [
    {
      key: "doc",
      header: "Tài liệu",
      cell: (d) => {
        const m = kindMeta(d.kind);
        return (
          <div className="flex items-center gap-2">
            <span className="text-lg">{m.icon}</span>
            <div className="min-w-0">
              <Link href={`/documents/${d.id}`} className="truncate font-medium text-gray-800 hover:text-primary-600 hover:underline dark:text-dark-100">
                {d.title}
              </Link>
              {d.tags.length ? (
                <p className="truncate text-xs text-gray-400">{d.tags.map((t) => `#${t}`).join(" ")}</p>
              ) : null}
            </div>
          </div>
        );
      },
    },
    { key: "kind", header: "Loại", cell: (d) => <Badge tone={kindMeta(d.kind).tone}>{kindMeta(d.kind).label}</Badge> },
    { key: "subject", header: "Gắn với", cell: (d) => (d.subjectType ? `${d.subjectType}: ${d.subjectId}` : "—") },
    { key: "created", header: "Tạo lúc", cell: (d) => dateTimeVN(d.createdAt) },
    {
      key: "actions",
      header: "",
      cell: (d) => (
        <Link href={`/documents/${d.id}`} className="text-sm text-primary-600 hover:underline">Chi tiết →</Link>
      ),
    },
  ];

  return (
    <>
      <SectionCard
        accent="neutral"
        title="Kho tài liệu"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input className={inputCls} placeholder="Tìm theo tiêu đề…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm tài liệu" />
            <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Lọc theo loại">
              <option value="">Tất cả loại</option>
              {kinds.map((k) => <option key={k} value={k}>{kindMeta(k).label}</option>)}
            </select>
            <select className={inputCls} value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Lọc theo thẻ">
              <option value="">Tất cả thẻ</option>
              {tags.map((t) => <option key={t} value={t}>#{t}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              + Tải tài liệu
            </button>
          </div>
        }
        bodyClassName="p-0"
      >
        <DataTable
          columns={columns}
          rows={paged}
          rowKey={(d) => d.id}
          minWidthClass="min-w-[760px]"
          empty={<span className="text-gray-400">Chưa có tài liệu nào. Nhấn “Tải tài liệu” để tạo mới.</span>}
        />
        {filtered.length > 0 ? (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        ) : null}
      </SectionCard>

      <UploadDocumentDrawer
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        live={live}
        onCreated={(id) => {
          setUploadOpen(false);
          toast.success("Đã tạo tài liệu mới");
          if (id) router.push(`/documents/${id}`);
          else router.refresh();
        }}
      />
    </>
  );
}
