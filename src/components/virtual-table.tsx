"use client";

import React from "react";
import { TableVirtuoso } from "react-virtuoso";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Spinner } from "./ui/spinner";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils/utils";
import { useMobile } from "@/lib/hooks/use-mobile";
import { FileText, Layers } from "lucide-react";

type Column<T> = {
  Component: React.ComponentType<{ item: T }>;
  className?: string;
  text: string;
};

export function VirtualTable<T>({
  isLoading,
  isError = false,
  warnings = [],
  onRetry,
  isFetchingNextPage,
  hasNextPage = false,
  fetchNextPage,
  tableItems,
  headerLabels,
  desktopRows,
  onMobileRowClick,
  onSelect,
  onRowHover,
  title = "Recent Orders",
  headerAction,
}: {
  isLoading: boolean;
  isError?: boolean;
  warnings?: string[];
  onRetry?: () => void;
  isFetchingNextPage: boolean;
  hasNextPage?: boolean;
  fetchNextPage: () => void;
  tableItems: T[];
  headerLabels: { text: string; className?: string }[];
  desktopRows: Column<T>[];
  onMobileRowClick?: (item: T) => void;
  onSelect?: (item: T) => void;
  onRowHover?: (item: T) => void;
  title?: string;
  headerAction?: React.ReactNode;
}) {
  const mobile = useMobile();
  const select = mobile ? (onMobileRowClick ?? onSelect) : onSelect;
  const activate = (event: React.KeyboardEvent, item: T) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select?.(item);
    }
  };
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-panel">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Layers aria-hidden className="size-4 text-primary" />
          <div>
            <h1 className="text-base font-semibold">{title}</h1>
            {select && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Open a row to see what happened.
              </p>
            )}
          </div>
          {tableItems.length > 0 && (
            <span
              className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground"
              aria-label={`${tableItems.length} loaded items`}
            >
              {tableItems.length}
            </span>
          )}
        </div>
        {headerAction}
      </header>
      {isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-sm"
        >
          <p>
            Couldn’t load {title.toLowerCase()}.
            {tableItems.length > 0
              ? " Showing previously loaded data."
              : " Try again to refresh the data."}
          </p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      )}
      {warnings.length > 0 && (
        <div
          role="status"
          className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {[...new Set(warnings)].map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Refresh data
              </Button>
            )}
          </div>
        </div>
      )}
      {isLoading ? (
        <div
          role="status"
          className="flex min-h-48 flex-col items-center justify-center gap-3"
        >
          <Spinner size={24} />
          <p className="text-sm text-muted-foreground">
            Loading {title.toLowerCase()}…
          </p>
        </div>
      ) : tableItems.length === 0 ? (
        !isError && (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
            <FileText aria-hidden className="size-8 text-muted-foreground" />
            <p className="font-medium">
              {hasNextPage
                ? "No matches in loaded results"
                : `No matching ${title.toLowerCase()}`}
            </p>
            <p className="text-sm text-muted-foreground">
              {hasNextPage
                ? "Load more to search older activity, or change your filters."
                : "Try changing your filters or check back for new activity."}
            </p>
          </div>
        )
      ) : (
        <div className="overflow-x-auto">
          <TableVirtuoso
            useWindowScroll
            totalCount={tableItems.length}
            overscan={200}
            endReached={() => {
              if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            components={{
              Table: ({ context: _context, ...props }) => (
                <table {...props} className="w-full caption-bottom text-sm" />
              ),
              TableHead: TableHeader,
              TableBody,
              TableRow: ({ children, ...props }) => {
                const index = (props as { "data-index"?: number })[
                  "data-index"
                ];
                const item =
                  index === undefined ? undefined : tableItems[index];
                return (
                  <TableRow
                    {...props}
                    tabIndex={select && item ? 0 : undefined}
                    aria-label={
                      select && item
                        ? `View ${title.toLowerCase()} details, row ${Number(index) + 1}`
                        : undefined
                    }
                    onClick={
                      item && select
                        ? (event) => {
                            if (
                              (event.target as HTMLElement).closest(
                                "a, button, input, select",
                              )
                            )
                              return;
                            select(item);
                          }
                        : undefined
                    }
                    onKeyDown={
                      item && select
                        ? (event) => activate(event, item)
                        : undefined
                    }
                    onMouseEnter={
                      item && onRowHover ? () => onRowHover(item) : undefined
                    }
                    className={cn(
                      mobile && "block border-b-8 border-background p-4",
                      !select && "cursor-default",
                    )}
                  >
                    {children}
                  </TableRow>
                );
              },
            }}
            fixedHeaderContent={
              mobile
                ? undefined
                : () => (
                    <TableRow className="cursor-default bg-muted">
                      {headerLabels.map((label) => (
                        <TableHead key={label.text} className={label.className}>
                          {label.text}
                        </TableHead>
                      ))}
                    </TableRow>
                  )
            }
            itemContent={(index) => {
              const item = tableItems[index];
              return desktopRows.map((row, columnIndex) => (
                <TableCell
                  key={row.text}
                  className={cn(
                    row.className,
                    mobile &&
                      "flex items-center justify-between gap-4 whitespace-normal px-0 py-1.5",
                  )}
                >
                  {mobile && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {headerLabels[columnIndex]?.text}
                    </span>
                  )}
                  <div className={cn(mobile && "min-w-0 text-right")}>
                    <row.Component item={item} />
                  </div>
                </TableCell>
              ));
            }}
          />
        </div>
      )}
      {(isFetchingNextPage || hasNextPage) && (
        <div className="flex justify-center border-t border-border p-4">
          {isFetchingNextPage ? (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Spinner size={16} />
              Loading more…
            </p>
          ) : (
            <Button variant="outline" onClick={fetchNextPage}>
              Load more
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
