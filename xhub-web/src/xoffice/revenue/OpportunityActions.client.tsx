"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OPPORTUNITY_STAGE_LABEL } from "@/xoffice/lib/revenue-data";

const STAGES = ["LEAD", "QUALIFIED", "DISCOVERY", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;

/** Opportunity stage-transition actions (Phase 2, BO-0202). */
export function OpportunityActions({ opportunityId, currentStage }: { opportunityId: string; currentStage: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [showLostForm, setShowLostForm] = useState(false);

  async function setStage(stage: string, reason?: string) {
    setPending(true);
    try {
      await fetch(`/api/opportunities/${opportunityId}/stage`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage, lostReason: reason }),
      });
      setShowLostForm(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const terminal = currentStage === "WON" || currentStage === "LOST";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-gray-400">Giai đoạn:</span>
        {STAGES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending || s === currentStage || terminal}
            onClick={() => (s === "LOST" ? setShowLostForm(true) : setStage(s))}
            className={`rounded-full border px-2.5 py-1 text-xs disabled:cursor-default disabled:opacity-40 ${s === currentStage ? "border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-500 hover:border-gray-300 dark:border-dark-600 dark:text-dark-300"}`}
          >
            {OPPORTUNITY_STAGE_LABEL[s]}
          </button>
        ))}
      </div>
      {showLostForm ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder="Lý do thua (bắt buộc)"
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            className="rounded border border-gray-200 px-2 py-1 text-sm dark:border-dark-600 dark:bg-dark-800"
          />
          <button type="button" disabled={pending || !lostReason.trim()} onClick={() => setStage("LOST", lostReason)} className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40">
            Xác nhận thua
          </button>
          <button type="button" onClick={() => setShowLostForm(false)} className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
            Huỷ
          </button>
        </div>
      ) : null}
    </div>
  );
}
