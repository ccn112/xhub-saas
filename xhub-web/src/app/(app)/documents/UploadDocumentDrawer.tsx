"use client";

// "Tải tài liệu" — creates a document (+ first version) via POST proxied to
// /api/records. Content may be typed (textarea) or a small file read to base64
// in the browser. FE never touches the DB — always via the proxy → xhub-api.
import { useState } from "react";
import { FormDrawer } from "@/xhub/ui/form/FormDrawer";
import { FormSection } from "@/xhub/ui/form/FormSection";
import { TextField, TextareaField, SelectField } from "@/xhub/ui/form/Fields";
import { KIND_OPTIONS } from "@/features/documents/kinds";
import { useToast } from "@/components/ui/Toast";

const MAX_BYTES = 512 * 1024; // 512 KB cap for the in-browser base64 read.

function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result);
      const comma = res.indexOf(",");
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function UploadDocumentDrawer({
  open, onClose, live, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  live: boolean;
  onCreated: (id?: string) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("GENERIC");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setTitle(""); setKind("GENERIC"); setTags(""); setContent(""); setFile(null);
  }

  async function submit() {
    if (!title.trim()) { toast.error("Nhập tiêu đề tài liệu"); return; }
    if (!file && !content.trim()) { toast.error("Nhập nội dung hoặc chọn tệp"); return; }
    if (file && file.size > MAX_BYTES) { toast.error("Tệp vượt quá 512 KB"); return; }

    setSubmitting(true);
    try {
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      const payload: Record<string, unknown> = {
        title: title.trim(),
        kind,
        tags: tagList,
      };
      if (file) {
        payload.contentBase64 = await readFileBase64(file);
        payload.mimeType = file.type || "application/octet-stream";
      } else {
        payload.content = content;
        payload.mimeType = "text/plain";
      }

      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.detail?.message ? String(err.detail.message) : "Tạo tài liệu thất bại");
        return;
      }
      const data = await res.json();
      reset();
      onCreated(data?.document?.id);
    } catch {
      toast.error("Không kết nối được máy chủ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormDrawer
      open={open}
      onClose={() => { if (!submitting) { reset(); onClose(); } }}
      title="Tải tài liệu"
      description="Tạo tài liệu mới và phiên bản đầu tiên trong kho /api/records."
      submitLabel="Tạo tài liệu"
      submitting={submitting}
      onSubmit={submit}
      footnote={
        live ? (
          <p className="text-xs text-gray-400">Ghi trực tiếp vào kho tài liệu (BFF → xhub-api). Tệp tối đa 512 KB.</p>
        ) : (
          <p className="text-xs text-warning">Backend chưa sẵn — vẫn gửi qua proxy; nếu lỗi sẽ báo và không lưu.</p>
        )
      }
    >
      <FormSection title="Thông tin">
        <TextField label="Tiêu đề" name="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Biên bản họp kickoff…" />
        <SelectField label="Loại tài liệu" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} options={KIND_OPTIONS} />
        <TextField label="Thẻ (phân tách bởi dấu phẩy)" name="tags" value={tags} onChange={(e) => setTags(e.target.value)} hint="VD: minh-phat, bao-gia" />
      </FormSection>

      <FormSection title="Nội dung" description="Nhập trực tiếp hoặc chọn tệp (tối đa 512 KB).">
        <TextareaField
          label="Nội dung văn bản"
          name="content"
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={!!file}
          hint={file ? "Đang dùng tệp đính kèm — bỏ chọn tệp để nhập tay." : undefined}
          placeholder="Nội dung tài liệu…"
        />
        <div className="space-y-1.5">
          <label htmlFor="doc-file" className="block text-sm font-medium text-gray-700 dark:text-dark-100">Hoặc chọn tệp</label>
          <input
            id="doc-file"
            type="file"
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-primary-700 dark:text-dark-200"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <p className="text-xs text-gray-400">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>
          ) : null}
        </div>
      </FormSection>
    </FormDrawer>
  );
}
