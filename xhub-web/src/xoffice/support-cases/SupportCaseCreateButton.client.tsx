"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { FormDrawer } from "@/xhub/ui/form/FormDrawer";
import { FormSection } from "@/xhub/ui/form/FormSection";
import { SelectField, TextField, TextareaField } from "@/xhub/ui/form/Fields";
import {
  SUPPORT_CASE_CATEGORY_LABEL,
  SUPPORT_CASE_CHANNEL_LABEL,
  SUPPORT_CASE_PRIORITY_LABEL,
} from "@/xoffice/lib/support-cases-data";

const PRODUCTS = [
  { value: "PRD-X2", label: "X2 — Quản lý chung cư" },
  { value: "PRD-X1", label: "X1 — XBooking" },
  { value: "PRD-FINERP", label: "FinERP" },
  { value: "PRD-XSPACE", label: "X.Space" },
];

const EMPTY = { title: "", description: "", productCode: "PRD-X2", category: "OPERATION_SUPPORT", channel: "ZALO", priority: "MEDIUM", requesterName: "", requesterContact: "" };

/**
 * "Tạo case mới" — a simple single-page-style form in a drawer (not a
 * wizard): every field is independent, entry is frequent/low-friction, no
 * sequential dependency between steps — matches the locked pattern rule
 * (docs/design-system/TAILUX_PAGE_PATTERNS.md "Quy tắc chọn pattern" #2).
 */
export function SupportCaseCreateButton() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/support-cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.message ?? "Không tạo được case — kiểm tra lại thông tin.");
        return;
      }
      toast.success("Đã tạo case hỗ trợ mới.");
      setForm(EMPTY);
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        + Ghi nhận case mới
      </button>
      <FormDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Ghi nhận case hỗ trợ khách hàng"
        description="Dùng cho ý kiến/hỗ trợ khách hàng về sản phẩm X2, X1, FinERP, X.Space — không phải yêu cầu nội bộ (Service Desk)."
        onSubmit={submit}
        submitting={submitting}
        submitDisabled={!form.title.trim()}
        submitLabel="Ghi nhận case"
      >
        <FormSection>
          <TextField label="Tiêu đề" required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ví dụ: Đổi số hotline Ban Quản lý" />
          <TextareaField label="Mô tả" value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} placeholder="Nội dung trao đổi, số liệu, link tài liệu liên quan..." />
        </FormSection>
        <FormSection title="Phân loại">
          <SelectField label="Sản phẩm" value={form.productCode} onChange={(e) => set("productCode", e.target.value)} options={PRODUCTS} />
          <SelectField
            label="Loại yêu cầu"
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            options={Object.entries(SUPPORT_CASE_CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <SelectField
            label="Mức độ ưu tiên"
            value={form.priority}
            onChange={(e) => set("priority", e.target.value)}
            options={Object.entries(SUPPORT_CASE_PRIORITY_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <SelectField
            label="Kênh nhận"
            value={form.channel}
            onChange={(e) => set("channel", e.target.value)}
            options={Object.entries(SUPPORT_CASE_CHANNEL_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </FormSection>
        <FormSection title="Người yêu cầu (khách hàng)">
          <TextField label="Tên / đơn vị" value={form.requesterName} onChange={(e) => set("requesterName", e.target.value)} placeholder="Ví dụ: Ban Quản lý toà nhà" />
          <TextField label="Liên hệ" value={form.requesterContact} onChange={(e) => set("requesterContact", e.target.value)} placeholder="Số điện thoại, nhóm Zalo, email..." />
        </FormSection>
      </FormDrawer>
    </>
  );
}
