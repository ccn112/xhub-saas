"use client";

import { useState } from "react";
import { AuthLink } from "../_AuthShell";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40";

export function ForgotForm() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const body = value.includes("@") ? { email: value } : { userId: value };
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      setDone(true);
      // Internal `.local` accounts are NOT emailed — the reset link is surfaced.
      setResetUrl(typeof data?.resetUrl === "string" ? data.resetUrl : null);
      setBusy(false);
    } catch {
      setError("Không kết nối được máy chủ");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          Nếu tài khoản tồn tại, một liên kết đặt lại mật khẩu đã được tạo.
        </div>
        {resetUrl && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Liên kết đặt lại (môi trường nội bộ — không gửi email)</p>
            <div className="flex items-center gap-2">
              <input readOnly value={resetUrl} className={inputCls + " flex-1"} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" onClick={() => navigator.clipboard?.writeText(resetUrl)} className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Sao chép
              </button>
            </div>
            <p className="text-sm"><AuthLink href={resetUrl.replace(/^https?:\/\/[^/]+/, "")}>Mở trang đặt lại →</AuthLink></p>
          </div>
        )}
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          <AuthLink href="/login">Quay lại đăng nhập</AuthLink>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); if (value) void submit(); }} className="space-y-3">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Email hoặc userId
          <input className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} placeholder="name@xtech.local" autoComplete="username" />
        </label>
        <button type="submit" disabled={busy || !value} className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5">
          {busy ? "Đang xử lý…" : "Gửi yêu cầu đặt lại"}
        </button>
      </form>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        <AuthLink href="/login">Quay lại đăng nhập</AuthLink>
      </p>
    </div>
  );
}
