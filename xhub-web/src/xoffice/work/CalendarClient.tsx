"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/xhub/ui/Card";
import type { WorkItemRow } from "@/xoffice/lib/work-items-data";
import { STATUS_TONE } from "./work-states";

const TONE_DOT: Record<string, string> = {
  primary: "bg-primary-500", success: "bg-success", warning: "bg-warning", error: "bg-error", info: "bg-info", neutral: "bg-gray-400",
};
const WD = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** Work calendar (WK-05) — month grid keyed by dueAt, milestones marked ◆. */
export function CalendarClient({ rows }: { rows: WorkItemRow[] }) {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  const byDay = useMemo(() => {
    const map = new Map<string, WorkItemRow[]>();
    for (const r of rows) {
      if (!r.dueAt) continue;
      const d = new Date(r.dueAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [rows]);

  const first = new Date(cursor.y, cursor.m, 1);
  const startWeekday = (first.getDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = first.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === cursor.y && today.getMonth() === cursor.m && today.getDate() === d;
  const withDue = rows.filter((r) => r.dueAt).length;

  const shift = (delta: number) => setCursor((c) => { const nd = new Date(c.y, c.m + delta, 1); return { y: nd.getFullYear(), m: nd.getMonth() }; });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Lịch công việc</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">{withDue} việc có hạn · theo ngày đến hạn</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => shift(-1)} className="rounded-lg border border-gray-300 px-3 py-1 dark:border-dark-500">←</button>
          <span className="min-w-40 text-center font-medium capitalize text-gray-700 dark:text-dark-100">{monthLabel}</span>
          <button onClick={() => shift(1)} className="rounded-lg border border-gray-300 px-3 py-1 dark:border-dark-500">→</button>
          <button onClick={() => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }); }} className="rounded-lg border border-gray-300 px-3 py-1 text-xs dark:border-dark-500">Hôm nay</button>
        </div>
      </div>

      <SectionCard title="" accent="primary" bodyClassName="p-2">
        <div className="grid grid-cols-7 gap-1">
          {WD.map((w) => <div key={w} className="py-1 text-center text-[11px] font-medium text-gray-400">{w}</div>)}
          {cells.map((d, i) => {
            const key = d ? `${cursor.y}-${cursor.m}-${d}` : `e${i}`;
            const entries = d ? byDay.get(`${cursor.y}-${cursor.m}-${d}`) ?? [] : [];
            return (
              <div key={key} className={`min-h-24 rounded-lg border p-1 ${d ? "border-gray-150 dark:border-dark-600" : "border-transparent"} ${d && isToday(d) ? "bg-primary-50/60 ring-1 ring-primary-300 dark:bg-primary-500/10" : d ? "bg-white dark:bg-dark-800/30" : ""}`}>
                {d && <div className={`px-1 text-[11px] ${isToday(d) ? "font-bold text-primary-600" : "text-gray-400"}`}>{d}</div>}
                <div className="mt-0.5 space-y-0.5">
                  {entries.slice(0, 4).map((e) => (
                    <button key={e.id} onClick={() => router.push(`/work/items/${e.id}`)} className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] text-gray-600 hover:bg-gray-100 dark:text-dark-200 dark:hover:bg-dark-700" title={e.title}>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[STATUS_TONE[e.status] ?? "neutral"]}`} />
                      <span className="truncate">{e.isMilestone ? "◆ " : ""}{e.title}</span>
                    </button>
                  ))}
                  {entries.length > 4 && <p className="px-1 text-[10px] text-gray-400">+{entries.length - 4} nữa</p>}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
