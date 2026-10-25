"use client";

import type { ComponentProps, ReactNode } from "react";
import { TableVirtuoso } from "react-virtuoso";
import { TableBody, TableHeader, TableRow } from "@orbs/ui/controls/table";

type TableContext = {
  label: string;
  rowCount: number;
  minWidth?: number;
  columnWidths?: readonly string[];
};

function Table({
  context,
  children,
  ...props
}: ComponentProps<"table"> & { context?: TableContext }) {
  return (
    <table
      {...props}
      aria-label={context?.label}
      aria-rowcount={context?.rowCount}
      style={{
        ...props.style,
        minWidth: context?.minWidth,
        tableLayout: context?.columnWidths ? "fixed" : undefined,
      }}
      className="w-full text-left text-[13px] tabular-nums [&_th]:whitespace-nowrap [&_th]:px-3 [&_th]:py-3 [&_th]:font-medium [&_td]:px-3 [&_td]:py-3 [&_thead]:bg-card [&_thead]:text-muted-foreground [&_tbody_tr]:align-middle"
    >
      {context?.columnWidths && (
        <colgroup>
          {context.columnWidths.map((width, index) => (
            <col key={index} style={{ width }} />
          ))}
        </colgroup>
      )}
      {children}
    </table>
  );
}

function Row({
  item: _item,
  context: _context,
  ...props
}: ComponentProps<"tr"> & { item?: unknown; context?: unknown }) {
  const index = (props as { "data-index"?: number })["data-index"];
  return (
    <TableRow
      {...props}
      aria-rowindex={index === undefined ? undefined : index + 2}
      className="group/row relative cursor-default transition-colors motion-reduce:transition-none"
    />
  );
}

function Head({
  context,
  ...props
}: ComponentProps<"thead"> & { context?: TableContext }) {
  return (
    <TableHeader
      {...props}
      style={{
        ...props.style,
        ...(context?.minWidth === undefined && !context?.columnWidths
          ? {}
          : { zIndex: 30 }),
      }}
    />
  );
}

// Keep component identities stable so scrolling never remounts row controls.
const components = { Table, TableHead: Head, TableBody, TableRow: Row };

export function ContinuousTable<T>({
  label,
  items,
  header,
  rowContent,
  itemKey,
  minWidth = 640,
  viewportHeight,
  columnWidths,
}: {
  label: string;
  items: T[];
  header: ReactNode;
  rowContent: (item: T, index: number) => ReactNode;
  itemKey: (item: T) => string;
  minWidth?: number;
  viewportHeight?: string | number;
  columnWidths?: readonly string[];
}) {
  return (
    <div
      role={viewportHeight ? undefined : "region"}
      aria-label={viewportHeight ? undefined : label}
      tabIndex={viewportHeight ? undefined : 0}
      className={`min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${columnWidths && !viewportHeight ? "overflow-visible" : "overflow-x-auto overflow-y-hidden"}`}
    >
      <TableVirtuoso<T, TableContext>
        useWindowScroll={!viewportHeight}
        role={viewportHeight ? "region" : undefined}
        aria-label={viewportHeight ? label : undefined}
        tabIndex={viewportHeight ? 0 : undefined}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        context={{
          label,
          rowCount: items.length + 1,
          minWidth: viewportHeight ? minWidth : undefined,
          columnWidths,
        }}
        data={items}
        style={viewportHeight ? { height: viewportHeight } : { minWidth }}
        overscan={400}
        components={components}
        computeItemKey={(_index, item) => itemKey(item)}
        fixedHeaderContent={() => header}
        itemContent={(index, item) => rowContent(item, index)}
      />
    </div>
  );
}
