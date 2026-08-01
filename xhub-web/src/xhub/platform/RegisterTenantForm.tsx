"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Register a CUSTOMER tenant via the BFF proxy (POST /api/platform/tenants).
// The API allocates the next tenantNo >= 11 (T001–T010 are reserved) and creates
// a PLANNED registry row only — provisioning is the Launch Factory's job.
export function RegisterTenantForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tenantKey, setTenantKey] = useState("");
  const [industry, setIndustry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          tenantKey: tenantKey.trim() || undefined,
          industry: industry.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.detail?.message ?? body?.error ?? `Lỗi ${res.status}`);
        return;
      }
      setOpen(false);
      setName("");
      setTenantKey("");
      setIndustry("");
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
        + Đăng ký tenant khách
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-dark-600 dark:bg-dark-800">
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên tenant *"
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-dark-500 dark:bg-dark-700"
        />
        <input
          value={tenantKey}
          onChange={(e) => setTenantKey(e.target.value)}
          placeholder="tenantKey (tuỳ chọn)"
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-dark-500 dark:bg-dark-700"
        />
        <input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="Ngành (tuỳ chọn)"
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-dark-500 dark:bg-dark-700"
        />
      </div>
      {error ? <p className="mt-2 text-xs text-error">{error}</p> : null}
      <div className="mt-2 flex gap-2">
        <button
          onClick={submit}
          disabled={busy || !name.trim()}
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {busy ? "Đang tạo…" : "Tạo (cấp T011+)"}
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
