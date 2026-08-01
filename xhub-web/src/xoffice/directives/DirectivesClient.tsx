"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { SectionCard } from "@/xhub/ui/Card";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import type { DirectiveRow } from "@/xoffice/lib/directives-data";
import { DIR_ALL_STATES, DIR_STATE_LABEL, DIR_STATE_TONE, PRIORITY_LABEL, fmtDate } from "./directive-states";

const PAGE_SIZE = 10;

// Client-side scope/state/search + pagination over the server-fetched live list.
// The list is already tenant-scoped by the API; this only narrows the display.
export function DirectivesClient({
  rows,
  basePath,
  currentUserId,
}: {
  rows: DirectiveRow[];
  basePath: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<"all" | "issued">("all");
  const [state, setState] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const scoped = useMemo(
    () => (scope === "issued" ? rows.filter((r) => r.issuerId === currentUserId) : rows),
    [rows, scope, currentUserId],
  );

  const filtered = useMemo(() => {
    return scoped.filter((r) => {
      if (state !== "ALL" && r.state !== state) return false;
      if (q && !`${r.title} ${r.code}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [scoped, state, q]);

  const presentStates = useMemo(
    () => DIR_ALL_STATES.filter((s) => scoped.some((r) => r.state === s)),
    [scoped],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const columns: Column<DirectiveRow>[] = [
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
    { key: "issuer", header: "Người ban hành", cell: (r) => <span className="font-mono text-xs text-gray-500">{r.issuerId}</span> },
    { key: "audience", header: "Đối tượng", cell: (r) => <span className="text-sm text-gray-600 dark:text-dark-200">{r.audienceType}{r.audienceId ? `:${r.audienceId}` : ""}</span> },
    { key: "priority", header: "Ưu tiên", cell: (r) => <span className="text-sm text-gray-600 dark:text-dark-200">{PRIORITY_LABEL[r.priority] ?? r.priority}</span> },
    {
      key: "state",
      header: "Trạng thái",
      cell: (r) => (
        <span className="flex items-center gap-1.5">
          <Badge tone={DIR_STATE_TONE[r.state] ?? "neutral"}>{DIR_STATE_LABEL[r.state] ?? r.state}</Badge>
          {r.overdue && <Badge tone="error">Quá hạn</Badge>}
        </span>
      ),
    },
    { key: "due", header: "Hạn", cell: (r) => <span className="text-xs text-gray-500">{fmtDate(r.dueAt)}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Chỉ đạo &amp; cam kết</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            {filtered.length}/{rows.length} chỉ đạo — bấm một dòng để xem chi tiết, cam kết &amp; timeline
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Tìm theo tiêu đề / mã…"
          className="h-9 w-64 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-primary-500 dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={scope === "all"} onClick={() => { setScope("all"); setPage(1); }} label="Tất cả" />
        <FilterChip active={scope === "issued"} onClick={() => { setScope("issued"); setPage(1); }} label="Đã ban hành bởi tôi" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={state === "ALL"} onClick={() => { setState("ALL"); setPage(1); }} label={`Mọi trạng thái (${scoped.length})`} />
        {presentStates.map((s) => (
          <FilterChip
            key={s}
            active={state === s}
            onClick={() => { setState(s); setPage(1); }}
            label={`${DIR_STATE_LABEL[s] ?? s} (${scoped.filter((r) => r.state === s).length})`}
          />
        ))}
      </div>

      <SectionCard title="Danh sách chỉ đạo" accent="primary">
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
