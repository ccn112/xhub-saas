"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { SectionCard } from "@/xhub/ui/Card";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import type { RequestRow } from "@/xoffice/lib/requests-data";
import { ALL_STATES, STATE_LABEL, STATE_TONE, fmtAmount, fmtTime } from "./request-states";

// Client-side filtering/search over the server-fetched live list. The list is
// already tenant-scoped by the API; this only narrows what is displayed.
export function RequestsClient({
  rows,
  basePath,
  heading,
}: {
  rows: RequestRow[];
  basePath: string;
  heading: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<string>("ALL");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (state !== "ALL" && r.state !== state) return false;
      if (q && !`${r.title} ${r.code} ${r.procedureName ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [rows, state, q]);

  const presentStates = useMemo(
    () => ALL_STATES.filter((s) => rows.some((r) => r.state === s)),
    [rows],
  );

  const columns: Column<RequestRow>[] = [
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
    { key: "procedure", header: "Thủ tục", cell: (r) => <span className="text-sm text-gray-600 dark:text-dark-200">{r.procedureName ?? r.procedureCode}</span> },
    { key: "requester", header: "Người tạo", cell: (r) => <span className="font-mono text-xs text-gray-500">{r.requesterId}</span> },
    { key: "amount", header: "Số tiền", cell: (r) => <span className="text-sm tabular-nums text-gray-700 dark:text-dark-100">{fmtAmount(r.amount, r.currency)}</span> },
    { key: "state", header: "Trạng thái", cell: (r) => <Badge tone={STATE_TONE[r.state] ?? "neutral"}>{STATE_LABEL[r.state] ?? r.state}</Badge> },
    { key: "created", header: "Tạo lúc", cell: (r) => <span className="text-xs text-gray-500">{fmtTime(r.createdAt)}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{heading}</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            {filtered.length}/{rows.length} yêu cầu — bấm một dòng để xem chi tiết, timeline và thao tác
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tiêu đề / mã…"
          className="h-9 w-64 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-primary-500 dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={state === "ALL"} onClick={() => setState("ALL")} label={`Tất cả (${rows.length})`} />
        {presentStates.map((s) => (
          <FilterChip
            key={s}
            active={state === s}
            onClick={() => setState(s)}
            label={`${STATE_LABEL[s] ?? s} (${rows.filter((r) => r.state === s).length})`}
          />
        ))}
      </div>

      <SectionCard title="Danh sách yêu cầu" accent="primary">
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`${basePath}/${r.id}`)}
        />
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
