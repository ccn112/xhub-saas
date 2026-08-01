"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge, type Tone } from "@/xhub/ui/Badge";
import { StatCard } from "@/xhub/ui/StatCard";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import { Pagination } from "@/xhub/ui/Pagination";
import { dateTimeVN } from "@/xhub/lib/format";

export interface InboxItem {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  assignedToName: string;
  createdByName: string;
  projectName: string | null;
  customerName: string | null;
  href: string | null;
  slaLabel: string;
  slaTone: Tone;
  overdue: boolean;
  /** Source system (SoR projection); null for seed/demo items. */
  sourceSystem?: string | null;
}

const TYPE_META: Record<string, { label: string; icon: string }> = {
  approval: { label: "Phê duyệt", icon: "🛡️" },
  task: { label: "Công việc", icon: "✅" },
  conversation: { label: "Trao đổi", icon: "💬" },
  customer: { label: "Khách hàng", icon: "🤝" },
  project: { label: "Dự án", icon: "📁" },
};

const PRIO_TONE: Record<string, Tone> = { critical: "error", high: "error", medium: "warning", low: "neutral" };
const PRIO_LABEL: Record<string, string> = { critical: "Khẩn cấp", high: "Cao", medium: "Trung bình", low: "Thấp" };
const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  needs_action: { label: "Cần xử lý", tone: "primary" },
  in_progress: { label: "Đang làm", tone: "info" },
  overdue: { label: "Quá hạn", tone: "error" },
  done: { label: "Hoàn tất", tone: "success" },
};

const typeMeta = (t: string) => TYPE_META[t] ?? { label: t, icon: "•" };

