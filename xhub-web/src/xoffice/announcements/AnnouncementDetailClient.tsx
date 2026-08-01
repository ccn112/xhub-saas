"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { SectionCard } from "@/xhub/ui/Card";
import type { AnnouncementDetail } from "@/xoffice/lib/announcements-data";
import {
  ANNOUNCEMENT_ACTION_LABEL,
  ANNOUNCEMENT_STATE_LABEL,
  ANNOUNCEMENT_STATE_TONE,
  AUDIENCE_LABEL,
  PRIORITY_LABEL,
  fmtTime,
} from "./announcement-states";

// Live announcement detail (PH-02e — NX-028): header + state + audience + body +
// recipient action bar (Đã đọc / Xác nhận) + author panel (publish/archive/cancel/
// remind) + read/ack report (delivered/read/acked counts + per-user list) +
// timeline + attachments. All mutations go through the BFF proxy then refresh.
export function AnnouncementDetailClient({ detail, currentUserId }: { detail: AnnouncementDetail; currentUserId: string }) {
  const router = useRouter();
  const { announcement, events, attachments, report, myReceipt } = detail;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function call(path: string, body?: unknown) {
    setBusy(path);
    setErr(null);
    try {
      const res = await fetch(`/api/announcements/${announcement.id}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(res.status === 403 ? "Bạn không có quyền thực hiện thao tác này." : (j?.detail?.message ?? j?.error ?? `Lỗi ${res.status}`));
      } else {
        router.refresh();
      }
    } catch {
      setErr("Không kết nối được backend");
    } finally {
      setBusy(null);
    }
  }

  const legal = announcement.legalActions ?? [];
  const isAuthor = announcement.authorId === currentUserId;
  const isRecipient = myReceipt != null;
  const pct = report.counts.delivered ? Math.round((report.counts.read / report.counts.delivered) * 100) : 0;
  const ackPct = report.counts.delivered ? Math.round((report.counts.acknowledged / report.counts.delivered) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{announcement.title}</h1>
            <Badge tone={ANNOUNCEMENT_STATE_TONE[announcement.state] ?? "neutral"}>{ANNOUNCEMENT_STATE_LABEL[announcement.state] ?? announcement.state}</Badge>
            {announcement.requireAck && <Badge tone="warning">Cần xác nhận</Badge>}
          </div>
          <p className="font-mono text-xs text-gray-400">{announcement.code}</p>
        </div>
        <button onClick={() => router.push("/office/announcements")} className="text-sm text-primary-600 hover:underline dark:text-primary-400">
          ← Thông báo nội bộ
        </button>
      </div>

      {err && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{err}</div>}

      {/* Recipient action bar */}
      {isRecipient && (
        <SectionCard title="Thao tác của bạn" accent="info">
          <div className="flex flex-wrap items-center gap-3">
            {myReceipt?.readAt ? <Badge tone="success">Đã đọc · {fmtTime(myReceipt.readAt)}</Badge> : <Badge tone="info">Chưa đọc</Badge>}
            {announcement.requireAck && (myReceipt?.acknowledgedAt ? <Badge tone="success">Đã xác nhận · {fmtTime(myReceipt.acknowledgedAt)}</Badge> : <Badge tone="warning">Chưa xác nhận</Badge>)}
            <div className="ml-auto flex gap-2">
              {!myReceipt?.readAt && (
                <button disabled={!!busy} onClick={() => call("/read")} className={btnCls("primary") + " disabled:opacity-50"}>{busy === "/read" ? "…" : "Đánh dấu đã đọc"}</button>
              )}
              {announcement.requireAck && !myReceipt?.acknowledgedAt && (
                <button disabled={!!busy} onClick={() => call("/acknowledge")} className={btnCls("success") + " disabled:opacity-50"}>{busy === "/acknowledge" ? "…" : "Xác nhận đã đọc"}</button>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Meta */}
      <SectionCard title="Thông tin thông báo" accent="primary">
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Meta label="Người soạn" value={announcement.authorId} />
          <Meta label="Đối tượng" value={`${AUDIENCE_LABEL[announcement.audienceType] ?? announcement.audienceType}${announcement.audienceId ? ` · ${announcement.audienceId}` : ""}`} />
          <Meta label="Ưu tiên" value={PRIORITY_LABEL[announcement.priority] ?? announcement.priority} />
          <Meta label="Phát hành" value={fmtTime(announcement.publishAt)} />
        </dl>
        {announcement.body && <p className="mt-3 whitespace-pre-wrap text-sm text-gray-600 dark:text-dark-200">{announcement.body}</p>}
      </SectionCard>

      {/* Author panel: lifecycle + reminder + report */}
      {isAuthor && (
        <SectionCard title="Bảng điều khiển tác giả" accent="warning">
          <div className="flex flex-wrap items-center gap-2">
            {legal.map((a) => {
              const meta = ANNOUNCEMENT_ACTION_LABEL[a];
              if (!meta) return null;
              return (
                <button key={a} disabled={!!busy} onClick={() => call(`/${a}`)} className={btnCls(meta.tone) + " disabled:opacity-50"}>
                  {busy === `/${a}` ? "…" : meta.label}
                </button>
              );
            })}
            {announcement.state === "PUBLISHED" && (
              <button disabled={!!busy} onClick={() => call("/remind")} className={btnCls("info") + " disabled:opacity-50"}>
                {busy === "/remind" ? "…" : "Nhắc lại (mô phỏng)"}
              </button>
            )}
            {legal.length === 0 && announcement.state !== "PUBLISHED" && <span className="text-sm text-gray-400">Không có thao tác ở trạng thái này.</span>}
          </div>

          {/* Read / ack report */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="Đã gửi" value={report.counts.delivered} tone="neutral" />
            <Stat label={`Đã đọc (${pct}%)`} value={report.counts.read} tone="info" />
            <Stat label={announcement.requireAck ? `Đã xác nhận (${ackPct}%)` : "Đã xác nhận"} value={report.counts.acknowledged} tone="success" />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-400 dark:border-dark-500">
                  <th className="py-1.5 pr-3">Người nhận</th>
                  <th className="py-1.5 pr-3">Đã gửi</th>
                  <th className="py-1.5 pr-3">Đã đọc</th>
                  <th className="py-1.5 pr-3">Đã xác nhận</th>
                  <th className="py-1.5">Nhắc</th>
                </tr>
              </thead>
              <tbody>
                {report.recipients.map((r) => (
                  <tr key={r.userId} className="border-b border-gray-100 dark:border-dark-600">
                    <td className="py-1.5 pr-3 font-mono text-xs text-gray-600 dark:text-dark-200">{r.userId}</td>
                    <td className="py-1.5 pr-3 text-xs text-gray-500">{fmtTime(r.deliveredAt)}</td>
                    <td className="py-1.5 pr-3">{r.readAt ? <Badge tone="info">{fmtTime(r.readAt)}</Badge> : <span className="text-gray-300">—</span>}</td>
                    <td className="py-1.5 pr-3">{r.acknowledgedAt ? <Badge tone="success">{fmtTime(r.acknowledgedAt)}</Badge> : <span className="text-gray-300">—</span>}</td>
                    <td className="py-1.5 text-xs text-gray-500">{r.remindCount > 0 ? `×${r.remindCount}` : "—"}</td>
                  </tr>
                ))}
                {report.recipients.length === 0 && (
                  <tr><td colSpan={5} className="py-2 text-sm text-gray-400">Chưa phát hành — chưa có người nhận.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Timeline */}
        <SectionCard title="Dòng thời gian" accent="info">
          <ol className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-primary-500" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-dark-100">{e.type}{typeof (e.data as { body?: string })?.body === "string" ? `: ${(e.data as { body: string }).body}` : ""}</p>
                  <p className="text-xs text-gray-400">{fmtTime(e.createdAt)} · {e.actorId}</p>
                </div>
              </li>
            ))}
            {events.length === 0 && <li className="text-sm text-gray-400">Chưa có sự kiện.</li>}
          </ol>
        </SectionCard>

        {/* Attachments */}
        <SectionCard title="Tệp đính kèm (RecordDocument)" accent="warning">
          <ul className="space-y-2">
            {attachments.map((d) => (
              <li key={d.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-dark-100">📎 {d.title}</span>
                <span className="text-xs text-gray-400">{d.kind}</span>
              </li>
            ))}
            {attachments.length === 0 && <li className="text-sm text-gray-400">Chưa có tệp.</li>}
          </ul>
        </SectionCard>
      </div>
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

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const map: Record<string, string> = {
    neutral: "text-gray-700 dark:text-dark-100",
    info: "text-sky-600 dark:text-sky-400",
    success: "text-emerald-600 dark:text-emerald-400",
  };
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2 dark:border-dark-500">
      <p className="text-xs uppercase text-gray-400">{label}</p>
      <p className={"text-2xl font-bold " + (map[tone] ?? map.neutral)}>{value}</p>
    </div>
  );
}

function btnCls(tone: string): string {
  const map: Record<string, string> = {
    primary: "bg-primary-600 text-white hover:bg-primary-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    error: "bg-red-600 text-white hover:bg-red-700",
    warning: "bg-amber-500 text-white hover:bg-amber-600",
    info: "bg-sky-600 text-white hover:bg-sky-700",
    neutral: "border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-dark-500 dark:text-dark-100 dark:hover:bg-dark-600",
  };
  return "inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium transition " + (map[tone] ?? map.neutral);
}
