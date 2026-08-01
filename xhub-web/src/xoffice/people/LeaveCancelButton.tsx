"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

/** Self-service cancel (submit/in-review → CANCELLED; approved → CANCEL_REQUESTED). */
export function LeaveCancelButton({ id, status }: { id: string; status: string }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!["DRAFT", "SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED"].includes(status)) return null;

  async function cancel() {
    setBusy(true);
    try {
      const res = await fetch(`/api/people/leave-requests/${id}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!res.ok) {
        toast.show("Không huỷ được đơn.", "error");
        return;
      }
      toast.show(status === "APPROVED" ? "Đã gửi yêu cầu huỷ, chờ duyệt." : "Đã huỷ đơn.", "success");
      router.refresh();
    } catch {
      toast.show("Không kết nối được backend.", "info");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={cancel}
      className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-dark-600 dark:text-dark-200 dark:hover:bg-dark-600/40"
    >
      {busy ? "…" : status === "APPROVED" ? "Yêu cầu huỷ" : "Huỷ đơn"}
    </button>
  );
}
