"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Run / resume / retry a launch from the detail timeline. `run` drains the
// remaining steps idempotently (DONE steps are replayed/skipped); `retry` resets
// the FAILED step and resumes without redoing prior steps.
export function LaunchRunActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(action: "run" | "retry") {
    setBusy(action);
    try {
      await fetch(`/api/platform/launches/${id}/${action}`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex gap-2">
      {status !== "COMPLETED" ? (
        <button
          onClick={() => act("run")}
          disabled={busy !== null}
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {busy === "run" ? "Đang chạy…" : status === "QUEUED" ? "Chạy" : "Tiếp tục (resume)"}
        </button>
      ) : null}
      {status === "FAILED" ? (
        <button
          onClick={() => act("retry")}
          disabled={busy !== null}
          className="rounded-lg border border-primary-500 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 disabled:opacity-50 dark:text-primary-400"
        >
          {busy === "retry" ? "Đang thử lại…" : "Thử lại bước lỗi"}
        </button>
      ) : null}
    </div>
  );
}
