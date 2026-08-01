"use client";

import { useMemo, useState, type ReactNode } from "react";
import { SectionCard, type Accent } from "@/xhub/ui/Card";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import { Pagination } from "@/xhub/ui/Pagination";

// Client-side paginated table for data already fully loaded on the server
// (seed collections, or a small API result). Slices rows locally and drives a
// Pagination control. For server/URL-driven pagination use DataTable +
// Pagination directly (see /office/instances).
export interface PaginatedTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  title?: string;
  accent?: Accent;
  action?: ReactNode;
  empty?: ReactNode;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  minWidthClass?: string;
  maxHeightClass?: string;
}

export function PaginatedTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  title,
  accent = "primary",
  action,
  empty,
  initialPageSize = 10,
  pageSizeOptions = [10, 20, 50],
  minWidthClass,
  maxHeightClass,
}: PaginatedTableProps<T>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const total = rows.length;
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  return (
    <SectionCard title={title} accent={accent} action={action} bodyClassName="p-0">
      <DataTable
        columns={columns}
        rows={paged}
        rowKey={rowKey}
        onRowClick={onRowClick}
        empty={empty}
        minWidthClass={minWidthClass}
        maxHeightClass={maxHeightClass}
      />
      {total > 0 ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
          pageSizeOptions={pageSizeOptions}
        />
      ) : null}
    </SectionCard>
  );
}
