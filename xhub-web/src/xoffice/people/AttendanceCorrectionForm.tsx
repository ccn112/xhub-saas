"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

function newIdempotencyKey(): string {
  return `attcorr-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

const STATUS_OPTIONS = [
  { value: "", label: "Không đổi trạng thái" },
  { value: "PRESENT", label: "Có mặt" },
  { value: "LATE", label: "Đi muộn" },
  { value: "HALF_DAY", label: "Nửa ngày" },
  { value: "ABSENT", label: "Vắng" },
];

/** Self-service "báo sai" form for one AttendanceDay — goes through the SAME
 * ApprovalTask queue as leave (no second approval mechanism). */
export function AttendanceCorrectionForm({ workDate }: { workDate: string }) {
  const toast = useToast();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [requestedStatus, setRequestedStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey());

  async function submit() {
    if (!reason.trim()) {
      toast.show("Cần nêu lý do báo sai.", "info");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/people/attendance-corrections`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workDate, reason: reason.trim(), requestedStatus: requestedStatus || undefined, idempotencyKey }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.show("Không gửi được báo cáo sai.", "error");
        return;
      }
      toast.show(data?.replayed ? "Yêu cầu đã gửi trước đó." : "Đã gửi báo cáo sai — chờ quản lý duyệt.", "success");
      setReason(""); setRequestedStatus("");
      setIdempotencyKey(newIdempotencyKey());
      router.refresh();
    } catch {
      toast.show("Không kết nối được backend.", "info");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-dark-600">
      <p className="text-xs font-medium text-gray-500 dark:text-dark-300">Báo sai chấm công ngày {workDate}</p>
      <select
        value={requestedStatus}
        onChange={(e) => setRequestedStatus(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-700"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Lý do (bắt buộc)"
        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-700"
      />
      <button
        type="button"
        disabled={submitting}
        onClick={submit}
        className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {submitting ? "Đang gửi…" : "Gửi báo cáo sai"}
      </button>
    </div>
  );
}
