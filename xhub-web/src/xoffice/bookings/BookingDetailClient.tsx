"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { SectionCard } from "@/xhub/ui/Card";
import type { BookingDetail } from "@/xoffice/lib/bookings-data";
import {
  BOOKING_ACTION_LABEL,
  BOOKING_STATE_LABEL,
  BOOKING_STATE_TONE,
  RESOURCE_TYPE_LABEL,
  fmtRange,
  fmtTime,
} from "./booking-states";

// Live resource-booking detail (PH-02d — NX-027): header + state + resource +
// time window + state-gated action bar (approve/reject/cancel/check-in/check-out/
// no-show) + timeline + comments + attachments. All mutations go through the BFF
// proxy (/api/bookings/*) then refresh the server component. Conflict (409) errors
// are surfaced inline.
export function BookingDetailClient({ detail, currentUserId }: { detail: BookingDetail; currentUserId: string }) {
  const router = useRouter();
  const { booking, resource, events, attachments } = detail;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function call(path: string, body?: unknown) {
    setBusy(path);
    setErr(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(res.status === 409 ? (j?.detail?.message ?? "Trùng lịch với một đặt chỗ đang hoạt động.") : (j?.detail?.message ?? j?.error ?? `Lỗi ${res.status}`));
      } else {
        router.refresh();
      }
    } catch {
      setErr("Không kết nối được backend");
    } finally {
      setBusy(null);
    }
  }

  const legal = booking.legalActions ?? [];
  void currentUserId;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{booking.title}</h1>
            <Badge tone={BOOKING_STATE_TONE[booking.state] ?? "neutral"}>{BOOKING_STATE_LABEL[booking.state] ?? booking.state}</Badge>
            {booking.overdue && <Badge tone="error">Quá hạn</Badge>}
            {booking.noShow && <Badge tone="error">Vắng mặt</Badge>}
          </div>
          <p className="font-mono text-xs text-gray-400">{booking.code}</p>
        </div>
        <button onClick={() => router.push("/office/bookings")} className="text-sm text-primary-600 hover:underline dark:text-primary-400">
          ← Đặt phòng &amp; tài nguyên
        </button>
      </div>

      {err && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{err}</div>}

      {/* Meta + action bar */}
      <SectionCard title="Thông tin & thao tác" accent="primary">
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Meta label="Người đặt" value={booking.requesterId} />
          <Meta label="Tài nguyên" value={resource ? `${resource.name}${resource.location ? ` · ${resource.location}` : ""}` : booking.resourceId} />
          <Meta label="Loại" value={resource ? (RESOURCE_TYPE_LABEL[resource.type] ?? resource.type) : "—"} />
          <Meta label="Thời gian" value={fmtRange(booking.startAt, booking.endAt)} />
          {booking.attendees != null && <Meta label="Số người" value={String(booking.attendees)} />}
          {booking.checkedInAt && <Meta label="Nhận phòng" value={fmtTime(booking.checkedInAt)} />}
          {booking.checkedOutAt && <Meta label="Trả phòng" value={fmtTime(booking.checkedOutAt)} />}
        </dl>
        {booking.purpose && <p className="mt-3 text-sm text-gray-600 dark:text-dark-200">{booking.purpose}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {legal.map((a) => {
            const meta = BOOKING_ACTION_LABEL[a];
            if (!meta) return null;
            return (
              <button key={a} disabled={!!busy} onClick={() => call(`/${a}`)} className={btnCls(meta.tone) + " disabled:opacity-50"}>
                {busy === `/${a}` ? "…" : meta.label}
              </button>
            );
          })}
          {legal.length === 0 && <span className="text-sm text-gray-400">Không có thao tác ở trạng thái này.</span>}
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Timeline + comment */}
        <SectionCard title="Dòng thời gian & trao đổi" accent="info">
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
          <CommentForm busy={!!busy} onSubmit={(b) => call(`/comment`, b)} />
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
          <AttachForm busy={!!busy} onSubmit={(b) => call(`/attachments`, b)} />
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

function CommentForm({ busy, onSubmit }: { busy: boolean; onSubmit: (b: Record<string, string>) => void }) {
  const [body, setBody] = useState("");
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Thêm trao đổi…" className="h-9 flex-1 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
      <button disabled={busy || !body.trim()} onClick={() => { onSubmit({ body }); setBody(""); }} className={btnCls("info") + " disabled:opacity-50"}>Gửi</button>
    </div>
  );
}

function AttachForm({ busy, onSubmit }: { busy: boolean; onSubmit: (b: Record<string, string>) => void }) {
  const [title, setTitle] = useState("");
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên tệp / ghi chú" className="h-9 flex-1 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
      <button disabled={busy || !title.trim()} onClick={() => { onSubmit({ title, content: title }); setTitle(""); }} className={btnCls("warning") + " disabled:opacity-50"}>Đính kèm</button>
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
