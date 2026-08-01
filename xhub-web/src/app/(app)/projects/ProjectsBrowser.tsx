"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import { Pagination } from "@/xhub/ui/Pagination";

export interface ProjectRow {
  id: string;
  code: string;
  name: string;
  status: string;
  progress: number;
  managerName: string;
  ownerName: string;
  milestoneCount: number;
  openTasks: number;
}

const statusMeta: Record<string, { label: string; tone: "success" | "primary" | "neutral" | "warning" }> = {
  active: { label: "Đang chạy", tone: "success" },
  planned: { label: "Lên kế hoạch", tone: "warning" },
  completed: { label: "Hoàn thành", tone: "primary" },
  paused: { label: "Tạm dừng", tone: "neutral" },
};

function statusOf(s: string) {
  return statusMeta[s] ?? { label: s, tone: "neutral" as const };
}

export function ProjectsBrowser({ projects }: { projects: ProjectRow[] }) {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const statuses = useMemo(() => [...new Set(projects.map((p) => p.status))], [projects]);

  const filtered = useMemo(
    () =>
      projects.filter(
        (p) =>
          (!status || p.status === status) &&
          (!q ||
            p.name.toLowerCase().includes(q.toLowerCase()) ||
            p.code.toLowerCase().includes(q.toLowerCase())),
      ),
    [projects, status, q],
  );

  useEffect(() => { setPage(1); }, [status, q]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
    [filtered, page, pageSize],
  );

  const inputCls = "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-dark-500 dark:bg-dark-700 dark:text-dark-100";

  const columns: Column<ProjectRow>[] = [
    {
      key: "project",
      header: "Dự án",
      cell: (p) => (
        <div className="min-w-0">
          <Link href={`/projects/${p.id}`} className="truncate font-medium text-gray-800 hover:text-primary-600 hover:underline dark:text-dark-100">
            {p.name}
          </Link>
          <p className="truncate text-xs text-gray-400">{p.code}</p>
        </div>
      ),
    },
    { key: "status", header: "Trạng thái", cell: (p) => <Badge tone={statusOf(p.status).tone}>{statusOf(p.status).label}</Badge> },
    {
      key: "progress",
      header: "Tiến độ",
      cell: (p) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 rounded-full bg-gray-150 dark:bg-dark-500">
            <div className={`h-1.5 rounded-full ${p.progress >= 80 ? "bg-success" : p.progress >= 40 ? "bg-primary-600" : "bg-warning"}`} style={{ width: `${p.progress}%` }} />
          </div>
          <span className="text-xs font-medium text-gray-600 dark:text-dark-200">{p.progress}%</span>
        </div>
      ),
    },
    { key: "manager", header: "Chủ nhiệm", cell: (p) => <span className="text-sm text-gray-600 dark:text-dark-200">{p.managerName}</span> },
    { key: "owner", header: "Owner", cell: (p) => <span className="text-sm text-gray-600 dark:text-dark-200">{p.ownerName}</span> },
    { key: "milestones", header: "Hạng mục", cell: (p) => <span className="text-sm text-gray-600 dark:text-dark-200">{p.milestoneCount} milestone · {p.openTasks} việc</span> },
    {
      key: "actions",
      header: "",
      cell: (p) => <Link href={`/projects/${p.id}`} className="text-sm text-primary-600 hover:underline">Chi tiết →</Link>,
    },
  ];

  return (
    <SectionCard
      accent="neutral"
      title="Danh sách dự án"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <input className={inputCls} placeholder="Tìm theo tên / mã…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm dự án" />
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Lọc theo trạng thái">
            <option value="">Tất cả trạng thái</option>
            {statuses.map((s) => <option key={s} value={s}>{statusOf(s).label}</option>)}
          </select>
        </div>
      }
      bodyClassName="p-0"
    >
      <DataTable
        columns={columns}
        rows={paged}
        rowKey={(p) => p.id}
        minWidthClass="min-w-[820px]"
        empty={<span className="text-gray-400">Không có dự án nào khớp bộ lọc.</span>}
      />
      {filtered.length > 0 ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      ) : null}
    </SectionCard>
  );
}
