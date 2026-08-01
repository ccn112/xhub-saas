"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { SectionCard } from "@/xhub/ui/Card";
import type { RequestDetail } from "@/xoffice/lib/requests-data";
import { ACTION_LABEL, STATE_LABEL, STATE_TONE, fmtAmount, fmtTime } from "./request-states";

// Live task/request detail (XH-05 family): header + state badge + timeline
// (RequestEvent) + comments + attachments + a state-gated action bar. All
// mutations go through the BFF proxy (/api/requests/*) then refresh the server
// component so the timeline reflects the new source-of-record state.
export function RequestDetailClient({ detail }: { detail: RequestDetail }) {
  const router = useRouter();
  const { request, events, comments, attachments, executions } = detail;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const pendingExec = executions.find((e) => e.status !== "completed");

  async function call(path: string, body?: unknown) {
    setBusy(path);
    setErr(null);
    try {
      const res = await fetch(`/api/requests/${request.id}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j?.detail?.message ?? j?.error ?? `Lỗi ${res.status}`);
      } else {
        router.refresh();
        setComment("");
      }
    } catch {
      setErr("Không kết nối được backend");
    } finally {
      setBusy(null);
    }
  }

  const legal = request.legalActions ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{request.title}</h1>
            <Badge tone={STATE_TONE[request.state] ?? "neutral"}>{STATE_LABEL[request.state] ?? request.state}</Badge>
          </div>
          <p className="font-mono text-xs text-gray-400">{request.code} · {request.procedureName ?? request.procedureCode}</p>
        </div>
        <button onClick={() => router.push("/office/requests")} className="text-sm text-primary-600 hover:underline dark:text-primary-400">
          ← Trung tâm yêu cầu
        </button>
      </div>

      {err && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{err}</div>}

      {/* Meta + action bar */}
      <SectionCard title="Thông tin & thao tác" accent="primary">
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Meta label="Người tạo" value={request.requesterId} />
          <Meta label="Số tiền" value={fmtAmount(request.amount, request.currency)} />
          <Meta label="Người duyệt" value={request.approverId ?? request.approverRole ?? "—"} />
          <Meta label="Tạo lúc" value={fmtTime(request.createdAt)} />
        </dl>
        {request.summary && <p className="mt-3 text-sm text-gray-600 dark:text-dark-200">{request.summary}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {legal.filter((a) => a !== "evidence").map((a) => {
            const meta = ACTION_LABEL[a];
            if (!meta) return null;
            return (
              <button
                key={a}
                disabled={!!busy}
                onClick={() => call(`/${a}`)}
                className={btnCls(meta.tone) + " disabled:opacity-50"}
              >
                {busy === `/${a}` ? "…" : meta.label}
              </button>
            );
          })}
          {legal.length === 0 && <span className="text-sm text-gray-400">Không có thao tác khả dụng ở trạng thái này (kết thúc).</span>}
        </div>

        {/* Evidence form when EXECUTING with a pending manual execution */}
        {request.state === "EXECUTING" && pendingExec && (
          <EvidenceForm busy={!!busy} onSubmit={(b) => call(`/execution/${pendingExec.id}/evidence`, b)} />
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Timeline */}
        <SectionCard title="Dòng thời gian (audit)" accent="info">
          <ol className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-primary-500" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-dark-100">{e.type}</p>
                  <p className="text-xs text-gray-400">{fmtTime(e.createdAt)} · {e.actorId}</p>
                  {typeof (e.data as { to?: string })?.to === "string" && (
                    <p className="text-xs text-gray-500">→ {STATE_LABEL[(e.data as { to: string }).to] ?? (e.data as { to: string }).to}</p>
                  )}
                </div>
              </li>
            ))}
            {events.length === 0 && <li className="text-sm text-gray-400">Chưa có sự kiện.</li>}
          </ol>
        </SectionCard>

        {/* Attachments + executions */}
        <div className="space-y-4">
          <SectionCard title="Tài liệu đính kèm" accent="neutral">
            <ul className="space-y-2">
              {attachments.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-dark-100">📎 {d.title}</span>
                  <span className="text-xs text-gray-400">{d.kind}</span>
                </li>
              ))}
              {attachments.length === 0 && <li className="text-sm text-gray-400">Chưa có tài liệu.</li>}
            </ul>
            <AttachmentForm busy={!!busy} onSubmit={(b) => call(`/attachments`, b)} />
          </SectionCard>

          {executions.length > 0 && (
            <SectionCard title="Thực hiện thủ công (bằng chứng)" accent="warning">
              <ul className="space-y-2 text-sm">
                {executions.map((x) => (
                  <li key={x.id} className="flex items-center justify-between">
                    <span className="font-mono text-xs text-gray-600 dark:text-dark-200">{x.connectorCode}/{x.actionCode}</span>
                    <span className="flex items-center gap-2">
                      {x.referenceCode && <span className="font-mono text-xs text-gray-500">{x.referenceSystem}:{x.referenceCode}</span>}
                      <Badge tone={x.status === "completed" ? "success" : "warning"}>{x.status}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      </div>

      {/* Comments */}
      <SectionCard title="Bình luận" accent="primary">
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-gray-150 p-3 dark:border-dark-600">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800 dark:text-dark-100">{c.authorId}</span>
                <span className="text-xs text-gray-400">{fmtTime(c.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-gray-700 dark:text-dark-200">{c.body}</p>
              {c.mentions?.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-1">
                  {c.mentions.map((m) => <Badge key={m} tone="info">@{m}</Badge>)}
                </p>
              )}
            </li>
          ))}
          {comments.length === 0 && <li className="text-sm text-gray-400">Chưa có bình luận.</li>}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Viết bình luận… dùng @tên để nhắc đến ai đó"
            className="h-9 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-primary-500 dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50"
          />
          <button
            disabled={!!busy || !comment.trim()}
            onClick={() => call(`/comments`, { body: comment })}
            className={btnCls("primary") + " disabled:opacity-50"}
          >
            Gửi
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-gray-400">{label}</dt>
      <dd className="text-sm font-medium text-gray-800 dark:text-dark-100">{value}</dd>
    </div>
  );
}

function EvidenceForm({ busy, onSubmit }: { busy: boolean; onSubmit: (b: Record<string, string>) => void }) {
  const [ref, setRef] = useState("");
  const [system, setSystem] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/30">
      <p className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-300">Nhập bằng chứng thực hiện thật (không tạo chứng từ giả)</p>
      <div className="flex flex-wrap gap-2">
        <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Mã tham chiếu thật (vd MR-…)" className="h-9 w-56 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
        <input value={system} onChange={(e) => setSystem(e.target.value)} placeholder="Hệ thống (vd FINERP)" className="h-9 w-40 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú" className="h-9 flex-1 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
        <button disabled={busy || !ref.trim()} onClick={() => onSubmit({ referenceCode: ref, referenceSystem: system, note })} className={btnCls("success") + " disabled:opacity-50"}>
          Đính bằng chứng & Hoàn tất
        </button>
      </div>
    </div>
  );
}

function AttachmentForm({ busy, onSubmit }: { busy: boolean; onSubmit: (b: Record<string, string>) => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên tài liệu" className="h-9 w-48 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
      <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Nội dung / ghi chú" className="h-9 flex-1 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
      <button disabled={busy || !title.trim()} onClick={() => onSubmit({ title, content: content || title, mimeType: "text/plain" })} className={btnCls("neutral") + " disabled:opacity-50"}>
        Đính kèm
      </button>
    </div>
  );
}

function btnCls(tone: string): string {
  const map: Record<string, string> = {
    primary: "bg-primary-600 text-white hover:bg-primary-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    error: "bg-red-600 text-white hover:bg-red-700",
    warning: "bg-amber-500 text-white hover:bg-amber-600",
    neutral: "border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-dark-500 dark:text-dark-100 dark:hover:bg-dark-600",
  };
  return "inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium transition " + (map[tone] ?? map.neutral);
}
