"use client";

import { useState } from "react";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { DefRow } from "@/features/tenant-admin/AdminHeader";
import { dateTimeVN } from "@/xhub/lib/format";
import type { RestoreJob } from "@/features/tenant-admin/data";

interface RState { key: string; label: string }

export function RestoresClient({ jobs, states, live }: { jobs: RestoreJob[]; states: RState[]; live: boolean }) {
  const [selected, setSelected] = useState<string>(jobs[0]?.id ?? "");
  const job = jobs.find((j) => j.id === selected) ?? jobs[0];
  const activeIdx = job ? states.findIndex((s) => s.key === job.state) : -1;

  const pendingApproval = jobs.filter((j) => j.state === "approval_pending").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Phiên restore" value={String(jobs.length)} icon="♻️" tone="primary" />
        <StatCard label="Chờ phê duyệt" value={String(pendingApproval)} icon="⏳" tone="warning" />
        <StatCard label="Hoàn tất" value={String(jobs.filter((j) => j.state === "completed").length)} icon="✅" tone="success" />
        <StatCard label="Có xung đột" value={String(jobs.filter((j) => j.conflicts > 0).length)} icon="⚠️" tone="error" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard title="Phiên khôi phục" bodyClassName="p-0">
          <ul className="divide-y divide-gray-100 dark:divide-dark-600">
            {jobs.map((j) => (
              <li key={j.id}>
                <button type="button" onClick={() => setSelected(j.id)} aria-pressed={j.id === selected}
                  className={`w-full px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 ${j.id === selected ? "bg-primary-50/70 dark:bg-primary-950/30" : "hover:bg-gray-50 dark:hover:bg-dark-600/40"}`}>
                  <p className="font-medium text-gray-800 dark:text-dark-100">{j.id}</p>
                  <p className="text-xs text-gray-400">từ {j.backupId} → {j.target}</p>
                  <div className="mt-1 flex gap-1"><Badge tone="info">{states.find((s) => s.key === j.state)?.label ?? j.state}</Badge>{j.conflicts > 0 ? <Badge tone="error">{j.conflicts} xung đột</Badge> : null}</div>
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className="space-y-4 xl:col-span-2">
          {job ? (
            <>
              <SectionCard title="Máy trạng thái khôi phục">
                <ol className="space-y-0">
                  {states.filter((s) => s.key !== "cancelled").map((s, i) => {
                    const done = i < activeIdx;
                    const active = i === activeIdx;
                    return (
                      <li key={s.key} className="flex items-center gap-3 py-1.5">
                        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-success text-white" : active ? "bg-primary-600 text-white" : "bg-gray-150 text-gray-400 dark:bg-dark-500"}`}>{done ? "✓" : i + 1}</span>
                        <span className={`text-sm ${active ? "font-semibold text-gray-800 dark:text-dark-50" : done ? "text-gray-600 dark:text-dark-200" : "text-gray-400"}`}>{s.label}</span>
                        {active ? <Badge tone="primary">Hiện tại</Badge> : null}
                      </li>
                    );
                  })}
                </ol>
              </SectionCard>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SectionCard accent="neutral" title="Thông tin phiên">
                  <dl className="space-y-2 text-sm">
                    <DefRow label="Gói nguồn" value={job.backupId} />
                    <DefRow label="Đích" value={job.target} />
                    <DefRow label="Người yêu cầu" value={job.requestedBy} />
                    <DefRow label="Lúc" value={dateTimeVN(job.requestedAt)} />
                  </dl>
                </SectionCard>

                <SectionCard accent={job.conflicts > 0 ? "warning" : "success"} title="Báo cáo xung đột">
                  {job.conflicts > 0 ? (
                    <ul className="space-y-1 text-sm text-gray-700 dark:text-dark-100">
                      <li>• {job.conflicts} bản ghi khác biệt so với hiện trạng</li>
                      <li>• Chiến lược: giữ bản mới hơn (mặc định)</li>
                      <li>• Cần review trước khi áp dụng</li>
                    </ul>
                  ) : <p className="text-sm text-success-darker dark:text-success-lighter">Không phát hiện xung đột.</p>}
                </SectionCard>
              </div>

              <SectionCard accent="warning" title="Cổng phê duyệt & xác minh">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={job.approvedBy ? "success" : "warning"}>{job.approvedBy ? `Đã duyệt bởi ${job.approvedBy}` : "Chưa phê duyệt"}</Badge>
                  <Badge tone={job.state === "completed" ? "success" : "info"}>Xác minh: {job.state === "completed" ? "PASS" : "đang chờ"}</Badge>
                  <div className="ml-auto flex gap-2">
                    <button type="button" disabled={!live} title={live ? "" : "Cần /api/backup/restores"} className={`rounded-lg border px-3.5 py-2 text-sm font-medium ${live ? "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-200" : "cursor-not-allowed border-gray-200 text-gray-400 dark:border-dark-600"}`}>Huỷ</button>
                    <button type="button" disabled={!live} title={live ? "" : "Cần /api/backup/restores/:id/approve"} className={`rounded-lg px-3.5 py-2 text-sm font-medium text-white ${live ? "bg-primary-600 hover:bg-primary-700" : "cursor-not-allowed bg-primary-600/50"}`}>Phê duyệt & áp dụng</button>
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-400">Áp dụng chỉ khả dụng sau khi xác minh PASS và có phê duyệt (không tự duyệt yêu cầu của chính mình).</p>
              </SectionCard>
            </>
          ) : (
            <SectionCard title="Chi tiết"><p className="text-sm text-gray-500">Chưa có phiên khôi phục nào.</p></SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
