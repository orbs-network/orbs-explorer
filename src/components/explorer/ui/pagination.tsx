"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/utils";

/**
 * Offset-based pagination footer for list pages.
 * Owns no state — caller drives `page` and `pageSize` via URL query params.
 *
 *   <Pagination
 *     page={page}
 *     pageSize={size}
 *     total={total}
 *     onPageChange={p => setPage(p)}
 *     onPageSizeChange={s => setSize(s)}
 *   />
 */

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

type Props = {
  /** 1-indexed page number. */
  page: number;
  pageSize: number;
  /** Total row count from the backend. */
  total: number;
  /** Total rows currently rendered — used for the "X – Y of Z" range. */
  rowsOnPage: number;
  /** Whether the data fetch is in flight (disables nav buttons). */
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
};

export function Pagination({
  page,
  pageSize,
  total,
  rowsOnPage,
  isLoading = false,
  onPageChange,
  onPageSizeChange,
  className,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const firstRow = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const lastRow = total === 0 ? 0 : Math.min(firstRow + rowsOnPage - 1, total);

  const canPrev = clampedPage > 1 && !isLoading;
  const canNext = clampedPage < totalPages && !isLoading;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2",
        className
      )}
    >
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="font-mono tabular-nums">
          {firstRow.toLocaleString()}–{lastRow.toLocaleString()} of{" "}
          {total.toLocaleString()}
        </span>
        <div className="flex items-center gap-1.5">
          <label htmlFor="page-size" className="font-mono uppercase tracking-wider text-[10px]">
            rows
          </label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 rounded border border-border bg-card px-2 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Rows per page"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(clampedPage - 1)}
          disabled={!canPrev}
          aria-label="Previous page"
          className="inline-grid h-7 w-7 place-items-center rounded border border-border bg-card text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          page <span className="text-foreground">{clampedPage}</span> /{" "}
          {totalPages.toLocaleString()}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(clampedPage + 1)}
          disabled={!canNext}
          aria-label="Next page"
          className="inline-grid h-7 w-7 place-items-center rounded border border-border bg-card text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export { PAGE_SIZE_OPTIONS };
