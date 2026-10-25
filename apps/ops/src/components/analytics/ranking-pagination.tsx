"use client";

import { Button } from "@orbs/ui/controls/button";

export const RANKING_PAGE_SIZE = 12;

export function RankingPagination({
  label,
  total,
  page,
  onPage,
}: {
  label: string;
  total: number;
  page: number;
  onPage: (page: number) => void;
}) {
  if (total <= RANKING_PAGE_SIZE) return null;
  const pageCount = Math.ceil(total / RANKING_PAGE_SIZE);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Showing {(page * RANKING_PAGE_SIZE + 1).toLocaleString()}–
        {Math.min((page + 1) * RANKING_PAGE_SIZE, total).toLocaleString()} of{" "}
        {total.toLocaleString()} {label}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page === 0}
          aria-label={`Previous ${label} page`}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {page + 1} / {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page + 1 >= pageCount}
          aria-label={`Next ${label} page`}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
