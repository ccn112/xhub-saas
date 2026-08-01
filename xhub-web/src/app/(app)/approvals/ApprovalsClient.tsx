"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge, type Tone } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { vnd, dateTimeVN } from "@/xhub/lib/format";

export interface QueueStep { name: string; assigneeName: string; status: string }
export interface QueueApproval {
  id: string;
  code: string;
  type: string;
  typeLabel: string;
  title: string;
  requesterName: string;
  deptName: string;
  amount: number | null;
  priority: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  dueAt: string | null;
  slaLabel: string;
  slaTone: Tone;
  overdue: boolean;
  href: string | null;
  steps: QueueStep[];
}

const PRIO_TONE: Record<string, Tone> = { critical: "error", high: "error", medium: "warning", low: "neutral" };
const PRIO_LABEL: Record<string, string> = { critical: "Khẩn", high: "Cao", medium: "TB", low: "Thấp" };
const STEP_TONE: Record<string, Tone> = { approved: "success", pending: "warning", rejected: "error" };
const STEP_LABEL: Record<string, string> = { approved: "Đã duyệt", pending: "Chờ", rejected: "Từ chối" };

export function ApprovalsClient({ approvals }: { approvals: QueueApproval[] }) {
  const tabs = [
    { key: "all", label: "Tất cả" },
    { key: "pending", label: "Chờ duyệt" },
    { key: "overdue", label: "Quá hạn SLA" },
  ];
  const [tab, setTab] = useState("all");
  const [selectedId, setSelectedId] = useState(approvals[0]?.id ?? null);

  const visible = useMemo(
    () =>
      approvals.filter((a) => {
        if (tab === "pending") return a.status === "pending";
        if (tab === "overdue") return a.overdue || a.status === "overdue";
        return true;
      }),
    [approvals, tab],
  );

  const selected = visible.find((a) => a.id === selectedId) ?? visible[0] ?? null;
  const countFor = (key: string) => approvals.filter((a) => (key === "pending" ? a.status === "pending" : key === "overdue" ? a.overdue || a.status === "overdue" : true)).length;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2">
        <SectionCard accent="warning" title="Hàng đợi phê duyệt" bodyClassName="p-0">
          <div className="flex flex-wrap gap-1 border-b border-gray-200 px-2 pt-2 dark:border-dark-600">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-pressed={tab === t.key}
                className={`rounded-t-lg px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${tab === t.key ? "border-b-2 border-primary-600 text-primary-600" : "text-gray-500 hover:text-gray-700 dark:text-dark-300"}`}
              >
                {t.label} <span className="text-xs text-gray-400">({countFor(t.key)})</span>
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <span className="text-3xl">🎉</span>
              <p className="text-sm font-medium text-gray-700 dark:text-dark-100">Không có yêu cầu nào</p>
              <p className="text-xs text-gray-400">Bạn đã xử lý hết mục ở bộ lọc này.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-dark-600">
              {visible.map((a) => {
                const active = selected?.id === a.id;
                return (
                  <li key={a.id}>
                    <button type="button" onClick={() => setSelectedId(a.id)} className={`flex w-full items-start gap-3 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 ${active ? "bg-primary-50/70 dark:bg-primary-950/30" : "hover:bg-gray-50 dark:hover:bg-dark-600/40"}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-gray-800 dark:text-dark-100">{a.title}</p>
                          <Badge tone="neutral">{a.code}</Badge>
                          <Badge tone={PRIO_TONE[a.priority] ?? "neutral"}>{PRIO_LABEL[a.priority] ?? a.priority}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-400">{a.typeLabel} · {a.requesterName} · {a.deptName}</p>
                        <p className="mt-0.5 text-xs text-gray-400">Bước {a.currentStep}/{a.totalSteps} · {a.amount != null ? vnd(a.amount) : "Không có giá trị tiền"}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <Badge tone={a.slaTone}>{a.slaLabel}</Badge>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="space-y-4">
        {selected ? (
          <>
            <SectionCard title="Tóm tắt yêu cầu" action={selected.href ? <Link href={selected.href} className="text-sm text-primary-600 hover:underline">Mở chi tiết →</Link> : null}>
              <div className="space-y-3">
                <div>
                  <p className="font-heading font-semibold text-gray-800 dark:text-dark-50">{selected.title}</p>
                  <p className="text-xs text-gray-400">{selected.code} · {selected.typeLabel}</p>
                </div>
                <dl className="space-y-2 text-sm">
                  <Row label="Người đề nghị" value={selected.requesterName} />
                  <Row label="Phòng ban" value={selected.deptName} />
                  <Row label="Giá trị" value={selected.amount != null ? vnd(selected.amount) : "—"} />
                  <Row label="Hạn xử lý" value={dateTimeVN(selected.dueAt)} />
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-gray-400">SLA</dt>
                    <dd><Badge tone={selected.slaTone}>{selected.slaLabel}</Badge></dd>
                  </div>
                </dl>
              </div>
            </SectionCard>

            <SectionCard accent="warning" title={`Luồng phê duyệt (${selected.currentStep}/${selected.totalSteps})`}>
              <ol className="space-y-3">
                {selected.steps.map((s, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${s.status === "approved" ? "bg-success text-white" : s.status === "pending" ? "bg-warning text-white" : "bg-gray-200 text-gray-500 dark:bg-dark-500"}`}>{s.status === "approved" ? "✓" : i + 1}</span>
                    <div className="flex-1"><p className="text-sm text-gray-800 dark:text-dark-100">{s.name}</p><p className="text-xs text-gray-400">{s.assigneeName}</p></div>
                    <Badge tone={STEP_TONE[s.status] ?? "neutral"}>{STEP_LABEL[s.status] ?? s.status}</Badge>
                  </li>
                ))}
                {selected.steps.length === 0 ? <p className="text-sm text-gray-500 dark:text-dark-300">Chưa cấu hình các bước phê duyệt.</p> : null}
              </ol>
            </SectionCard>

            <AiRecap
              title="X.AI kiểm tra nhanh"
              points={[
                selected.amount != null ? `Giá trị ${vnd(selected.amount)}, ${selected.amount >= 100_000_000 ? "vượt ngưỡng cần cấp cao duyệt" : "trong ngưỡng phê duyệt thường"}.` : "Yêu cầu phi tài chính.",
                selected.overdue ? `Cảnh báo: ${selected.slaLabel}, cần xử lý ngay.` : `Còn trong hạn SLA (${selected.slaLabel}).`,
                `Đang chờ ở bước ${selected.currentStep}/${selected.totalSteps}.`,
              ]}
              footnote="X.AI chỉ kiểm tra & cảnh báo — không tự phê duyệt."
            />

            <SectionCard title="Hành động">
              {selected.href ? (
                <Link href={selected.href} className="block w-full rounded-lg bg-primary-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                  Mở trang xử lý & phê duyệt
                </Link>
              ) : (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:bg-dark-600/40 dark:text-dark-300">
                  Mở yêu cầu để xem bằng chứng đầy đủ trước khi duyệt. Trang xử lý chi tiết hiện có cho đề nghị thanh toán.
                </p>
              )}
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-gray-400">{label}</dt>
      <dd className="text-right font-medium text-gray-700 dark:text-dark-100">{value}</dd>
    </div>
  );
}
