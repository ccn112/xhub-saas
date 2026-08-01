"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

/** Manager approve/reject for a pending leave request (surfaces the SAME
 * ApprovalTask visible in /approvals — this is a convenience action, not a
 * second approval mechanism). */
export function LeaveApprovalButtons({ id, status }: { id: string; status: string }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  if (!["SUBMITTED", "IN_REVIEW"].includes(status)) return null;

  async function act(action: "approve" | "reject") {
    setBusy(action);
    try {
      const res = await fetch(`/api/people/leave-requests/${id}/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!res.ok) {
        toast.show("Thao tác không thành công.", "error");
        return;
      }
      toast.show(action === "approve" ? "Đã duyệt đơn." : "Đã từ chối đơn.", "success");
      router.refresh();
    } catch {
      toast.show("Không kết nối được backend.", "info");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => act("approve")}
        className="rounded-lg bg-success/10 px-2 py-1 text-xs font-medium text-success hover:bg-success/20 disabled:opacity-50"
      >
        {busy === "approve" ? "…" : "Duyệt"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => act("reject")}
        className="rounded-lg bg-error/10 px-2 py-1 text-xs font-medium text-error hover:bg-error/20 disabled:opacity-50"
      >
        {busy === "reject" ? "…" : "Từ chối"}
      </button>
    </div>
  );
}
