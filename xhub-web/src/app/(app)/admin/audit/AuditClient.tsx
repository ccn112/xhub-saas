"use client";

import { useMemo, useState } from "react";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import { dateTimeVN } from "@/xhub/lib/format";

export interface AuditRow {
  id: string; actor: string; action: string; entity: string; at: string; ip: string;
  correlationId: string; metadata: Record<string, unknown>;
}

export function AuditClient({ rows }: { rows: AuditRow[] }) {
  const [query, setQuery] = useState("");
  const [actor, setActor] = useState("all");
  const actors = useMemo(() => Array.from(new Set(rows.map((r) => r.actor))), [rows]);

  const visible = useMemo(() => rows.filter((r) => {
    if (actor !== "all" && r.actor !== actor) return false;
    if (query && !`${r.action} ${r.entity} ${r.actor}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [rows, actor, query]);

  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const selected = visible.find((r) => r.id === selectedId) ?? visible[0] ?? null;

  const columns: Column<AuditRow>[] = [
    { key: "at", header: "Thời điểm", cell: (r) => <span className="text-gray-600 dark:text-dark-200">{dateTimeVN(r.at)}</span> },
    { key: "actor", header: "Chủ thể", cell: (r) => <span className="font-medium text-gray-800 dark:text-dark-100">{r.actor}</span> },
    { key: "action", header: "Hành động", cell: (r) => <span className="font-mono text-xs text-gray-700 dark:text-dark-100">{r.action}</span> },
    { key: "entity", header: "Đối tượng", cell: (r) => <span className="text-gray-600 dark:text-dark-200">{r.entity}</span> },
    { key: "corr", header: "Correlation", align: "right", cell: (r) => <Badge tone="neutral">{r.correlationId}</Badge> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Sự kiện" value={String(rows.length)} icon="📜" tone="primary" />
        <StatCard label="Chủ thể" value={String(actors.length)} icon="👤" tone="info" />
        <StatCard label="Hành động X.AI" value={String(rows.filter((r) => r.actor === "X.AI").length)} icon="✦" tone="warning" />
        <StatCard label="Chuỗi correlation" value={String(new Set(rows.map((r) => r.correlationId)).size)} icon="🔗" tone="neutral" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm hành động, đối tượng" aria-label="Tìm nhật ký"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-dark-100" />
        </div>
        <select value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Lọc theo chủ thể"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-dark-100">
          <option value="all">Mọi chủ thể</option>
          {actors.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button type="button" disabled title="Cần BFF audit/export" className="ml-auto cursor-not-allowed rounded-lg border border-gray-200 px-3.5 py-2 text-sm text-gray-400 dark:border-dark-600">Xuất CSV</button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SectionCard title={`Sự kiện (${visible.length})`} bodyClassName="p-0">
            <DataTable columns={columns} rows={visible} rowKey={(r) => r.id} onRowClick={(r) => setSelectedId(r.id)} minWidthClass="min-w-[720px]" />
          </SectionCard>
        </div>
        <div>
          {selected ? (
            <SectionCard title="Chi tiết sự kiện" accent="neutral">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2"><dt className="text-gray-400">Hành động</dt><dd className="font-mono text-xs text-gray-700 dark:text-dark-100">{selected.action}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-gray-400">Chủ thể</dt><dd className="font-medium text-gray-700 dark:text-dark-100">{selected.actor}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-gray-400">Đối tượng</dt><dd className="text-gray-700 dark:text-dark-100">{selected.entity}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-gray-400">IP</dt><dd className="text-gray-700 dark:text-dark-100">{selected.ip}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-gray-400">Correlation</dt><dd><Badge tone="neutral">{selected.correlationId}</Badge></dd></div>
              </dl>
              <div className="mt-3 border-t border-gray-100 pt-3 dark:border-dark-600">
                <p className="mb-1 text-xs font-medium uppercase text-gray-400">Metadata (before/after)</p>
                <pre className="max-h-56 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">{JSON.stringify(selected.metadata, null, 2)}</pre>
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
