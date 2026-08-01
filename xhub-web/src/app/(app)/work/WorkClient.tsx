"use client";

import { useMemo, useState } from "react";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge, type Tone } from "@/xhub/ui/Badge";
import { dateVN } from "@/xhub/lib/format";

export interface WorkTask {
  id: string;
  title: string;
  assigneeName: string;
  projectName: string;
  dueDate: string;
  priority: string;
  status: string;
  progress: number;
  overdue: boolean;
}

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  not_started: { label: "Chưa bắt đầu", tone: "neutral" },
  new: { label: "Mới", tone: "info" },
  in_progress: { label: "Đang làm", tone: "primary" },
  waiting: { label: "Chờ", tone: "warning" },
  completed: { label: "Hoàn tất", tone: "success" },
  overdue: { label: "Quá hạn", tone: "error" },
};
const PRIO_TONE: Record<string, Tone> = { critical: "error", high: "error", medium: "warning", low: "neutral" };
const PRIO_LABEL: Record<string, string> = { critical: "Khẩn", high: "Cao", medium: "TB", low: "Thấp" };

export function WorkClient({ tasks }: { tasks: WorkTask[] }) {
  const tabs = [
    { key: "all", label: "Tất cả" },
    { key: "active", label: "Đang thực hiện" },
    { key: "waiting", label: "Chờ / phụ thuộc" },
    { key: "overdue", label: "Quá hạn" },
    { key: "completed", label: "Hoàn tất" },
  ];
  const [tab, setTab] = useState("all");
  const [prio, setPrio] = useState("all");

  const visible = useMemo(
    () =>
      tasks.filter((t) => {
        if (prio !== "all" && t.priority !== prio) return false;
        if (tab === "all") return true;
        if (tab === "active") return t.status === "in_progress" || t.status === "new" || t.status === "not_started";
        if (tab === "waiting") return t.status === "waiting";
        if (tab === "overdue") return t.overdue || t.status === "overdue";
        if (tab === "completed") return t.status === "completed";
        return true;
      }),
    [tasks, tab, prio],
  );

  const countFor = (key: string) =>
    tasks.filter((t) => {
      if (key === "all") return true;
      if (key === "active") return t.status === "in_progress" || t.status === "new" || t.status === "not_started";
      if (key === "waiting") return t.status === "waiting";
      if (key === "overdue") return t.overdue || t.status === "overdue";
      if (key === "completed") return t.status === "completed";
      return false;
    }).length;

  return (
    <SectionCard
      title="Công việc"
      action={
        <select value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="Lọc theo ưu tiên" className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-dark-100">
          <option value="all">Mọi ưu tiên</option>
          <option value="high">Cao</option>
          <option value="medium">Trung bình</option>
          <option value="low">Thấp</option>
        </select>
      }
      bodyClassName="p-0"
    >
      <div className="flex flex-wrap gap-1 border-b border-gray-200 px-2 pt-2 dark:border-dark-600">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              tab === t.key ? "border-b-2 border-primary-600 text-primary-600" : "text-gray-500 hover:text-gray-700 dark:text-dark-300"
            }`}
          >
            {t.label} <span className="text-xs text-gray-400">({countFor(t.key)})</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
          <span className="text-3xl">📋</span>
          <p className="text-sm font-medium text-gray-700 dark:text-dark-100">Không có công việc nào</p>
          <p className="text-xs text-gray-400">Không có việc khớp bộ lọc hiện tại.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-dark-600">
          {visible.map((t) => {
            const st = STATUS_META[t.status] ?? { label: t.status, tone: "neutral" as Tone };
            return (
              <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-1 size-2.5 shrink-0 rounded-full ${t.status === "completed" ? "bg-success" : t.overdue ? "bg-error" : "bg-primary-500"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-dark-100">{t.title}</p>
                    <Badge tone={PRIO_TONE[t.priority] ?? "neutral"}>{PRIO_LABEL[t.priority] ?? t.priority}</Badge>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{t.assigneeName} · {t.projectName} · hạn {dateVN(t.dueDate)}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-gray-150 dark:bg-dark-500"><div className={`h-1.5 rounded-full ${t.progress === 100 ? "bg-success" : "bg-primary-600"}`} style={{ width: `${t.progress}%` }} /></div>
                    <span className="text-xs text-gray-400">{t.progress}%</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
