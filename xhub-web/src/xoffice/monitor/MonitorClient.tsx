"use client";

// WF-10 — Runtime monitor interactive shell. Renders instances / open approval
// tasks / audit timeline and drives the request→task→act→audit lifecycle.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";

import { SectionCard } from "@/xhub/ui/Card";
import { Badge, type Tone } from "@/xhub/ui/Badge";
import { StatCard } from "@/xhub/ui/StatCard";
import type { MonitorSnapshot } from "@/xoffice/lib/monitor-data";
import { actOnTask, type Identity } from "./actions.client";

const statusTone: Record<string, Tone> = {
  running: "info",
  completed: "success",
  rejected: "error",
  cancelled: "neutral",
};

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function MonitorClient({
  snapshot,
  identity,
}: {
  snapshot: MonitorSnapshot;
  identity: Identity;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const { instances, tasks, audit, commands, source } = snapshot;
  const openTasks = tasks.filter((t) => t.status === "open");

  const refresh = () => startTransition(() => router.refresh());

  const handleAct = async (taskId: string, action: "approve" | "reject") => {
    setBusyId(taskId);
    setError(null);
    try {
      await actOnTask(identity, taskId, action, notes[taskId]?.trim() || undefined);
      setFlash(action === "approve" ? "Đã duyệt task." : "Đã từ chối task.");
      setNotes((n) => ({ ...n, [taskId]: "" }));
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">
            Giám sát vận hành
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            Theo dõi instance đang chạy, SLA, approval task và audit của X.Office
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={source === "api" ? "success" : "warning"}>
            {source === "api" ? "Kết nối backend" : "Backend offline"}
          </Badge>
          <Link
            href="/office/workflows"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 text-sm font-medium text-white transition hover:bg-primary-700"
          >
            <span aria-hidden>➕</span>
            Tạo request bằng biểu mẫu
          </Link>
        </div>
      </div>

      {(flash || error || isPending) && (
        <div
          className={clsx(
            "rounded-lg px-3 py-2 text-sm",
            error
              ? "bg-error/10 text-error-darker dark:text-error-lighter"
              : "bg-info/10 text-info-darker dark:text-info-lighter",
          )}
        >
          {error ?? (isPending ? "Đang cập nhật…" : flash)}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Instance đang chạy" value={String(instances.filter((i) => i.status === "running").length)} icon="⚙️" tone="info" />
        <StatCard label="Tổng instance" value={String(instances.length)} icon="🗂️" tone="primary" />
        <StatCard label="Task chờ duyệt" value={String(openTasks.length)} icon="✅" tone="warning" />
        <StatCard label="Bản ghi audit" value={String(audit.length)} icon="📜" tone="success" />
      </div>

      <SectionCard title="Instance đang vận hành" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-400 dark:border-dark-600 dark:text-dark-300">
              <tr>
                <th className="px-4 py-3">Mã / Tiêu đề</th>
                <th className="px-4 py-3">Quy trình</th>
                <th className="px-4 py-3">Node hiện tại</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-center">SLA (giờ)</th>
                <th className="px-4 py-3">Cập nhật</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
              {instances.map((inst) => (
                <tr key={inst.instanceCode} className="hover:bg-gray-50 dark:hover:bg-dark-700/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 dark:text-dark-100">{inst.title}</p>
                    <p className="font-mono text-xs text-gray-400">{inst.instanceCode}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-dark-300">
                    {inst.workflowCode}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-dark-200">
                    {inst.currentNodeName ?? inst.currentNodeId}
                    {inst.currentNodeType ? (
                      <span className="ml-1 text-xs text-gray-400">({inst.currentNodeType})</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge tone={statusTone[inst.status] ?? "neutral"}>{inst.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 dark:text-dark-200">
                    {inst.slaHours ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-dark-300">
                    {fmtTime(inst.updatedAt)}
                  </td>
                </tr>
              ))}
              {instances.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    Chưa có instance. Nhấn “Tạo request demo” để bắt đầu vòng đời.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title={`Lệnh connector (${commands.length})`} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-400 dark:border-dark-600 dark:text-dark-300">
              <tr>
                <th className="px-4 py-3">Instance</th>
                <th className="px-4 py-3">Connector / Action</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3">Payload</th>
                <th className="px-4 py-3">Kết quả</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
              {commands.map((c) => (
                <tr key={c.id} className="align-top hover:bg-gray-50 dark:hover:bg-dark-700/40">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-dark-300">{c.instanceCode}</td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-gray-700 dark:text-dark-100">{c.connectorCode}</p>
                    <p className="font-mono text-xs text-gray-400">{c.actionCode}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge tone={statusTone[c.status] ?? "neutral"}>{c.status}</Badge>
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-tiny text-gray-500 dark:text-dark-300">
                      {c.payload ? JSON.stringify(c.payload, null, 2) : "—"}
                    </pre>
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-tiny text-gray-500 dark:text-dark-300">
                      {c.result != null ? (typeof c.result === "string" ? c.result : JSON.stringify(c.result, null, 2)) : "—"}
                    </pre>
                  </td>
                </tr>
              ))}
              {commands.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Chưa có lệnh connector nào. Lệnh phát sinh khi instance chạy tới node “Gọi hệ thống”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={`Task chờ duyệt (${openTasks.length})`}>
          <div className="space-y-3">
            {openTasks.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-gray-200 p-3 dark:border-dark-600"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-dark-100">{t.nodeName}</p>
                    <p className="font-mono text-xs text-gray-400">
                      {t.instanceCode} · {t.id}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-dark-300">
                      Vai trò: {t.assigneeRole}
                      {t.slaHours ? ` · SLA ${t.slaHours}h` : ""}
                    </p>
                  </div>
                  <Badge tone="warning">Chờ duyệt</Badge>
                </div>
                <input
                  value={notes[t.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [t.id]: e.target.value }))}
                  placeholder="Ghi chú (tuỳ chọn)…"
                  className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => handleAct(t.id, "approve")}
                    disabled={busyId === t.id}
                    className="flex-1 rounded-lg bg-success py-1.5 text-xs-plus font-medium text-white transition hover:bg-success-darker disabled:opacity-50"
                  >
                    {busyId === t.id ? "…" : "Duyệt"}
                  </button>
                  <button
                    onClick={() => handleAct(t.id, "reject")}
                    disabled={busyId === t.id}
                    className="flex-1 rounded-lg border border-error/50 py-1.5 text-xs-plus font-medium text-error transition hover:bg-error/10 disabled:opacity-50"
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
            {openTasks.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">
                Không có task nào đang chờ duyệt.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Timeline audit (append-only)">
          <ol className="space-y-3">
            {audit.map((a) => (
              <li key={a.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-500" />
                  <span className="mt-1 w-px flex-1 bg-gray-200 dark:bg-dark-600" />
                </div>
                <div className="pb-1">
                  <p className="text-sm text-gray-700 dark:text-dark-100">{a.detail}</p>
                  <p className="text-xs text-gray-400">
                    {a.action} · {a.instanceCode} · {a.actorId} · {fmtTime(a.at)}
                  </p>
                </div>
              </li>
            ))}
            {audit.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">
                Chưa có bản ghi audit. Duyệt/tạo request để sinh timeline.
              </p>
            )}
          </ol>
        </SectionCard>
      </div>
    </div>
  );
}
