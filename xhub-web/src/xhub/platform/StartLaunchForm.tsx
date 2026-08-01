"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Khởi chạy tenant — create a TenantLaunch then drain it (POST /run) via the BFF
// proxy. The Launch Factory runs the 8 idempotent/retryable/audited steps
// server-side; on success the target tenant registry row becomes ACTIVE.
export function StartLaunchForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [targetTenantId, setTargetTenantId] = useState("");
  const [name, setName] = useState("");
  const [tenantKey, setTenantKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const created = await fetch("/api/platform/launches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetTenantId: targetTenantId.trim(),
          name: name.trim() || undefined,
          tenantKey: tenantKey.trim() || undefined,
        }),
      });
      if (!created.ok) {
        const body = await created.json().catch(() => ({}));
        setError(body?.message ?? body?.error ?? `Lỗi ${created.status}`);
        return;
      }
      const launch = await created.json();
      await fetch(`/api/platform/launches/${launch.id}/run`, { method: "POST" });
      setOpen(false);
      setTargetTenantId("");
      setName("");
      setTenantKey("");
      router.push(`/platform/launches/${launch.id}`);
      router.refresh();
    } catch {
      setError("Không kết nối được backend");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
      >
        + Khởi chạy tenant
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-dark-600 dark:bg-dark-800">
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          value={targetTenantId}
          onChange={(e) => setTargetTenantId(e.target.value)}
          placeholder="targetTenantId * (vd: tenant-abc)"
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-dark-500 dark:bg-dark-700"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên tenant (tuỳ chọn)"
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-dark-500 dark:bg-dark-700"
        />
        <input
          value={tenantKey}
          onChange={(e) => setTenantKey(e.target.value)}
          placeholder="tenantKey (tuỳ chọn)"
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-dark-500 dark:bg-dark-700"
        />
      </div>
      {error ? <p className="mt-2 text-xs text-error">{error}</p> : null}
      <div className="mt-2 flex gap-2">
        <button
          onClick={submit}
          disabled={busy || !targetTenantId.trim()}
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {busy ? "Đang khởi chạy…" : "Khởi chạy (8 bước)"}
        </button>
        <button
          onClick={() => { setOpen(false); setError(null); }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-dark-500"
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}
