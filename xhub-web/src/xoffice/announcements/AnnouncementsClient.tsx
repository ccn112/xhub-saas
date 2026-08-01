"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { SectionCard } from "@/xhub/ui/Card";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import type { AnnouncementRow } from "@/xoffice/lib/announcements-data";
import {
  ANNOUNCEMENT_ALL_STATES,
  ANNOUNCEMENT_STATE_LABEL,
  ANNOUNCEMENT_STATE_TONE,
  AUDIENCE_LABEL,
  PRIORITY_LABEL,
  fmtTime,
} from "./announcement-states";

const PAGE_SIZE = 10;

type Scope = "all" | "mine" | "for-me";

// Client-side scope/state/search + pagination over the server-fetched live list,
// plus a "Soạn thông báo" create form (COMM_ADMIN; publish gated server-side).
// The list is already tenant-scoped by the API; this only narrows the display.
export function AnnouncementsClient({
  rows,
  basePath,
  currentUserId,
}: {
  rows: AnnouncementRow[];
  basePath: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("all");
  const [state, setState] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const scoped = useMemo(() => {
    if (scope === "mine") return rows.filter((r) => r.authorId === currentUserId);
    if (scope === "for-me") return rows.filter((r) => r.myReceipt != null);
    return rows;
  }, [rows, scope, currentUserId]);

  const filtered = useMemo(() => {
    return scoped.filter((r) => {
      if (state !== "ALL" && r.state !== state) return false;
      if (q && !`${r.title} ${r.code}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [scoped, state, q]);

  const presentStates = useMemo(() => ANNOUNCEMENT_ALL_STATES.filter((s) => scoped.some((r) => r.state === s)), [scoped]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const columns: Column<AnnouncementRow>[] = [
    {
      key: "code",
      header: "Mã / Tiêu đề",
      cell: (r) => (
        <>
          <p className="flex items-center gap-1.5 font-medium text-gray-800 dark:text-dark-100">
            {r.title}
            {r.myReceipt?.unread && <Badge tone="info">Chưa đọc</Badge>}
            {r.myReceipt?.needsAck && <Badge tone="warning">Cần xác nhận</Badge>}
          </p>
          <p className="font-mono text-xs text-gray-400">{r.code}</p>
        </>
      ),
    },
    {
      key: "audience",
      header: "Đối tượng",
      cell: (r) => (
        <span className="text-sm text-gray-600 dark:text-dark-200">
          {AUDIENCE_LABEL[r.audienceType] ?? r.audienceType}
          {r.requireAck && <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">· cần xác nhận</span>}
        </span>
      ),
    },
    { key: "priority", header: "Ưu tiên", cell: (r) => <span className="text-sm text-gray-600 dark:text-dark-200">{PRIORITY_LABEL[r.priority] ?? r.priority}</span> },
    { key: "author", header: "Người soạn", cell: (r) => <span className="font-mono text-xs text-gray-500">{r.authorId}</span> },
    { key: "when", header: "Phát hành", cell: (r) => <span className="text-sm text-gray-600 dark:text-dark-200">{fmtTime(r.publishAt)}</span> },
    {
      key: "state",
      header: "Trạng thái",
      cell: (r) => <Badge tone={ANNOUNCEMENT_STATE_TONE[r.state] ?? "neutral"}>{ANNOUNCEMENT_STATE_LABEL[r.state] ?? r.state}</Badge>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Thông báo nội bộ</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            {filtered.length}/{rows.length} thông báo — bấm một dòng để đọc, xác nhận &amp; xem báo cáo
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Tìm theo tiêu đề / mã…"
          className="h-9 w-64 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-primary-500 dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50"
        />
      </div>

      <NewAnnouncementForm />

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={scope === "all"} onClick={() => { setScope("all"); setPage(1); }} label="Tất cả" />
        <FilterChip active={scope === "for-me"} onClick={() => { setScope("for-me"); setPage(1); }} label="Dành cho tôi" />
        <FilterChip active={scope === "mine"} onClick={() => { setScope("mine"); setPage(1); }} label="Tôi soạn" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={state === "ALL"} onClick={() => { setState("ALL"); setPage(1); }} label={`Mọi trạng thái (${scoped.length})`} />
        {presentStates.map((s) => (
          <FilterChip
            key={s}
            active={state === s}
            onClick={() => { setState(s); setPage(1); }}
            label={`${ANNOUNCEMENT_STATE_LABEL[s] ?? s} (${scoped.filter((r) => r.state === s).length})`}
          />
        ))}
      </div>

      <SectionCard title="Danh sách thông báo" accent="primary">
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

// Inline create form — posts to the BFF proxy (/api/announcements). Creates a
// DRAFT; publishing (audience fan-out) is a separate action on the detail page.
// Only COMM_ADMIN can create — a non-admin gets a 403 surfaced inline.
function NewAnnouncementForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState("ALL");
  const [audienceId, setAudienceId] = useState("");
  const [requireAck, setRequireAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/announcements`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body, audienceType, audienceId: audienceType === "ALL" ? undefined : audienceId, requireAck }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(res.status === 403 ? "Bạn không có quyền soạn thông báo (cần vai trò COMM_ADMIN)." : (j?.detail?.message ?? j?.error ?? `Lỗi ${res.status}`));
      } else {
        setOpen(false);
        setTitle(""); setBody(""); setAudienceId(""); setRequireAck(false);
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
        + Soạn thông báo
      </button>
    );
  }

  return (
    <SectionCard title="Soạn thông báo mới" accent="info">
      {err && <div className="mb-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{err}</div>}
      <div className="grid gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề thông báo" className="h-9 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Nội dung…" rows={3} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
        <div className="grid gap-2 md:grid-cols-2">
          <select value={audienceType} onChange={(e) => setAudienceType(e.target.value)} className="h-9 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50">
            <option value="ALL">Toàn công ty</option>
            <option value="ORG_UNIT">Đơn vị (org unit id)</option>
            <option value="POSITION">Vị trí (position id)</option>
            <option value="GROUP">Nhóm (group id)</option>
            <option value="USER">Cá nhân (user/person id)</option>
          </select>
          {audienceType !== "ALL" && (
            <input value={audienceId} onChange={(e) => setAudienceId(e.target.value)} placeholder="ID đối tượng" className="h-9 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-dark-200">
          <input type="checkbox" checked={requireAck} onChange={(e) => setRequireAck(e.target.checked)} />
          Yêu cầu xác nhận đã đọc (read-acknowledgement)
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !title.trim() || (audienceType !== "ALL" && !audienceId.trim())} onClick={submit} className="inline-flex h-9 items-center rounded-lg bg-primary-600 px-3.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50">
          {busy ? "…" : "Tạo bản nháp"}
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
