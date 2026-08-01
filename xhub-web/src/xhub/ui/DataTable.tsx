"use client";

import type { ReactNode } from "react";
import clsx from "clsx";

// Reusable data table. Sticky header, internal body scroll (height co-scales
// with the viewport via a dvh-based max-height so long tables never push the
// footer off-screen). Zebra rows, hover + keyboard focus, dark-mode aware,
// horizontally scrollable on narrow screens.
export interface Column<T> {
  /** Stable key for the column. */
  key: string;
  /** Header cell content. */
  header: ReactNode;
  /** Cell renderer for a row. */
  cell: (row: T, index: number) => ReactNode;
  align?: "left" | "center" | "right";
  /** Extra classes applied to both header + body cells of this column. */
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  /** Stable row key. Defaults to the row index. */
  rowKey?: (row: T, index: number) => string;
  /** Optional row href — renders the row as a link target (whole row hover). */
  onRowClick?: (row: T) => void;
  /** Content shown when there are no rows (and not loading). */
  empty?: ReactNode;
  /** Skeleton rows while data loads. */
  loading?: boolean;
  /** Tailwind max-height class for the scroll body. Default: viewport-derived. */
  maxHeightClass?: string;
  /** Min width to force horizontal scroll below. */
  minWidthClass?: string;
  className?: string;
}

const alignCls: Record<"left" | "center" | "right", string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  loading = false,
  maxHeightClass = "max-h-[calc(100dvh-19rem)]",
  minWidthClass = "min-w-[720px]",
  className,
}: DataTableProps<T>) {
  const colCount = columns.length;

  return (
    <div className={clsx("overflow-x-auto overflow-y-auto", maxHeightClass, className)}>
      <table className={clsx("w-full text-sm", minWidthClass)}>
        <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs uppercase text-gray-400 shadow-[0_1px_0_0] shadow-gray-200 dark:bg-dark-750 dark:text-dark-300 dark:shadow-dark-600">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={clsx("px-4 py-3 font-medium", alignCls[c.align ?? "left"], c.className)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={`sk-${i}`}>
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3">
                    <div className="h-4 w-full max-w-[10rem] animate-pulse rounded bg-gray-150 dark:bg-dark-600" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="px-4 py-12 text-center">
                {empty ?? (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <span className="text-3xl">🗂️</span>
                    <p className="text-sm font-medium text-gray-600 dark:text-dark-200">Không có dữ liệu</p>
                  </div>
                )}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={rowKey ? rowKey(row, i) : String(i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(
                  "odd:bg-white even:bg-gray-50/40 hover:bg-primary-50/60 dark:odd:bg-dark-700 dark:even:bg-dark-700/40 dark:hover:bg-primary-950/30",
                  onRowClick && "cursor-pointer",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={clsx("px-4 py-3 text-gray-700 dark:text-dark-100", alignCls[c.align ?? "left"], c.className)}
                  >
                    {c.cell(row, i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
