"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import type { LeaveImpactPreview, LeavePolicyRef } from "@/xoffice/lib/people-data";

function newIdempotencyKey(): string {
  return `leave-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

/**
 * Create-leave form. Impact-preview is MANDATORY before submit (PE_UI_MOBILE_PLAN):
 * the form calls POST /api/people/leave-requests/impact-preview first and shows
 * what real work/approvals/bookings fall inside the window before the actual
 * submit is enabled — never a silent black-box request.
 */
export function LeaveRequestForm({ policies }: { policies: LeavePolicyRef[] }) {
  const toast = useToast();
  const router = useRouter();
  const [leavePolicyId, setLeavePolicyId] = useState(policies[0]?.id ?? "");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<LeaveImpactPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey());

  async function runPreview() {
    if (!startAt || !endAt) return;
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await fetch(`/api/people/leave-requests/impact-preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ startAt, endAt }),
      });
      if (!res.ok) {
        toast.show("Không xem trước được ảnh hưởng — backend chưa sẵn.", "info");
        return;
      }
      setPreview(await res.json());
    } catch {
      toast.show("Không kết nối được backend.", "info");
    } finally {
      setPreviewing(false);
    }
  }

  async function submit() {
    if (!preview) {
      toast.show("Hãy xem trước ảnh hưởng trước khi gửi đơn.", "info");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/people/leave-requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leavePolicyId, startAt, endAt, reason: reason.trim() || undefined, idempotencyKey }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const code = data?.detail?.code ?? data?.error;
        const message =
          code === "LEAVE_OVERLAP" ? "Trùng với đơn nghỉ khác đã có." :
          code === "INSUFFICIENT_BALANCE" ? "Không đủ số dư nghỉ phép." :
          code === "SOR_NOT_XOFFICE" ? "Chế độ vận hành hiện không cho phép tạo đơn ở X.Office." :
          "Đơn bị từ chối.";
        toast.show(message, "error");
        return;
      }
      toast.show(data?.replayed ? "Đơn đã gửi trước đó (không tạo trùng)." : "Đã gửi đơn nghỉ phép.", "success");
      setStartAt(""); setEndAt(""); setReason(""); setPreview(null);
      setIdempotencyKey(newIdempotencyKey());
      router.refresh();
    } catch {
      toast.show("Không kết nối được backend — đơn KHÔNG được gửi.", "info");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-dark-300">Loại nghỉ</span>
          <select
            value={leavePolicyId}
            onChange={(e) => setLeavePolicyId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-700"
          >
            {policies.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-dark-300">Từ ngày</span>
            <input type="date" value={startAt} onChange={(e) => { setStartAt(e.target.value); setPreview(null); }} className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-700" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-dark-300">Đến ngày</span>
            <input type="date" value={endAt} onChange={(e) => { setEndAt(e.target.value); setPreview(null); }} className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-700" />
          </label>
        </div>
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Lý do (tuỳ chọn)"
        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-700"
      />

      <button
        type="button"
        onClick={runPreview}
        disabled={!startAt || !endAt || previewing}
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-dark-600 dark:text-dark-100 dark:hover:bg-dark-600/40"
      >
        {previewing ? "Đang kiểm tra…" : "Xem trước ảnh hưởng"}
      </button>

      {preview && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-dark-600 dark:bg-dark-700/50">
          <p className="font-medium text-gray-700 dark:text-dark-100">
            Mức ảnh hưởng: <span className={preview.summary.riskLevel === "HIGH" ? "text-error" : preview.summary.riskLevel === "MEDIUM" ? "text-warning" : "text-success"}>{preview.summary.riskLevel}</span>
          </p>
          <ul className="mt-1 space-y-0.5 text-gray-500 dark:text-dark-300">
            <li>{preview.summary.workItems} công việc đến hạn trong kỳ nghỉ</li>
            <li>{preview.summary.approvals} phê duyệt đang chờ bạn xử lý</li>
            <li>{preview.summary.bookings} lịch đặt phòng/tài nguyên</li>
            <li>{preview.summary.directives} chỉ đạo đến hạn</li>
          </ul>
        </div>
      )}

      <button
        type="button"
        disabled={submitting || !preview}
        onClick={submit}
        className="w-full rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:w-auto"
      >
        {submitting ? "Đang gửi…" : "Gửi đơn nghỉ phép"}
      </button>
    </div>
  );
}
