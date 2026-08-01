"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { SectionCard } from "@/xhub/ui/Card";
import type { WorkItemDetail } from "@/xoffice/lib/work-items-data";
import { STATUS_LABEL, STATUS_TONE, TYPE_LABEL, PRIORITY_LABEL, PRIORITY_TONE, fmtDate } from "./work-states";

/**
 * Detail for a NativeWorkItem. If the server returned SUMMARY tier (coordination
 * viewer, owner requirement #1), only the summary panel renders — no
 * description/comments/checklist/attachments are present in the payload.
 */
export function WorkDetailClient({ detail }: { detail: WorkItemDetail }) {
  const router = useRouter();
  const item = detail.item;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [checklistLabel, setChecklistLabel] = useState("");

  async function act(path: string, body: unknown, key: string) {
    setBusy(key); setError(null);
    try {
      const res = await fetch(`/api/work/items/${item.id}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j?.detail?.message ?? "Thao tác thất bại"); return; }
      router.refresh();
    } catch { setError("Backend không phản hồi"); } finally { setBusy(null); }
  }

  const isSummary = item.tier === "SUMMARY";

  return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-primary-600">← Quay lại</button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{item.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_TONE[item.status] ?? "neutral"}>{STATUS_LABEL[item.status] ?? item.status}</Badge>
            <Badge tone="neutral">{TYPE_LABEL[item.type] ?? item.type}</Badge>
            {item.priority && <Badge tone={PRIORITY_TONE[item.priority] ?? "neutral"}>{PRIORITY_LABEL[item.priority] ?? item.priority}</Badge>}
            {item.overdue && <Badge tone="error">Quá hạn</Badge>}
            {isSummary && <Badge tone="info">Chia sẻ phối hợp (tóm tắt)</Badge>}
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p>Tiến độ: <span className="font-semibold text-gray-800 dark:text-dark-100">{item.progressPercent}%</span></p>
          <p>Bắt đầu KH: {fmtDate(item.plannedStart)}</p>
          <p>Hạn: {fmtDate(item.dueAt)}</p>
        </div>
      </div>

      {error && <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}

      {isSummary ? (
        <SectionCard title="Tóm tắt phối hợp" accent="info">
          <p className="text-sm text-gray-500 dark:text-dark-300">
            Bạn đang xem ở chế độ <b>tóm tắt</b>. Chi tiết (mô tả, việc con, tài liệu, bình luận) chỉ hiển thị cho
            người phụ trách / thành viên dự án.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Info label="Trạng thái" value={STATUS_LABEL[item.status] ?? item.status} />
            <Info label="Tiến độ" value={`${item.progressPercent}%`} />
            <Info label="Bắt đầu KH" value={fmtDate(item.plannedStart)} />
            <Info label="Hạn" value={fmtDate(item.dueAt)} />
            <Info label="Là mốc" value={item.isMilestone ? "Có" : "Không"} />
          </dl>
        </SectionCard>
      ) : (
        <>
          {/* Lifecycle actions */}
          <SectionCard title="Thao tác" accent="primary">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-gray-400">Chuyển trạng thái:</span>
                {(item.legalStatusTargets ?? []).map((s) => (
                  <button key={s} disabled={!!busy} onClick={() => act("status", { to: s }, `st-${s}`)}
                    className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium hover:border-primary-400 disabled:opacity-40 dark:border-dark-500">
                    → {STATUS_LABEL[s] ?? s}
                  </button>
                ))}
                {(item.legalStatusTargets ?? []).length === 0 && <span className="text-xs text-gray-400">(không có bước tiếp theo)</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400">Tiến độ:</span>
                {[0, 25, 50, 75, 100].map((p) => (
                  <button key={p} disabled={!!busy} onClick={() => act("progress", { progressPercent: p }, `pr-${p}`)}
                    className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs hover:border-primary-400 disabled:opacity-40 dark:border-dark-500">{p}%</button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400">Giao việc (đơn vị Delivery):</span>
                <button disabled={!!busy} onClick={() => act("assign", { selectorType: "ORG_UNIT_HEAD", orgUnitId: "ou-delivery" }, "assign")}
                  className="rounded-lg border border-gray-300 px-3 py-1 text-xs hover:border-primary-400 disabled:opacity-40 dark:border-dark-500">Phân công qua Org Core</button>
                {(item.assigneeIds ?? []).length > 0 && <span className="text-xs text-gray-500">Người nhận: {(item.assigneeIds ?? []).join(", ")}</span>}
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Thông tin" accent="neutral">
              {item.description ? <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-dark-100">{item.description}</p> : <p className="text-sm text-gray-400">Chưa có mô tả</p>}
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <Info label="Người tạo" value={String((item as unknown as Record<string, unknown>).createdBy ?? "—")} />
                <Info label="Chủ sở hữu" value={item.ownerId ?? "—"} />
                <Info label="WBS" value={item.wbsCode ?? "—"} />
                <Info label="Dự án" value={item.projectId ?? "— (chưa gắn)"} />
              </dl>
              {(item.tags ?? []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {(item.tags ?? []).map((t) => <span key={t} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-dark-600 dark:text-dark-200">#{t}</span>)}
                </div>
              )}
              {item.dimensions && Object.keys(item.dimensions).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(item.dimensions).map(([k, v]) => <Badge key={k} tone="primary">{k}: {v}</Badge>)}
                </div>
              )}
            </SectionCard>

            <SectionCard title={`Checklist (${detail.checklist?.length ?? 0})`} accent="neutral">
              <ul className="space-y-1.5">
                {(detail.checklist ?? []).map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={c.done} disabled={!!busy} onChange={() => act(`checklist/${c.id}/toggle`, { done: !c.done }, `chk-${c.id}`)} className="size-4" />
                    <span className={c.done ? "text-gray-400 line-through" : "text-gray-700 dark:text-dark-100"}>{c.label}</span>
                  </li>
                ))}
                {(detail.checklist ?? []).length === 0 && <li className="text-sm text-gray-400">Chưa có mục nào</li>}
              </ul>
              <div className="mt-2 flex gap-2">
                <input value={checklistLabel} onChange={(e) => setChecklistLabel(e.target.value)} placeholder="Thêm mục…" className="h-8 flex-1 rounded-lg border border-gray-300 px-2 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
                <button disabled={!!busy || !checklistLabel.trim()} onClick={() => { act("checklist", { label: checklistLabel.trim() }, "chk-add"); setChecklistLabel(""); }} className="h-8 rounded-lg bg-primary-600 px-3 text-xs text-white disabled:opacity-40">Thêm</button>
              </div>
            </SectionCard>
          </div>

          <SectionCard title={`Bình luận (${detail.comments?.length ?? 0})`} accent="neutral">
            <ul className="space-y-2">
              {(detail.comments ?? []).map((c) => (
                <li key={c.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-dark-600/40">
                  <p className="text-gray-700 dark:text-dark-100">{c.body}</p>
                  <p className="mt-0.5 text-[11px] text-gray-400">{c.authorId} · {fmtDate(c.createdAt)}</p>
                </li>
              ))}
              {(detail.comments ?? []).length === 0 && <li className="text-sm text-gray-400">Chưa có bình luận</li>}
            </ul>
            <div className="mt-2 flex gap-2">
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Viết bình luận…" className="h-9 flex-1 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
              <button disabled={!!busy || !comment.trim()} onClick={() => { act("comment", { body: comment.trim() }, "cm-add"); setComment(""); }} className="h-9 rounded-lg bg-primary-600 px-4 text-sm text-white disabled:opacity-40">Gửi</button>
            </div>
          </SectionCard>

          {(detail.children ?? []).length > 0 && (
            <SectionCard title={`Việc con (${detail.children?.length ?? 0})`} accent="neutral">
              <ul className="space-y-1.5">
                {(detail.children ?? []).map((c) => (
                  <li key={c.id} onClick={() => router.push(`/work/items/${c.id}`)} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-dark-600/40">
                    <span className="text-gray-700 dark:text-dark-100">{c.title}</span>
                    <span className="flex items-center gap-2"><Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{STATUS_LABEL[c.status] ?? c.status}</Badge><span className="text-xs text-gray-400">{c.progressPercent}%</span></span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          <SectionCard title={`Tài liệu (${detail.attachments?.length ?? 0})`} accent="neutral">
            <ul className="space-y-1">
              {(detail.attachments ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-dark-100">📎 {a.title}</span>
                  <span className="text-[11px] text-gray-400">{a.kind} · {fmtDate(a.createdAt)}</span>
                </li>
              ))}
              {(detail.attachments ?? []).length === 0 && <li className="text-sm text-gray-400">Chưa có tài liệu</li>}
            </ul>
            <button disabled={!!busy} onClick={() => act("attachments", { title: `Ghi chú ${new Date().toLocaleString("vi-VN")}`, content: "Nội dung đính kèm nhanh." }, "att-add")} className="mt-2 rounded-lg border border-gray-300 px-3 py-1 text-xs hover:border-primary-400 disabled:opacity-40 dark:border-dark-500">+ Đính kèm ghi chú</button>
          </SectionCard>

          <SectionCard title="Dòng thời gian" accent="neutral">
            <ul className="space-y-1.5">
              {(detail.events ?? []).slice().reverse().map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-mono text-gray-400">{fmtDate(e.createdAt)}</span>
                  <Badge tone="neutral">{e.type}</Badge>
                  <span>{e.actorId}</span>
                </li>
              ))}
              {(detail.events ?? []).length === 0 && <li className="text-sm text-gray-400">Chưa có sự kiện</li>}
            </ul>
          </SectionCard>
        </>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-gray-700 dark:text-dark-100">{value}</dd>
    </div>
  );
}
