"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, type Tone } from "@/xhub/ui/Badge";
import { PaginatedTable } from "@/xhub/ui/PaginatedTable";
import type { Column } from "@/xhub/ui/DataTable";

export interface CustomerRow {
  id: string;
  code: string;
  name: string;
  industry: string;
  segment: string;
  status: string;
  ownerName: string;
  healthScore: number | null;
  satisfaction: number | null;
  contracts: number;
  opportunities: number;
  openTickets: number;
}

const statusLabel: Record<string, string> = {
  implementing: "Đang triển khai", proposal: "Đề xuất", negotiation: "Đàm phán",
  consulting: "Tư vấn", demo: "Demo", lead: "Tiềm năng", active: "Đang hoạt động",
};
const statusTone: Record<string, Tone> = {
  implementing: "primary", proposal: "info", negotiation: "warning",
  consulting: "info", demo: "neutral", lead: "neutral", active: "success",
};
const segmentTone: Record<string, Tone> = { A: "success", B: "info", C: "neutral" };

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  const router = useRouter();

  const columns: Column<CustomerRow>[] = [
    {
      key: "name",
      header: "Khách hàng",
      cell: (c) => (
        <>
          <Link
            href={`/customers/${c.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-gray-800 hover:text-primary-600 dark:text-dark-100"
          >
            {c.name}
          </Link>
          <p className="text-xs text-gray-400">{c.code}</p>
        </>
      ),
    },
    { key: "industry", header: "Ngành", cell: (c) => c.industry || "—" },
    { key: "segment", header: "Phân khúc", cell: (c) => <Badge tone={segmentTone[c.segment] ?? "neutral"}>{c.segment}</Badge> },
    { key: "status", header: "Trạng thái", cell: (c) => <Badge tone={statusTone[c.status] ?? "neutral"}>{statusLabel[c.status] ?? c.status}</Badge> },
    { key: "owner", header: "Phụ trách", cell: (c) => c.ownerName },
    {
      key: "health",
      header: "Health",
      className: "w-40",
      cell: (c) => (
        <>
          <div className="h-1.5 w-full rounded-full bg-gray-150 dark:bg-dark-500">
            <div
              className={`h-1.5 rounded-full ${(c.healthScore ?? 0) >= 80 ? "bg-success" : (c.healthScore ?? 0) >= 60 ? "bg-warning" : "bg-error"}`}
              style={{ width: `${c.healthScore ?? 0}%` }}
            />
          </div>
          <span className="text-xs text-gray-400">{c.healthScore ?? "—"} · ⭐ {c.satisfaction ?? "—"}</span>
        </>
      ),
    },
    {
      key: "counts",
      header: "HĐ / Cơ hội / Ticket",
      align: "center",
      cell: (c) => (
        <span className="text-xs text-gray-500 dark:text-dark-200">
          {c.contracts} / {c.opportunities} / {c.openTickets}
        </span>
      ),
    },
  ];

  return (
    <PaginatedTable
      title="Danh sách khách hàng"
      columns={columns}
      rows={rows}
      rowKey={(c) => c.id}
      onRowClick={(c) => router.push(`/customers/${c.id}`)}
      initialPageSize={10}
      minWidthClass="min-w-[820px]"
    />
  );
}