export function InboxClient({ items }: { items: InboxItem[] }) {
  const filters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of items) counts.set(it.type, (counts.get(it.type) ?? 0) + 1);
    return [{ key: "all", label: "Tất cả", icon: "📥", count: items.length }, ...Array.from(counts.entries()).map(([key, count]) => ({ key, label: typeMeta(key).label, icon: typeMeta(key).icon, count }))];
  }, [items]);

  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const visible = useMemo(
    () =>
      items.filter((it) => {
        if (filter !== "all" && it.type !== filter) return false;
        if (onlyOverdue && !it.overdue) return false;
        if (query && !(`${it.title} ${it.summary ?? ""}`.toLowerCase().includes(query.toLowerCase()))) return false;
        return true;
      }),
    [items, filter, onlyOverdue, query],
  );

  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const selected = visible.find((it) => it.id === selectedId) ?? visible[0] ?? null;

  const overdueCount = items.filter((it) => it.overdue).length;
  const actionCount = items.filter((it) => it.status === "needs_action").length;

  // Pagination over the filtered list.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(1); }, [filter, query, onlyOverdue]);
  const pagedVisible = useMemo(
    () => visible.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
    [visible, page, pageSize],
  );

  const columns: Column<InboxItem>[] = [
    {
      key: "type",
      header: "Loại",
      cell: (it) => {
        const tm = typeMeta(it.type);
        return (
          <span className="inline-flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-base dark:bg-dark-600">{tm.icon}</span>
            <span className="text-xs text-gray-500 dark:text-dark-300">{tm.label}</span>
          </span>
        );
      },
    },
    {
      key: "title",
      header: "Tiêu đề",
      cell: (it) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-gray-800 dark:text-dark-100">{it.title}</p>
            <Badge tone={PRIO_TONE[it.priority] ?? "neutral"}>{PRIO_LABEL[it.priority] ?? it.priority}</Badge>
          </div>
          {it.summary ? <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-dark-300">{it.summary}</p> : null}
          {it.sourceSystem ? <Badge tone="info" className="mt-1">SoR: {it.sourceSystem}</Badge> : null}
        </div>
      ),
    },
    { key: "assignee", header: "Phụ trách", cell: (it) => it.assignedToName },
    {
      key: "status",
      header: "Trạng thái",
      cell: (it) => {
        const st = STATUS_META[it.status];
        return st ? <Badge tone={st.tone}>{st.label}</Badge> : <span>{it.status}</span>;
      },
    },
    { key: "sla", header: "SLA", align: "right", cell: (it) => <Badge tone={it.slaTone}>{it.slaLabel}</Badge> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tổng việc" value={String(items.length)} icon="📥" tone="primary" />
        <StatCard label="Cần xử lý" value={String(actionCount)} icon="⚡" tone="warning" />
        <StatCard label="Quá hạn" value={String(overdueCount)} icon="⏰" tone="error" />
        <StatCard label="Phê duyệt" value={String(items.filter((i) => i.type === "approval").length)} icon="🛡️" tone="info" />
      </div>

      {/* Filter tabs — single scrollable row on mobile (no vertical wrap). */}
      <div className="-mx-1 flex flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              filter === f.key
                ? "border-primary-600 bg-primary-600 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-primary-300 dark:border-dark-600 dark:bg-dark-700 dark:text-dark-200"
            }`}
          >
            <span>{f.icon}</span>
            {f.label}
            <span className={`rounded-full px-1.5 text-xs ${filter === f.key ? "bg-white/20" : "bg-gray-150 dark:bg-dark-500"}`}>{f.count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tiêu đề hoặc nội dung"
            aria-label="Tìm kiếm hộp việc"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-dark-100"
          />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-dark-200">
          <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} className="size-4 rounded border-gray-300 text-primary-600 focus-visible:ring-primary-500" />
          Chỉ hiện quá hạn / cận SLA
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Unified list */}
        <div className="xl:col-span-2">
          <SectionCard title={`Danh sách (${visible.length})`} bodyClassName="p-0">
            <DataTable
              columns={columns}
              rows={pagedVisible}
              rowKey={(it) => it.id}
              onRowClick={(it) => setSelectedId(it.id)}
              minWidthClass="min-w-[640px]"
              empty={
                <div className="flex flex-col items-center gap-2">
                  <span className="text-3xl">🗂️</span>
                  <p className="text-sm font-medium text-gray-700 dark:text-dark-100">Không có việc nào khớp bộ lọc</p>
                  <p className="text-xs text-gray-400">Thử đổi loại việc hoặc xoá từ khoá tìm kiếm.</p>
                  <button type="button" onClick={() => { setFilter("all"); setQuery(""); setOnlyOverdue(false); }} className="mt-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-primary-600 hover:border-primary-300 dark:border-dark-600">
                    Xoá bộ lọc
                  </button>
                </div>
              }
            />
            {visible.length > 0 ? (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={visible.length}
                onPageChange={setPage}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              />
            ) : null}
          </SectionCard>
        </div>

        {/* Context detail panel */}
        <div>
          {selected ? (
            <SectionCard
              title="Chi tiết"
              action={selected.href ? <Link href={selected.href} className="text-sm text-primary-600 hover:underline">Mở đầy đủ →</Link> : null}
            >
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-600/10 text-xl text-primary-600">{typeMeta(selected.type).icon}</span>
                  <div>
                    <p className="font-heading font-semibold text-gray-800 dark:text-dark-50">{selected.title}</p>
                    <p className="text-xs text-gray-400">{typeMeta(selected.type).label}</p>
                  </div>
                </div>
                {selected.summary ? <p className="text-sm text-gray-600 dark:text-dark-200">{selected.summary}</p> : null}
                <dl className="space-y-2 text-sm">
                  <Row label="Phụ trách" value={selected.assignedToName} />
                  <Row label="Người tạo" value={selected.createdByName} />
                  <Row label="Hạn xử lý" value={dateTimeVN(selected.dueAt)} />
                  {selected.projectName ? <Row label="Dự án" value={selected.projectName} /> : null}
                  {selected.customerName ? <Row label="Khách hàng" value={selected.customerName} /> : null}
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-gray-400">SLA</dt>
                    <dd><Badge tone={selected.slaTone}>{selected.slaLabel}</Badge></dd>
                  </div>
                </dl>
                {selected.href ? (
                  <Link href={selected.href} className="block w-full rounded-lg bg-primary-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                    Xem & phê duyệt
                  </Link>
                ) : (
                  <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-dark-600/40 dark:text-dark-300">
                    Chọn một mục phê duyệt để mở trang xử lý chi tiết.
                  </p>
                )}
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-gray-400">{label}</dt>
      <dd className="text-right font-medium text-gray-700 dark:text-dark-100">{value}</dd>
    </div>
  );
}
