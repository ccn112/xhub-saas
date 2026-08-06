"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/xhub/ui/ConfirmDialog";
import { FormDrawer } from "@/xhub/ui/form/FormDrawer";
import { FormSection } from "@/xhub/ui/form/FormSection";
import { SelectField, TextareaField } from "@/xhub/ui/form/Fields";
import { SUPPORT_CASE_ACTION_LABEL } from "@/xoffice/lib/support-cases-data";

const BACKLOG_TYPES = [
  { value: "FEATURE", label: "Tính năng mới" },
  { value: "UPGRADE_MIGRATION", label: "Nâng cấp / migration" },
  { value: "TECH_DEBT", label: "Nợ kỹ thuật" },
  { value: "TASK", label: "Việc kỹ thuật khác" },
];
const SEVERITIES = [
  { value: "P0", label: "P0 — Nghiêm trọng" },
  { value: "P1", label: "P1 — Cao" },
  { value: "P2", label: "P2 — Trung bình" },
  { value: "P3", label: "P3 — Thấp" },
];

/**
 * Interactive actions on the Support Case detail page (2026-08-06): FSM
 * transition buttons (from `legalActions`), a comment box, and the escalate
 * action — the point of this module. Escalate opens a form (pick BACKLOG or
 * DEFECT + a couple of fields), then a plain ConfirmDialog (this is not a
 * delete/financial action, so no typed-confirmation gate per the locked
 * design rule) before actually filing the cross-process request. POSTs
 * through /api/support-cases/[[...path]], then router.refresh() — same
 * pattern as CustomerActions.client.tsx.
 */
export function SupportCaseActions({
  caseId, legalActions, alreadyEscalated,
}: { caseId: string; legalActions: string[]; alreadyEscalated: { type: string; code: string | null } | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [comment, setComment] = useState("");
  const [showEscalate, setShowEscalate] = useState(false);
  const [confirmEscalate, setConfirmEscalate] = useState(false);
  const [escType, setEscType] = useState<"BACKLOG" | "DEFECT">("BACKLOG");
  const [escBacklogType, setEscBacklogType] = useState("FEATURE");
  const [escSeverity, setEscSeverity] = useState("P2");
  const [escNote, setEscNote] = useState("");

  async function act(action: string) {
    setPending(true);
    try {
      const res = await fetch(`/api/support-cases/${caseId}/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!res.ok) { toast.error(`Không thể ${SUPPORT_CASE_ACTION_LABEL[action] ?? action} — server báo lỗi.`); return; }
      toast.success(`${SUPPORT_CASE_ACTION_LABEL[action] ?? action} thành công.`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function submitComment() {
    if (!comment.trim()) return;
    setPending(true);
    try {
      await fetch(`/api/support-cases/${caseId}/comment`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: comment, visibility: "INTERNAL" }),
      });
      setComment("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function doEscalate() {
    const res = await fetch(`/api/support-cases/${caseId}/escalate`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: escType,
        description: escNote || undefined,
        ...(escType === "BACKLOG" ? { backlogType: escBacklogType } : { severity: escSeverity }),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body?.message ?? "Chuyển kỹ thuật thất bại — kiểm tra lại sản phẩm/quyền.");
      throw new Error("escalate failed");
    }
    const data = await res.json();
    toast.success(`Đã tạo ${escType === "BACKLOG" ? "Backlog" : "Defect"} ${data?.escalated?.code ?? ""} trên Engineering Hub.`);
    setShowEscalate(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {alreadyEscalated ? (
        <div className="rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300">
          Đã chuyển kỹ thuật: <span className="font-medium">{alreadyEscalated.type === "BACKLOG" ? "Backlog" : "Defect"} {alreadyEscalated.code}</span> trên Engineering Governance Hub.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {legalActions.map((a) => (
          <button
            key={a}
            type="button"
            disabled={pending}
            onClick={() => act(a)}
            className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-gray-300 disabled:opacity-40 dark:border-dark-600 dark:text-dark-200"
          >
            {SUPPORT_CASE_ACTION_LABEL[a] ?? a}
          </button>
        ))}
        {!alreadyEscalated ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowEscalate(true)}
            className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-medium text-warning-darker hover:bg-warning/20 disabled:opacity-40"
          >
            ⤴ Chuyển Backlog / Defect
          </button>
        ) : null}
      </div>

      <div className="flex items-end gap-2">
        <TextareaField
          label="Ghi chú nội bộ"
          placeholder="Ghi chú xử lý (chỉ nội bộ thấy)..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="flex-1"
        />
        <button
          type="button"
          disabled={pending || !comment.trim()}
          onClick={submitComment}
          className="mb-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-40"
        >
          Lưu
        </button>
      </div>

      <FormDrawer
        open={showEscalate}
        onClose={() => setShowEscalate(false)}
        title="Chuyển thành Backlog / Defect"
        description="Case này cần nâng cấp phần mềm — chuyển sang Engineering Governance Hub để theo dõi vòng đời kỹ thuật."
        onSubmit={() => setConfirmEscalate(true)}
        submitLabel="Xem lại & xác nhận"
      >
        <FormSection title="Loại chuyển">
          <SelectField
            label="Chuyển thành"
            value={escType}
            onChange={(e) => setEscType(e.target.value as "BACKLOG" | "DEFECT")}
            options={[
              { value: "BACKLOG", label: "Backlog — tính năng / nâng cấp" },
              { value: "DEFECT", label: "Defect — lỗi phần mềm" },
            ]}
          />
          {escType === "BACKLOG" ? (
            <SelectField label="Loại backlog" value={escBacklogType} onChange={(e) => setEscBacklogType(e.target.value)} options={BACKLOG_TYPES} />
          ) : (
            <SelectField label="Mức độ nghiêm trọng" value={escSeverity} onChange={(e) => setEscSeverity(e.target.value)} options={SEVERITIES} />
          )}
          <TextareaField label="Mô tả kỹ thuật (tuỳ chọn)" hint="Để trống sẽ dùng nội dung case." value={escNote} onChange={(e) => setEscNote(e.target.value)} rows={3} />
        </FormSection>
      </FormDrawer>

      <ConfirmDialog
        open={confirmEscalate}
        onClose={() => setConfirmEscalate(false)}
        onConfirm={doEscalate}
        tone="warning"
        title={`Chuyển case thành ${escType === "BACKLOG" ? "Backlog" : "Defect"}?`}
        description="Hành động này tạo một mục mới trên Engineering Governance Hub (Platform), liên kết ngược lại case này. Không thể tự hoàn tác — cần đóng thủ công trên Engineering Hub nếu tạo nhầm."
        confirmLabel="Chuyển kỹ thuật"
      />
    </div>
  );
}
