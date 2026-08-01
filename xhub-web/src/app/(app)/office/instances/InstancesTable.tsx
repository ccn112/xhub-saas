"use client";

import { useRouter } from "next/navigation";
import { Badge, type Tone } from "@/xhub/ui/Badge";
import { SectionCard } from "@/xhub/ui/Card";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import { Pagination } from "@/xhub/ui/Pagination";
import type { RuntimeInstance } from "@/xoffice/lib/monitor-data";

const statusTone: Record<string, Tone> = {
  running: "info", completed: "success", rejected: "error", cancelled: "neutral",
};

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function InstancesTable({
  rows, page, pageSize, total,
}: {
  rows: RuntimeInstance[];
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const go = (p: number, size: number) => router.push(`/office/instances?page=${p}&pageSize=${size}`);

  const columns: Column<RuntimeInstance>[] = [
    {
      key: "code",
      header: "Mã / Tiêu đề",
      cell: (i) => (
        <>
          <p className="font-medium text-gray-800 dark:text-dark-100">{i.title}</p>
          <p className="font-mono text-xs text-gray-400">{i.instanceCode}</p>
        </>
      ),
    },
    { key: "wf", header: "Quy trình", cell: (i) => <span className="font-mono text-xs text-gray-500 dark:text-dark-300">{i.workflowCode}</span> },
    {
      key: "node",
      header: "Node hiện tại",
      cell: (i) => (
        <span className="text-gray-600 dark:text-dark-200">
          {i.currentNodeName ?? i.currentNodeId ?? "—"}
          {i.currentNodeType ? <span className="ml-1 text-xs text-gray-400">({i.currentNodeType})</span> : null}
        </span>
      ),
    },
    { key: "holder", header: "Người giữ", cell: (i) => <span className="text-gray-600 dark:text-dark-200">{i.requesterEmail}</span> },
    { key: "status", header: "Trạng thái", align: "center", cell: (i) => <Badge tone={statusTone[i.status] ?? "neutral"}>{i.status}</Badge> },
    { key: "updated", header: "Cập nhật", cell: (i) => <span className="text-xs text-gray-500 dark:text-dark-300">{fmtTime(i.updatedAt)}</span> },
  ];

  return (
    <SectionCard title="Instance đang vận hành" bodyClassName="p-0">
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(i) => i.instanceCode}
        onRowClick={(i) => router.push(`/office/instances/${encodeURIComponent(i.instanceCode)}`)}
        minWidthClass="min-w-[880px]"
        empty={<span className="text-gray-400">Chưa có instance nào. Tạo request từ Danh mục quy trình để bắt đầu.</span>}
      />
      {total > 0 ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(p) => go(p, pageSize)}
          onPageSizeChange={(s) => go(1, s)}
        />
      ) : null}
    </SectionCard>
  );
}
