"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLink } from "../_AuthShell";

interface UserOption {
  id: string;
  name: string;
  email: string;
  title: string;
}

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40";

export function LoginForm({ users }: { users: UserOption[] }) {
  const router = useRouter();
  const [value, setValue] = useState(users[0]?.email || users[0]?.id || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(identifier: string, pw?: string) {
    setBusy(true);
    setError(null);
    // Send as email if it looks like one, otherwise as userId. Password is
    // optional: with it → internal credential login; without → dev quick-select.
    const base = identifier.includes("@") ? { email: identifier } : { userId: identifier };
    const body = pw ? { ...base, password: pw } : base;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(res.status === 409 ? "Tài khoản chưa kích hoạt — cần lời mời." : data?.error ?? "Đăng nhập thất bại");
        setBusy(false);
        return;
      }
      router.push("/home/executive");
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ");
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(value, password || undefined);
        }}
        className="space-y-3"
      >
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Email hoặc userId
          <input
            className={inputCls}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="name@xtech.local"
            autoComplete="username"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Mật khẩu
          <input
            type="password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>
        <div className="flex justify-end text-sm">
          <AuthLink href="/forgot">Quên mật khẩu?</AuthLink>
        </div>
        <button
          type="submit"
          disabled={busy || !value}
          className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5"
        >
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="pt-2">
        <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Chọn nhanh (demo, không mật khẩu)</p>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              disabled={busy}
              onClick={() => void submit(u.email || u.id)}
              className="w-full text-left rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{u.name}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {u.title}
                {u.email ? ` · ${u.email}` : ""}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
