"use client";

import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { num } from "@/xhub/lib/format";
import { PaginatedTable } from "@/xhub/ui/PaginatedTable";
import type { Column } from "@/xhub/ui/DataTable";
import type { WorkflowListItem } from "@/xoffice/lib/workflow-data";

const roleLabel: Record<string, string> = {
  ROLE_PROCESS_ADMIN: "Quản trị quy trình",
  ROLE_IT_MANAGER: "Trưởng phòng CNTT",
  ROLE_CFO: "Giám đốc Tài chính",
  ROLE_CEO: "Tổng Giám đốc",
};

export function WorkflowsTable({ items }: { items: WorkflowListItem[] }) {
  const columns: Column<WorkflowListItem>[] = [
    {
      key: "name",
      header: "Mã / Tên",
      cell: (w) => (
        <>
          <p className="font-medium text-gray-800 dark:text-dark-100">{w.name}</p>
          <p className="font-mono text-xs text-gray-400">{w.code}</p>
        </>
      ),
    },
    {
      key: "description",
      header: "Mô tả",
      className: "max-w-xs",
      cell: (w) => <p className="line-clamp-2 text-gray-600 dark:text-dark-200">{w.description}</p>,
    },
    {
      key: "owner",
      header: "Chủ sở hữu",
      cell: (w) => <Badge tone="neutral">{roleLabel[w.ownerRoleCode] ?? w.ownerRoleCode}</Badge>,
    },
    { key: "nodes", header: "Node", align: "center", cell: (w) => num(w.nodeCount) },
    { key: "version", header: "Version", align: "center", cell: (w) => <Badge tone="info">v{w.version}</Badge> },
    { key: "usage", header: "Lượt dùng", align: "center", cell: (w) => num(w.usage) },
    {
      key: "actions",
      header: "Thao tác",
      align: "right",
      cell: (w) => (
        <div className="inline-flex items-center gap-2">
          <Link
            href={`/office/workflows/${w.code}/request`}
            className="inline-flex h-8 items-center rounded-lg bg-primary-600 px-3 text-xs font-medium text-white transition hover:bg-primary-700"
          >
            Tạo request
          </Link>
          <Link
            href={`/office/workflows/${w.code}/builder`}
            className="inline-flex h-8 items-center rounded-lg border border-primary-300 px-3 text-xs font-medium text-primary-600 transition hover:bg-primary-600/10 dark:border-primary-900 dark:text-primary-400"
          >
            Mở builder →
          </Link>
        </div>
      ),
    },
  ];

  return (
    <PaginatedTable
      title="Quy trình nghiệp vụ"
      columns={columns}
      rows={items}
      rowKey={(w) => w.code}
      initialPageSize={10}
      minWidthClass="min-w-[880px]"
      empty={<span className="text-gray-400">Chưa có quy trình nào. Hãy tạo quy trình mới bằng AI.</span>}
    />
  );
}
