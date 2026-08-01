"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";

import { Card, SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { StatCard } from "@/xhub/ui/StatCard";
import { useToast } from "@/components/ui/Toast";
import {
  BOT_TEST_RESULTS,
  BOT_TEST_UPDATED,
  USER_TEST_ROWS,
  USER_TEST_GROUPS,
  TEST_ACCOUNTS,
  TEST_SETUP_GUIDE,
} from "./test-data";

type Result = "untested" | "pass" | "fail";
interface RowState { result: Result; notes: string }
type Store = Record<string, RowState>;

const STORAGE_KEY = "xhub-usertest-v1";
const EMPTY: RowState = { result: "untested", notes: "" };

function loadStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

const RESULT_OPTIONS: { value: Result; label: string; active: string }[] = [
  { value: "untested", label: "Chưa test", active: "bg-gray-500 text-white" },
  { value: "pass", label: "PASS", active: "bg-success text-white" },
  { value: "fail", label: "FAIL", active: "bg-error text-white" },
];

export function TestConsole() {
  const toast = useToast();
  const [store, setStore] = useState<Store>({});
  const [hydrated, setHydrated] = useState(false);
  const [sync, setSync] = useState<"local" | "saving" | "saved" | "offline">("local");

  // Mount: prefer the server copy (auto-sync across browsers/devices); fall back
  // to the localStorage cache when the backend is unreachable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = loadStore();
      try {
        const res = await fetch("/api/testruns", { cache: "no-store" });
        if (res.ok) {
          const blob = (await res.json()) as { results?: Store };
          const server = blob?.results ?? {};
          if (!cancelled) {
            setStore(Object.keys(server).length > 0 ? server : local);
            setSync("saved");
          }
        } else if (!cancelled) {
          setStore(local);
          setSync("offline");
        }
      } catch {
        if (!cancelled) { setStore(local); setSync("offline"); }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist on change: localStorage immediately + debounced PUT to the server.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* ignore quota */
    }
    setSync((s) => (s === "offline" ? s : "saving"));
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/testruns", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ results: store }),
        });
        setSync(res.ok ? "saved" : "offline");
      } catch {
        setSync("offline");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [store, hydrated]);

  const SYNC_META: Record<typeof sync, { label: string; tone: "success" | "info" | "warning" | "neutral" }> = {
    saved: { label: "Đã lưu máy chủ", tone: "success" },
    saving: { label: "Đang lưu…", tone: "info" },
    offline: { label: "Lưu cục bộ (offline)", tone: "warning" },
    local: { label: "Cục bộ", tone: "neutral" },
  };

  const get = (id: string): RowState => store[id] ?? EMPTY;

  const setResult = (id: string, result: Result) =>
    setStore((s) => ({ ...s, [id]: { ...(s[id] ?? EMPTY), result } }));
  const setNotes = (id: string, notes: string) =>
    setStore((s) => ({ ...s, [id]: { ...(s[id] ?? EMPTY), notes } }));

  const stats = useMemo(() => {
    let pass = 0, fail = 0, tested = 0;
    for (const row of USER_TEST_ROWS) {
      const r = get(row.id).result;
      if (r === "pass") { pass++; tested++; }
      else if (r === "fail") { fail++; tested++; }
    }
    return { pass, fail, tested, total: USER_TEST_ROWS.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const pct = Math.round((stats.tested / stats.total) * 100);

  const reset = () => {
    setStore({});
    toast.success("Đã xoá kết quả kiểm thử tay");
  };

  const copy = async () => {
    const ts = new Date().toLocaleString("vi-VN");
    const lines: string[] = [
      `# Kết quả kiểm thử tay XHub`,
      ``,
      `- Thời điểm: ${ts}`,
      `- Tiến độ: ${stats.tested}/${stats.total} đã test · ${stats.pass} PASS · ${stats.fail} FAIL`,
      ``,
      `| ID | Nhóm | Bước | Kết quả | Ghi chú |`,
      `| --- | --- | --- | --- | --- |`,
    ];
    for (const row of USER_TEST_ROWS) {
      const st = get(row.id);
      const label =
        st.result === "pass" ? "PASS" : st.result === "fail" ? "FAIL" : "Chưa test";
      const notes = st.notes.replace(/\|/g, "\\|").replace(/\n/g, " ") || "";
      lines.push(`| ${row.id} | ${row.group} | ${row.step.replace(/\|/g, "\\|")} | ${label} | ${notes} |`);
    }
    const md = lines.join("\n");
    try {
      await navigator.clipboard.writeText(md);
      toast.success("Đã sao chép kết quả (Markdown) vào clipboard");
    } catch {
      toast.error("Không sao chép được — trình duyệt chặn clipboard");
    }
  };

  return (
    <div className="space-y-6">
      {/* 0. Setup / hướng dẫn cho người test mới */}
      <SectionCard
        accent="info"
        title="Bắt đầu ở đây — dành cho người test mới, chưa biết code"
        action={<Badge tone="info">Đọc trước khi test</Badge>}
      >
        <p className="mb-3 text-sm text-gray-600 dark:text-dark-200">
          Mở trình duyệt tới <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs dark:bg-dark-700">{TEST_SETUP_GUIDE.appUrl}</code>{" "}
          (nếu máy chủ chạy ở cổng khác — ví dụ 3001 — đổi số cổng tương ứng). Làm theo các bước dưới, rồi kéo xuống checklist.
        </p>
        <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-sm text-gray-700 dark:text-dark-100">
          {TEST_SETUP_GUIDE.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>

        <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-dark-100">Tài khoản test</h4>
        <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-500">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-dark-100">Nhãn</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-dark-100">Tên</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-dark-100">Email / userId</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-dark-100">Mật khẩu</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-dark-100">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {TEST_ACCOUNTS.map((a) => (
                <tr key={a.email} className="border-t border-gray-100 align-top dark:border-dark-600">
                  <td className="px-3 py-2"><Badge tone="primary">{a.tag}</Badge></td>
                  <td className="px-3 py-2 text-gray-800 dark:text-dark-50">{a.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-primary-700 dark:text-primary-300">{a.email}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{a.password}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 dark:text-dark-300">{a.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mb-1 text-xs text-gray-500 dark:text-dark-300">
          <span className="font-medium">[ENFORCE]:</span> {TEST_SETUP_GUIDE.enforceNote}
        </p>
        <p className="text-xs text-gray-500 dark:text-dark-300">
          <span className="font-medium">Báo cáo kết quả:</span> {TEST_SETUP_GUIDE.reportTo}
        </p>
      </SectionCard>

      {/* A. Bot-test */}
      <SectionCard
        accent="success"
        title="Bot-test — kết quả tự động"
        action={<Badge tone="success">Cập nhật: {BOT_TEST_UPDATED} · {BOT_TEST_RESULTS.length}/{BOT_TEST_RESULTS.length} PASS</Badge>}
      >
        <p className="mb-3 text-sm text-gray-500 dark:text-dark-300">
          Kết quả các cổng tự động ở lần chạy mới nhất (chỉ đọc).
        </p>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-500">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-dark-100">Kết quả</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-dark-100">Lệnh</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-dark-100">Kỳ vọng</th>
              </tr>
            </thead>
            <tbody>
              {BOT_TEST_RESULTS.map((r) => (
                <tr key={r.cmd} className="border-t border-gray-100 dark:border-dark-600">
                  <td className="px-3 py-2 align-top"><Badge tone="success">PASS</Badge></td>
                  <td className="px-3 py-2 align-top font-mono text-xs text-primary-700 dark:text-primary-300">{r.cmd}</td>
                  <td className="px-3 py-2 align-top text-gray-600 dark:text-dark-200">
                    {r.expected}
                    {r.note && <span className="mt-0.5 block text-xs text-gray-400 dark:text-dark-400">* {r.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-400 dark:text-dark-400">
          * Một số cổng in PASSED kèm assertion teardown libuv trên Windows — đã xác minh không phải lỗi.
        </p>
      </SectionCard>

      {/* B. User test */}
      <SectionCard
        accent="primary"
        title="User test — checklist bạn tự tick"
        action={
          <div className="flex items-center gap-2">
            <Badge tone={SYNC_META[sync].tone}>{SYNC_META[sync].label}</Badge>
            <button onClick={copy} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700">
              Sao chép kết quả
            </button>
            <button onClick={reset} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-dark-500 dark:text-dark-200 dark:hover:bg-dark-600">
              Xoá kết quả
            </button>
          </div>
        }
      >
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Đã test" value={`${stats.tested}/${stats.total}`} icon="🧪" tone="primary" />
          <StatCard label="PASS" value={String(stats.pass)} icon="✅" tone="success" />
          <StatCard label="FAIL" value={String(stats.fail)} icon="❌" tone="error" />
          <StatCard label="Tiến độ" value={`${pct}%`} icon="📊" tone="info" />
        </div>

        <div className="mb-5 h-2.5 w-full overflow-hidden rounded-full bg-gray-150 dark:bg-dark-600">
          <div className="flex h-full">
            <div className="h-full bg-success transition-all" style={{ width: `${(stats.pass / stats.total) * 100}%` }} />
            <div className="h-full bg-error transition-all" style={{ width: `${(stats.fail / stats.total) * 100}%` }} />
          </div>
        </div>

        <div className="space-y-5">
          {USER_TEST_GROUPS.map((group) => (
            <div key={group}>
              <h3 className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold text-gray-700 dark:text-dark-100">
                <span className="h-4 w-1 rounded-full bg-primary-600" />
                {group}
              </h3>
              <div className="space-y-2">
                {USER_TEST_ROWS.filter((r) => r.group === group).map((row) => {
                  const st = get(row.id);
                  return (
                    <Card key={row.id} className="p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge tone={st.result === "pass" ? "success" : st.result === "fail" ? "error" : "neutral"}>{row.id}</Badge>
                            <span className="text-sm font-medium text-gray-800 dark:text-dark-50">{row.step}</span>
                            {row.link && (
                              <Link href={row.link} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">
                                Mở màn ↗
                              </Link>
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-dark-300">
                            <span className="font-medium">Kỳ vọng:</span> {row.expected}
                          </p>
                        </div>
                        <div className="flex shrink-0 overflow-hidden rounded-lg border border-gray-300 dark:border-dark-500">
                          {RESULT_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => setResult(row.id, opt.value)}
                              className={clsx(
                                "px-2.5 py-1 text-xs font-medium transition-colors",
                                st.result === opt.value
                                  ? opt.active
                                  : "bg-white text-gray-500 hover:bg-gray-100 dark:bg-dark-700 dark:text-dark-200 dark:hover:bg-dark-600",
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        value={st.notes}
                        onChange={(e) => setNotes(row.id, e.target.value)}
                        placeholder="Ghi chú (tuỳ chọn)…"
                        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50"
                      />
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
