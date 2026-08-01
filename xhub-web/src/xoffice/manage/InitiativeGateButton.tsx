"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

const NEXT_STAGE: Record<string, string | null> = {
  INTAKE: "DISCOVERY",
  DISCOVERY: "APPROVED",
  APPROVED: "FUNDED",
  FUNDED: "DELIVERY",
  DELIVERY: "BENEFIT_REVIEW",
  BENEFIT_REVIEW: "CLOSED",
  CLOSED: null,
  STOPPED: null,
};

const STAGE_LABEL: Record<string, string> = {
  DISCOVERY: "Khảo sát",
  APPROVED: "Đã duyệt",
  FUNDED: "Đã cấp vốn",
  DELIVERY: "Triển khai",
  BENEFIT_REVIEW: "Rà soát lợi ích",
  CLOSED: "Đóng",
};

/** MG-04 stage-gate control — only advances forward (or STOPPED); server enforces the FSM. */
export function InitiativeGateButton({ id, status }: { id: string; status: string }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = NEXT_STAGE[status];

  async function gate(to: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/manage/initiatives/${id}/gate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      if (!res.ok) {
        toast.show("Không chuyển giai đoạn được.", "error");
        return;
      }
      toast.show(`Đã chuyển sang ${STAGE_LABEL[to] ?? to}.`, "success");
      router.refresh();
    } catch {
      toast.show("Không kết nối được backend.", "info");
    } finally {
      setBusy(false);
    }
  }

  if (!next) return null;
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => gate(next)}
        className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-dark-600 dark:text-dark-200 dark:hover:bg-dark-600/40"
      >
        {busy ? "…" : `→ ${STAGE_LABEL[next] ?? next}`}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => gate("STOPPED")}
        className="rounded-lg px-2 py-1 text-xs font-medium text-error hover:bg-error/10 disabled:opacity-50"
      >
        Dừng
      </button>
    </div>
  );
}
