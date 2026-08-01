"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { SectionCard } from "@/xhub/ui/Card";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import type { TicketRow, ServiceCatalogItemRow } from "@/xoffice/lib/tickets-data";
import { TICKET_ALL_STATES, TICKET_STATE_LABEL, TICKET_STATE_TONE, PRIORITY_LABEL, fmtDate } from "./ticket-states";

const PAGE_SIZE = 10;

type Scope = "all" | "mine" | "assigned" | "queue";

// Client-side scope/state/category/search + pagination over the server-fetched
// live list. The list is already tenant-scoped by the API; this only narrows the
// display. A "Danh mục dịch vụ" section is shown for managers to review the catalog.
export function TicketsClient({
  rows,
  catalog,
  basePath,
  currentUserId,
}: {
  rows: TicketRow[];
  catalog: ServiceCatalogItemRow[];
  basePath: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("all");
  const [state, setState] = useState<string>("ALL");
  const [category, setCategory] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [showCatalog, setShowCatalog] = useState(false);

  const scoped = useMemo(() => {
    if (scope === "mine") return rows.filter((r) => r.requesterId === currentUserId);
    if (scope === "assigned") return rows.filter((r) => r.assigneeId === currentUserId);
    if (scope === "queue") return rows.filter((r) => r.assigneeId == null);
    return rows;
  }, [rows, scope, currentUserId]);

  const filtered = useMemo(() => {
    return scoped.filter((r) => {
      if (state !== "ALL" && r.state !== state) return false;
      if (category !== "ALL" && r.category !== category) return false;
      if (q && !`${r.title} ${r.code}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [scoped, state, category, q]);

  const presentStates = useMemo(() => TICKET_ALL_STATES.filter((s) => scoped.some((r) => r.state === s)), [scoped]);
  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))].sort(), [rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const columns: Column<TicketRow>[] = [
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
    { key: "category", header: "Danh mục", cell: (r) => <span className="text-sm text-gray-600 dark:text-dark-200">{r.category}</span> },
    { key: "requester", header: "Người yêu cầu", cell: (r) => <span className="font-mono text-xs text-gray-500">{r.requesterId}</span> },
    { key: "assignee", header: "Người xử lý", cell: (r) => <span className="font-mono text-xs text-gray-500">{r.assigneeId ?? "— (hàng đợi)"}</span> },
    { key: "priority", header: "Ưu tiên", cell: (r) => <span className="text-sm text-gray-600 dark:text-dark-200">{PRIORITY_LABEL[r.priority] ?? r.priority}</span> },
    {
      key: "state",
      header: "Trạng thái",
      cell: (r) => (
        <span className="flex items-center gap-1.5">
          <Badge tone={TICKET_STATE_TONE[r.state] ?? "neutral"}>{TICKET_STATE_LABEL[r.state] ?? r.state}</Badge>
          {r.overdue && <Badge tone="error">Quá hạn</Badge>}
        </span>
      ),
    },
    { key: "sla", header: "Hạn (SLA)", cell: (r) => <span className="text-xs text-gray-500">{fmtDate(r.slaDueAt)}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Yêu cầu hỗ trợ (Service Desk)</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            {filtered.length}/{rows.length} ticket — bấm một dòng để xem chi tiết, timeline &amp; thao tác
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
        <FilterChip active={scope === "mine"} onClick={() => { setScope("mine"); setPage(1); }} label="Của tôi" />
        <FilterChip active={scope === "assigned"} onClick={() => { setScope("assigned"); setPage(1); }} label="Được giao cho tôi" />
        <FilterChip active={scope === "queue"} onClick={() => { setScope("queue"); setPage(1); }} label="Hàng đợi" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={state === "ALL"} onClick={() => { setState("ALL"); setPage(1); }} label={`Mọi trạng thái (${scoped.length})`} />
        {presentStates.map((s) => (
          <FilterChip
            key={s}
            active={state === s}
            onClick={() => { setState(s); setPage(1); }}
            label={`${TICKET_STATE_LABEL[s] ?? s} (${scoped.filter((r) => r.state === s).length})`}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={category === "ALL"} onClick={() => { setCategory("ALL"); setPage(1); }} label="Mọi danh mục" />
        {categories.map((cat) => (
          <FilterChip key={cat} active={category === cat} onClick={() => { setCategory(cat); setPage(1); }} label={cat} />
        ))}
      </div>

      <SectionCard title="Danh sách ticket" accent="primary">
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

      {catalog.length > 0 && (
        <SectionCard title="Danh mục dịch vụ" accent="info">
          <button onClick={() => setShowCatalog((s) => !s)} className="mb-2 text-sm text-primary-600 hover:underline dark:text-primary-400">
            {showCatalog ? "Ẩn danh mục" : `Xem ${catalog.length} dịch vụ (SLA mặc định)`}
          </button>
          {showCatalog && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-150 text-left text-xs uppercase text-gray-400 dark:border-dark-600">
                    <th className="py-2 pr-3">Mã</th>
                    <th className="py-2 pr-3">Tên dịch vụ</th>
                    <th className="py-2 pr-3">Danh mục</th>
                    <th className="py-2 pr-3">SLA (giờ)</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100 dark:border-dark-700">
                      <td className="py-2 pr-3 font-mono text-xs text-gray-500">{c.code}</td>
                      <td className="py-2 pr-3 text-gray-700 dark:text-dark-100">{c.name}</td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-dark-200">{c.category}</td>
                      <td className="py-2 pr-3 tabular-nums text-gray-700 dark:text-dark-100">{c.defaultSlaHours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
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
