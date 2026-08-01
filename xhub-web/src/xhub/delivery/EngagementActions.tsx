"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACTION_LABELS } from "./delivery-data";

// Lifecycle action bar for one engagement: advances the FSM via the per-stage
// endpoints, holds/resumes, and — at/after GO_LIVE — triggers the customer tenant
// launch ("Khởi chạy tenant khách", non-negotiable #12). All writes go through
// the BFF proxy (/api/delivery/*); the FE never touches the DB.
export function EngagementActions({
  id,
  legalActions,
  launchReady,
  onHold,
  hasLaunch,
}: {
  id: string;
  legalActions: string[];
  launchReady: boolean;
  onHold: boolean;
  hasLaunch: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function act(path: string, label: string) {
    setBusy(label);
    setErr(null);
    try {
      const res = await fetch(`/api/delivery/engagements/${id}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setErr(b?.detail?.message ?? b?.error ?? `Lỗi ${res.status}`);
      } else {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {onHold ? (
          <button onClick={() => act("resume", "resume")} disabled={busy !== null} className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
            {busy === "resume" ? "Đang mở lại…" : "Mở lại (resume)"}
          </button>
        ) : (
          <>
            {legalActions.map((a) => (
              <button
                key={a}
                onClick={() => act(a, a)}
                disabled={busy !== null}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                  a === "lose"
                    ? "border border-error/50 text-error hover:bg-error/5"
                    : "bg-primary-600 text-white hover:bg-primary-700"
                }`}
              >
                {busy === a ? "…" : ACTION_LABELS[a] ?? a}
              </button>
            ))}
            <button onClick={() => act("hold", "hold")} disabled={busy !== null} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-dark-600 dark:text-dark-200">
              {busy === "hold" ? "…" : "Tạm giữ (hold)"}
            </button>
          </>
        )}
      </div>

      {launchReady && !hasLaunch ? (
        <button
          onClick={() => act("launch", "launch")}
          disabled={busy !== null}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy === "launch" ? "Đang khởi chạy tenant khách…" : "🚀 Khởi chạy tenant khách (Launch Factory)"}
        </button>
      ) : null}

      {err ? <p className="text-xs text-error">{err}</p> : null}
    </div>
  );
}
