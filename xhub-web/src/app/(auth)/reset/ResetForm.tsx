"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLink } from "../_AuthShell";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [tok, setTok] = useState(token);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = pw.length > 0 && pw.length < 8;
  const mismatch = confirm.length > 0 && pw !== confirm;
  const canSubmit = !!tok && pw.length >= 8 && pw === confirm && !busy;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: tok, password: pw }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Đặt lại thất bại — token có thể đã hết hạn hoặc đã dùng.");
        setBusy(false);
        return;
      }
      setDone(true);
      setBusy(false);
      setTimeout(() => { router.push("/login"); }, 1200);
    } catch {
      setError("Không kết nối được máy chủ");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          Đặt lại mật khẩu thành công. Đang chuyển tới trang đăng nhập…
        </div>
        <p className="text-center text-sm"><AuthLink href="/login">Đăng nhập ngay</AuthLink></p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); if (canSubmit) void submit(); }} className="space-y-3">
        {!token && (
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Mã đặt lại
            <input className={inputCls} value={tok} onChange={(e) => setTok(e.target.value)} placeholder="Dán mã từ liên kết đặt lại" />
          </label>
        )}
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Mật khẩu mới
          <input type="password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Nhập lại mật khẩu
          <input type="password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </label>
        {tooShort && <p className="text-xs text-amber-600 dark:text-amber-400">Mật khẩu cần tối thiểu 8 ký tự.</p>}
        {mismatch && <p className="text-xs text-amber-600 dark:text-amber-400">Hai mật khẩu chưa khớp.</p>}
        <button type="submit" disabled={!canSubmit} className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5">
          {busy ? "Đang đặt lại…" : "Đặt lại mật khẩu"}
        </button>
      </form>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        <AuthLink href="/login">Quay lại đăng nhập</AuthLink>
      </p>
    </div>
  );
}
