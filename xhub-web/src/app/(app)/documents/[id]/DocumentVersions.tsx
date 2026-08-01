"use client";

// Version history timeline (immutable, newest first) + per-version "Tải nội dung"
// (through the BFF content proxy) + "Phiên bản mới" drawer that appends a version.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { FormDrawer } from "@/xhub/ui/form/FormDrawer";
import { FormSection } from "@/xhub/ui/form/FormSection";
import { TextareaField } from "@/xhub/ui/form/Fields";
import { useToast } from "@/components/ui/Toast";
import { fmtBytes } from "@/features/documents/kinds";
import { dateTimeVN } from "@/xhub/lib/format";

export interface VersionItem {
  id: string;
  versionNo: number;
  contentHash: string;
  byteSize: number;
  mimeType: string;
  author: string;
  createdAt: string;
}

const MAX_BYTES = 512 * 1024;

function b64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || "application/octet-stream" });
}

export function DocumentVersions({
  documentId, versions, live,
}: {
  documentId: string;
  versions: VersionItem[];
  live: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);

  const ordered = [...versions].sort((a, b) => b.versionNo - a.versionNo);
  const maxNo = ordered.length ? ordered[0].versionNo : 0;

  async function download(versionNo: number) {
    if (!live) { toast.error("Chỉ tải được nội dung khi kết nối trực tiếp"); return; }
    setDownloading(versionNo);
    try {
      const res = await fetch(`/api/records/${documentId}/versions/${versionNo}/content`);
      if (!res.ok) { toast.error("Không tải được nội dung"); return; }
      const data = await res.json();
      const blob = b64ToBlob(data.contentBase64 ?? "", data.mimeType ?? "application/octet-stream");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${documentId}-v${versionNo}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Không kết nối được máy chủ");
    } finally {
      setDownloading(null);
    }
  }

  function readFileBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = String(reader.result);
        const c = r.indexOf(",");
        resolve(c >= 0 ? r.slice(c + 1) : r);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(f);
    });
  }

  async function submitVersion() {
    if (!file && !content.trim()) { toast.error("Nhập nội dung hoặc chọn tệp"); return; }
    if (file && file.size > MAX_BYTES) { toast.error("Tệp vượt quá 512 KB"); return; }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      if (file) {
        payload.contentBase64 = await readFileBase64(file);
        payload.mimeType = file.type || "application/octet-stream";
      } else {
        payload.content = content;
        payload.mimeType = "text/plain";
      }
      const res = await fetch(`/api/records/${documentId}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.detail?.message ? String(err.detail.message) : "Thêm phiên bản thất bại");
        return;
      }
      const data = await res.json();
      setAddOpen(false); setContent(""); setFile(null);
      toast.success(data?.version?.deduped ? "Đã thêm phiên bản (nội dung trùng — dedup)" : `Đã thêm phiên bản v${data?.version?.versionNo}`);
      router.refresh();
    } catch {
      toast.error("Không kết nối được máy chủ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SectionCard
        accent="neutral"
        title="Lịch sử phiên bản"
        action={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            + Phiên bản mới
          </button>
        }
      >
        {ordered.length === 0 ? (
          <p className="text-sm text-gray-400">Chưa có phiên bản.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-gray-200 pl-5 dark:border-dark-500">
            {ordered.map((v) => (
              <li key={v.id} className="relative">
                <span className="absolute -left-[27px] top-1 flex size-4 items-center justify-center rounded-full border-2 border-white bg-primary-600 dark:border-dark-700" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading text-sm font-semibold text-gray-800 dark:text-dark-50">Phiên bản v{v.versionNo}</span>
                  {v.versionNo === maxNo ? <Badge tone="success">Hiện hành</Badge> : <Badge tone="neutral">Cũ (bất biến)</Badge>}
                  <button
                    type="button"
                    onClick={() => download(v.versionNo)}
                    disabled={downloading === v.versionNo}
                    className="ml-auto rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-dark-500 dark:text-dark-100 dark:hover:bg-dark-600"
                  >
                    {downloading === v.versionNo ? "Đang tải…" : "Tải nội dung"}
                  </button>
                </div>
                <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-500 dark:text-dark-300 sm:grid-cols-4">
                  <div><dt className="inline text-gray-400">Kích thước: </dt><dd className="inline">{fmtBytes(v.byteSize)}</dd></div>
                  <div><dt className="inline text-gray-400">Loại: </dt><dd className="inline">{v.mimeType}</dd></div>
                  <div><dt className="inline text-gray-400">Người tạo: </dt><dd className="inline">{v.author}</dd></div>
                  <div><dt className="inline text-gray-400">Thời gian: </dt><dd className="inline">{dateTimeVN(v.createdAt)}</dd></div>
                </dl>
                <p className="mt-0.5 truncate font-mono text-[11px] text-gray-400" title={v.contentHash}>sha256: {v.contentHash.slice(0, 24)}…</p>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      <FormDrawer
        open={addOpen}
        onClose={() => { if (!submitting) { setAddOpen(false); setContent(""); setFile(null); } }}
        title="Phiên bản mới"
        description="Thêm một phiên bản bất biến vào tài liệu này (versionNo tự tăng, dedup theo nội dung)."
        submitLabel="Thêm phiên bản"
        submitting={submitting}
        onSubmit={submitVersion}
        footnote={live ? undefined : <p className="text-xs text-warning">Backend chưa sẵn — nếu lỗi sẽ báo và không lưu.</p>}
      >
        <FormSection title="Nội dung" description="Nhập trực tiếp hoặc chọn tệp (tối đa 512 KB).">
          <TextareaField
            label="Nội dung văn bản"
            name="content"
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={!!file}
            placeholder="Nội dung phiên bản mới…"
          />
          <div className="space-y-1.5">
            <label htmlFor="ver-file" className="block text-sm font-medium text-gray-700 dark:text-dark-100">Hoặc chọn tệp</label>
            <input
              id="ver-file"
              type="file"
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-primary-700 dark:text-dark-200"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? <p className="text-xs text-gray-400">{file.name} · {(file.size / 1024).toFixed(0)} KB</p> : null}
          </div>
        </FormSection>
      </FormDrawer>
    </>
  );
}
