"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Reset về demo" — restores a DEMO tenant's DEMO_BASELINE in-place (destructive:
 * wipes current business data, reloads baseline). Two-step confirm. Only rendered
 * for DEMO tenants (the API also enforces 409 for LIVE).
 */
export function ResetDemoButton({ idOrCode }: { idOrCode: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/platform/tenants/${encodeURIComponent(idOrCode)}/reset-demo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ tone: "err", text: body?.detail?.message ?? body?.error ?? `Lỗi ${res.status}` });
        return;
      }
      setMsg({ tone: "ok", text: `Đã khôi phục về demo gốc (${body?.totalRows ?? 0} bản ghi).` });
      setConfirming(false);
      router.refresh();
    } catch {
      setMsg({ tone: "err", text: "Không kết nối được backend" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {!confirming ? (
        <button
          onClick={() => { setConfirming(true); setMsg(null); }}
          className="rounded-lg border border-amber-500 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950"
        >
          Reset về demo
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 p-2 dark:border-amber-700 dark:bg-amber-950/40">
          <span className="text-xs text-amber-800 dark:text-amber-200">
            Xoá dữ liệu nghiệp vụ hiện tại và nạp lại baseline demo. Không thể hoàn tác (đã snapshot an toàn). Chắc chắn?
          </span>
          <button
            onClick={run}
            disabled={busy}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {busy ? "Đang reset…" : "Xác nhận reset"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-dark-200 dark:hover:bg-dark-700"
          >
            Huỷ
          </button>
        </div>
      )}
      {msg ? <p className={msg.tone === "ok" ? "text-xs text-success" : "text-xs text-error"}>{msg.text}</p> : null}
    </div>
  );
}
