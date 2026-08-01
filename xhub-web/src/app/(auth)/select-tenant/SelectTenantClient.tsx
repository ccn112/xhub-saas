"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLink } from "../_AuthShell";

interface MembershipOption {
  tenantId: string;
  roles: string[];
  status: string;
}

export function SelectTenantClient({ memberships, current }: { memberships: MembershipOption[]; current: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(tenantId: string) {
    setBusy(tenantId);
    setError(null);
    try {
      const res = await fetch("/api/auth/switch-tenant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Không chuyển được tenant");
        setBusy(null);
        return;
      }
      router.push("/home/executive");
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ");
      setBusy(null);
    }
  }

  const selectable = memberships.filter((m) => m.status === "active");

  if (selectable.length === 0) {
    return (
      <div className="mt-6 space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">Không có tenant nào đang hoạt động cho phiên này.</p>
        <p className="text-center text-sm"><AuthLink href="/login">Đăng nhập lại</AuthLink></p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {selectable.map((m) => {
        const isCurrent = m.tenantId === current;
        return (
          <button
            key={m.tenantId}
            type="button"
            disabled={!!busy}
            onClick={() => void pick(m.tenantId)}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left transition-colors hover:border-blue-400 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{m.tenantId}</span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{m.roles.join(", ") || "—"}</span>
            </span>
            <span className="shrink-0 text-xs">
              {busy === m.tenantId ? "Đang chuyển…" : isCurrent ? "Đang dùng" : "Chọn →"}
            </span>
          </button>
        );
      })}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
