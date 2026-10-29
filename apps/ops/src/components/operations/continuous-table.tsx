"use client";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
} from "@orbs/ui/controls/table";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { useTableRowNavigation } from "../../hooks/use-table-row-navigation";
import { Button } from "@orbs/ui/controls/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orbs/ui/controls/select";

/** Shared shadcn table with semantic markup and URL-backed pagination. */
export function ContinuousTable<T>({
  label,
  items,
  header,
  rowContent,
  itemKey,
  rowHref,
  minWidth = 720,
  viewportHeight: _viewportHeight,
  columnWidths,
}: {
  label: string;
  items: T[];
  header: ReactNode;
  rowContent: (item: T, index: number) => ReactNode;
  itemKey: (item: T) => string;
  rowHref?: (item: T) => string;
  minWidth?: number;
  viewportHeight?: string | number;
  columnWidths?: readonly string[];
}) {
  const router = useRouter(),
    pathname = usePathname(),
    search = useSearchParams();
  const id = useId();
  const openRow = useTableRowNavigation();
  const context = `${pathname}?${search}`;
  const [pinned, setPinned] = useState<{ context: string; items: T[] } | null>(
    null,
  );
  const tableItems = pinned?.context === context ? pinned.items : items;
  const pending = tableItems !== items && pinned?.context === context;
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_$/, "");
  const pageKey = `table_page_${key}`,
    sizeKey = `table_size_${key}`;
  const size = [25, 50, 100].includes(Number(search.get(sizeKey)))
    ? Number(search.get(sizeKey))
    : 25;
  const pages = Math.max(1, Math.ceil(tableItems.length / size));
  const requested = Number(search.get(pageKey) || 1);
  const page = Math.min(
    pages,
    Number.isSafeInteger(requested) && requested > 0 ? requested : 1,
  );
  const start = (page - 1) * size;
  const visible = tableItems.slice(start, start + size);
  const update = (nextPage: number, nextSize = size) => {
    const next = new URLSearchParams(search.toString());
    if (nextPage === 1) next.delete(pageKey);
    else next.set(pageKey, String(nextPage));
    if (nextSize === 25) next.delete(sizeKey);
    else next.set(sizeKey, String(nextSize));
    router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  return (
    <div
      className="min-w-0 space-y-3"
      onFocusCapture={() =>
        setPinned((previous) =>
          previous?.context === context ? previous : { context, items },
        )
      }
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPinned(null);
      }}
    >
      {pending && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
        >
          Updated data is available. Rows stay in place while you work.
          <Button variant="outline" size="sm" onClick={() => setPinned(null)}>
            Apply updated rows
          </Button>
        </div>
      )}
      <Table
        containerProps={{
          role: "region",
          "aria-label": label,
          tabIndex: 0,
          className:
            "min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        }}
        aria-label={label}
        style={{
          minWidth: Math.max(minWidth, columnWidths ? 960 : 640),
          tableLayout: columnWidths ? "fixed" : undefined,
        }}
      >
        {columnWidths && (
          <colgroup>
            {columnWidths.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
        )}
        <TableHeader>{header}</TableHeader>
        <TableBody>
          {visible.map((item, index) => {
            const href = rowHref?.(item);
            return (
              <TableRow
                key={itemKey(item)}
                className="group/row"
                data-clickable={href ? true : undefined}
                onClick={href ? (event) => openRow(event, href) : undefined}
                onAuxClick={href ? (event) => openRow(event, href) : undefined}
              >
                {rowContent(item, start + index)}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <nav
        aria-label={`${label} pages`}
        className="flex flex-wrap items-center justify-between gap-3 px-3 pb-3 text-xs text-muted-foreground"
      >
        <p role="status" aria-live="polite" className="tabular-nums">
          {tableItems.length
            ? `${(start + 1).toLocaleString()}–${Math.min(start + size, tableItems.length).toLocaleString()} of ${tableItems.length.toLocaleString()}`
            : "0 results"}
        </p>
        {(tableItems.length > 25 || size !== 25) && (
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor={`${id}-size`} className="flex items-center gap-2">
              Rows per page
              <Select
                value={String(size)}
                onValueChange={(value) => update(1, Number(value))}
              >
                <SelectTrigger
                  id={`${id}-size`}
                  className="h-9 w-20 border-0 bg-control-background text-xs shadow-none"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[25, 50, 100].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => update(page - 1)}
            >
              Previous
            </Button>
            <span className="tabular-nums">
              {page} / {pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page === pages}
              onClick={() => update(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </nav>
    </div>
  );
}
