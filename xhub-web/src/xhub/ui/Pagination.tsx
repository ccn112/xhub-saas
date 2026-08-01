"use client";

import clsx from "clsx";

// Reusable pagination control. Shows "X–Y / total", prev/next, a page-size
// selector (10/20/50) and a direct page jumper. Fully keyboard accessible.
export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  className,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  const btn =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-gray-200 px-2 text-sm text-gray-600 transition-colors hover:border-primary-300 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-600 dark:border-dark-500 dark:text-dark-200 dark:hover:border-primary-700";

  return (
    <nav
      aria-label="Phân trang"
      className={clsx(
        "flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 dark:border-dark-600",
        className,
      )}
    >
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-dark-300">
        <span aria-live="polite">
          <span className="font-medium text-gray-700 dark:text-dark-100">
            {from}–{to}
          </span>{" "}
          / {total}
        </span>
        {onPageSizeChange ? (
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Mỗi trang</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Số dòng mỗi trang"
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-dark-500 dark:bg-dark-700 dark:text-dark-100"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} onClick={() => onPageChange(1)} disabled={current <= 1} aria-label="Trang đầu">
          «
        </button>
        <button type="button" className={btn} onClick={() => onPageChange(current - 1)} disabled={current <= 1} aria-label="Trang trước">
          ‹
        </button>
        <span className="px-1 text-sm text-gray-500 dark:text-dark-300">
          Trang
          <input
            type="number"
            min={1}
            max={pageCount}
            value={current}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) onPageChange(Math.min(Math.max(1, v), pageCount));
            }}
            aria-label="Tới trang"
            className="mx-1.5 w-12 rounded-lg border border-gray-200 bg-white px-1.5 py-1 text-center text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-dark-500 dark:bg-dark-700 dark:text-dark-100"
          />
          / {pageCount}
        </span>
        <button type="button" className={btn} onClick={() => onPageChange(current + 1)} disabled={current >= pageCount} aria-label="Trang sau">
          ›
        </button>
        <button type="button" className={btn} onClick={() => onPageChange(pageCount)} disabled={current >= pageCount} aria-label="Trang cuối">
          »
        </button>
      </div>
    </nav>
  );
}
