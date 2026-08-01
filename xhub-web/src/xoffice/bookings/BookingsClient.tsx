"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { SectionCard } from "@/xhub/ui/Card";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import type { BookingRow, BookableResourceRow } from "@/xoffice/lib/bookings-data";
import {
  BOOKING_ALL_STATES,
  BOOKING_STATE_LABEL,
  BOOKING_STATE_TONE,
  RESOURCE_TYPE_LABEL,
  fmtRange,
} from "./booking-states";

const PAGE_SIZE = 10;

type Scope = "all" | "mine";

// Client-side scope/state/resource/search + pagination over the server-fetched
// live list, plus a "Đặt mới" create form. The list is already tenant-scoped by
// the API; this only narrows the display. Conflicts (409) are surfaced inline.
export function BookingsClient({
  rows,
  resources,
  basePath,
  currentUserId,
}: {
  rows: BookingRow[];
  resources: BookableResourceRow[];
  basePath: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("all");
  const [state, setState] = useState<string>("ALL");
  const [resourceId, setResourceId] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const resourceName = useMemo(() => {
    const m: Record<string, BookableResourceRow> = {};
    for (const r of resources) m[r.id] = r;
    return m;
  }, [resources]);

  const scoped = useMemo(() => {
    if (scope === "mine") return rows.filter((r) => r.requesterId === currentUserId);
    return rows;
  }, [rows, scope, currentUserId]);

  const filtered = useMemo(() => {
    return scoped.filter((r) => {
      if (state !== "ALL" && r.state !== state) return false;
      if (resourceId !== "ALL" && r.resourceId !== resourceId) return false;
      if (q && !`${r.title} ${r.code}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [scoped, state, resourceId, q]);

  const presentStates = useMemo(() => BOOKING_ALL_STATES.filter((s) => scoped.some((r) => r.state === s)), [scoped]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const columns: Column<BookingRow>[] = [
    {
      key: "code",
      header: "Mã / Tiêu đề",
      cell: (r) => (
        <>
          <p className="font-medium text-gray-800 dark:text-dark-100">{r.title}</p>
          <p className="font-mono text-xs text-gray-400">{r.code}</p>
        </>
      ),
    },
    {
      key: "resource",
      header: "Tài nguyên",
      cell: (r) => {
        const res = resourceName[r.resourceId];
        return (
          <span className="text-sm text-gray-600 dark:text-dark-200">
            {res ? res.name : r.resourceId}
            {res && <span className="ml-1 text-xs text-gray-400">({RESOURCE_TYPE_LABEL[res.type] ?? res.type})</span>}
          </span>
        );
      },
    },
    { key: "when", header: "Thời gian", cell: (r) => <span className="text-sm text-gray-600 dark:text-dark-200">{fmtRange(r.startAt, r.endAt)}</span> },
    { key: "requester", header: "Người đặt", cell: (r) => <span className="font-mono text-xs text-gray-500">{r.requesterId}</span> },
    {
      key: "state",
      header: "Trạng thái",
      cell: (r) => (
        <span className="flex items-center gap-1.5">
          <Badge tone={BOOKING_STATE_TONE[r.state] ?? "neutral"}>{BOOKING_STATE_LABEL[r.state] ?? r.state}</Badge>
          {r.overdue && <Badge tone="error">Quá hạn</Badge>}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Đặt phòng &amp; tài nguyên</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            {filtered.length}/{rows.length} lượt đặt — bấm một dòng để xem chi tiết, timeline &amp; thao tác
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Tìm theo tiêu đề / mã…"
          className="h-9 w-64 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-primary-500 dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50"
        />
      </div>

      <NewBookingForm resources={resources} />

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={scope === "all"} onClick={() => { setScope("all"); setPage(1); }} label="Tất cả" />
        <FilterChip active={scope === "mine"} onClick={() => { setScope("mine"); setPage(1); }} label="Của tôi" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={state === "ALL"} onClick={() => { setState("ALL"); setPage(1); }} label={`Mọi trạng thái (${scoped.length})`} />
        {presentStates.map((s) => (
          <FilterChip
            key={s}
            active={state === s}
            onClick={() => { setState(s); setPage(1); }}
            label={`${BOOKING_STATE_LABEL[s] ?? s} (${scoped.filter((r) => r.state === s).length})`}
          />
        ))}
      </div>

      {resources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={resourceId === "ALL"} onClick={() => { setResourceId("ALL"); setPage(1); }} label="Mọi tài nguyên" />
          {resources.map((res) => (
            <FilterChip key={res.id} active={resourceId === res.id} onClick={() => { setResourceId(res.id); setPage(1); }} label={res.name} />
          ))}
        </div>
      )}

      <SectionCard title="Danh sách đặt chỗ" accent="primary">
        <DataTable
          columns={columns}
          rows={pageRows}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`${basePath}/${r.id}`)}
        />
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button disabled={clampedPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-gray-300 px-3 py-1 disabled:opacity-40 dark:border-dark-500">← Trước</button>
            <span className="text-gray-500">Trang {clampedPage}/{totalPages}</span>
            <button disabled={clampedPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-lg border border-gray-300 px-3 py-1 disabled:opacity-40 dark:border-dark-500">Sau →</button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// Inline create form — posts to the BFF proxy (/api/bookings). Surfaces the
// server's 409 conflict message when the slot overlaps an active booking.
function NewBookingForm({ resources }: { resources: BookableResourceRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [resourceId, setResourceId] = useState(resources[0]?.id ?? "");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/bookings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, resourceId, startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(res.status === 409 ? (j?.detail?.message ?? "Trùng lịch: tài nguyên đã được đặt trong khung giờ này.") : (j?.detail?.message ?? j?.error ?? `Lỗi ${res.status}`));
      } else {
        setOpen(false);
        setTitle(""); setStartAt(""); setEndAt("");
        router.refresh();
      }
    } catch {
      setErr("Không kết nối được backend");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex h-9 items-center rounded-lg bg-primary-600 px-3.5 text-sm font-medium text-white transition hover:bg-primary-700">
        + Đặt mới
      </button>
    );
  }

  return (
    <SectionCard title="Đặt tài nguyên mới" accent="info">
      {err && <div className="mb-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{err}</div>}
      <div className="grid gap-2 md:grid-cols-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề cuộc họp / mục đích" className="h-9 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50 md:col-span-2" />
        <select value={resourceId} onChange={(e) => setResourceId(e.target.value)} className="h-9 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50">
          {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="h-9 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
          <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="h-9 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !title.trim() || !resourceId || !startAt || !endAt} onClick={submit} className="inline-flex h-9 items-center rounded-lg bg-primary-600 px-3.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50">
          {busy ? "…" : "Gửi yêu cầu đặt"}
        </button>
        <button onClick={() => { setOpen(false); setErr(null); }} className="inline-flex h-9 items-center rounded-lg border border-gray-300 px-3.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-dark-500 dark:text-dark-100 dark:hover:bg-dark-600">
          Hủy
        </button>
      </div>
    </SectionCard>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-xs font-medium transition " +
        (active
          ? "border-primary-500 bg-primary-600/10 text-primary-600 dark:text-primary-400"
          : "border-gray-300 text-gray-500 hover:border-primary-300 dark:border-dark-500 dark:text-dark-200")
      }
    >
      {label}
    </button>
  );
}
