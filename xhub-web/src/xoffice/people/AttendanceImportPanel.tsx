"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import type { AttendanceImportBatch } from "@/xoffice/lib/people-data";

const TEMPLATE = "personId,date,clockIn,clockOut\nusr-cfo,2026-08-03,08:30,17:35\n";

/**
 * PE-02 import engine UI — two-step "Excel Bridge": preview (parse+validate,
 * nothing written) → commit (writes AttendanceEvent) → rollback (reverses
 * exactly what that batch wrote). Re-uploading an identical file is rejected
 * (checksum dedup) rather than silently re-imported.
 */
export function AttendanceImportPanel({ batches }: { batches: AttendanceImportBatch[] }) {
  const toast = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<AttendanceImportBatch | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    const reader = new FileReader();
    reader.onload = () => setContent(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runPreview() {
    if (!content) {
      toast.show("Chọn file CSV trước.", "info");
      return;
    }
    setBusy("preview");
    try {
      const res = await fetch(`/api/people/imports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName, content }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const code = data?.detail?.code ?? data?.error;
        toast.show(code === "DUPLICATE_IMPORT" ? "File này đã được nhập trước đó (trùng nội dung)." : data?.detail?.message ?? "Không xem trước được.", "error");
        return;
      }
      setPreview(data);
      toast.show(`Xem trước: ${data.validRows}/${data.totalRows} dòng hợp lệ.`, data.errorRows > 0 ? "info" : "success");
    } catch {
      toast.show("Không kết nối được backend.", "info");
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    if (!preview) return;
    setBusy("commit");
    try {
      const res = await fetch(`/api/people/imports/${preview.id}/commit`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!res.ok) {
        toast.show("Không xác nhận nhập được.", "error");
        return;
      }
      toast.show("Đã ghi nhận chấm công.", "success");
      setPreview(null); setContent(""); setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      toast.show("Không kết nối được backend.", "info");
    } finally {
      setBusy(null);
    }
  }

  async function rollback(id: string) {
    setBusy(`rollback-${id}`);
    try {
      const res = await fetch(`/api/people/imports/${id}/rollback`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!res.ok) {
        toast.show("Không hoàn tác được.", "error");
        return;
      }
      toast.show("Đã hoàn tác đợt nhập.", "success");
      router.refresh();
    } catch {
      toast.show("Không kết nối được backend.", "info");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm" />
        <button type="button" onClick={downloadTemplate} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-200">
          Tải file mẫu
        </button>
        <button
          type="button"
          disabled={!content || busy !== null}
          onClick={runPreview}
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {busy === "preview" ? "Đang xem…" : "Xem trước"}
        </button>
      </div>

      {preview && (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-600">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-dark-700/50">
                <tr>
                  <th className="px-2 py-1 text-left">Dòng</th>
                  <th className="px-2 py-1 text-left">Người</th>
                  <th className="px-2 py-1 text-left">Ngày</th>
                  <th className="px-2 py-1 text-left">Vào</th>
                  <th className="px-2 py-1 text-left">Ra</th>
                  <th className="px-2 py-1 text-left">Lỗi</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((r) => (
                  <tr key={r.row} className={r.error ? "bg-error/5" : ""}>
                    <td className="px-2 py-1">{r.row}</td>
                    <td className="px-2 py-1">{r.personId}</td>
                    <td className="px-2 py-1">{r.date}</td>
                    <td className="px-2 py-1">{r.clockIn}</td>
                    <td className="px-2 py-1">{r.clockOut}</td>
                    <td className="px-2 py-1 text-error">{r.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy !== null || preview.validRows === 0}
              onClick={commit}
              className="rounded-lg bg-success/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-success disabled:opacity-50"
            >
              {busy === "commit" ? "Đang ghi…" : `Xác nhận nhập ${preview.validRows} dòng hợp lệ`}
            </button>
            <button type="button" onClick={() => setPreview(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 dark:border-dark-600 dark:text-dark-200">
              Huỷ
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Đợt nhập đã có ({batches.length})</p>
        <ul className="divide-y divide-gray-100 dark:divide-dark-600">
          {batches.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-800 dark:text-dark-50">{b.fileName} · {b.validRows}/{b.totalRows} hợp lệ</p>
                <p className="text-xs text-gray-400">{b.status} · {new Date(b.createdAt).toLocaleString("vi-VN")}</p>
              </div>
              {b.status === "COMMITTED" && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => rollback(b.id)}
                  className="shrink-0 rounded-lg border border-error/40 px-2 py-1 text-xs font-medium text-error hover:bg-error/10 disabled:opacity-50"
                >
                  {busy === `rollback-${b.id}` ? "…" : "Hoàn tác"}
                </button>
              )}
            </li>
          ))}
          {batches.length === 0 && <li className="py-2 text-sm text-gray-400">Chưa có đợt nhập nào.</li>}
        </ul>
      </div>
    </div>
  );
}
