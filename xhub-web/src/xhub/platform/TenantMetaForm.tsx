"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["DRAFT", "PROVISIONING", "PLANNED", "ACTIVE", "SUSPENDED", "OFFBOARDING", "CLOSED"];

// Lifecycle-safe metadata PATCH (PUT /api/platform/tenants/:idOrCode). Only
// displayName/status/planId/blueprintId are mutable — tenantNo/tenantCode/
// tenantKey/id are immutable and rejected server-side.
export function TenantMetaForm({
  idOrCode,
  initial,
}: {
  idOrCode: string;
  initial: { status: string | null; planId: string | null; blueprintId: string | null };
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial.status ?? "");
  const [planId, setPlanId] = useState(initial.planId ?? "");
  const [blueprintId, setBlueprintId] = useState(initial.blueprintId ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/platform/tenants/${encodeURIComponent(idOrCode)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: status || undefined,
          planId: planId.trim() || undefined,
          blueprintId: blueprintId.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMsg({ tone: "err", text: body?.detail?.message ?? body?.error ?? `Lỗi ${res.status}` });
        return;
      }
      setMsg({ tone: "ok", text: "Đã cập nhật." });
      router.refresh();
    } catch {
      setMsg({ tone: "err", text: "Không kết nối được backend" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500 dark:text-dark-300">Trạng thái</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-dark-500 dark:bg-dark-700"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500 dark:text-dark-300">Gói dịch vụ (planId)</span>
          <input
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-dark-500 dark:bg-dark-700"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500 dark:text-dark-300">Blueprint (blueprintId)</span>
          <input
            value={blueprintId}
            onChange={(e) => setBlueprintId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-dark-500 dark:bg-dark-700"
          />
        </label>
      </div>
      {msg ? (
        <p className={msg.tone === "ok" ? "text-xs text-success" : "text-xs text-error"}>{msg.text}</p>
      ) : null}
      <button
        onClick={save}
        disabled={busy}
        className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {busy ? "Đang lưu…" : "Lưu thay đổi"}
      </button>
    </div>
  );
}
