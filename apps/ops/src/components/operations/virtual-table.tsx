"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  TableVirtuoso,
  type ContextProp,
  type ItemProps,
  type TableProps,
  type FillerRowProps,
} from "react-virtuoso";
import {
  TableRoot,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from "@orbs/ui/controls/table";
import { Button } from "@orbs/ui/controls/button";
import { useTableRowNavigation } from "../../hooks/use-table-row-navigation";

type VirtualTableContext = {
  label: string;
  rowCount: number;
  columnCount: number;
  columnWidths?: readonly string[];
  openRow: ReturnType<typeof useTableRowNavigation>;
  rowHref: (index: number) => string | undefined;
};

// Stable component identities keep Virtuoso's measurements and focused links intact.
function TableElement({
  context,
  children,
  ...props
}: TableProps & ContextProp<VirtualTableContext>) {
  return (
    <TableRoot
      {...props}
      data-slot="table"
      aria-label={context.label}
      aria-rowcount={context.rowCount + 1}
      aria-colcount={context.columnCount}
      className="w-full caption-bottom text-sm"
      style={{
        ...props.style,
        tableLayout: "fixed",
        borderCollapse: "separate",
        borderSpacing: 0,
      }}
    >
      {context.columnWidths && (
        <colgroup>
          {context.columnWidths.map((width, index) => (
            <col key={index} style={{ width }} />
          ))}
        </colgroup>
      )}
      {children}
    </TableRoot>
  );
}

function Header({
  context: _context,
  ...props
}: React.ComponentProps<typeof TableHeader> &
  ContextProp<VirtualTableContext>) {
  return (
    <TableHeader
      {...props}
      className="bg-card [&_tr]:bg-muted/30 [&_th]:border-b [&_th]:border-border"
    />
  );
}

function Body({
  context: _context,
  ...props
}: React.ComponentProps<typeof TableBody> & ContextProp<VirtualTableContext>) {
  return <TableBody {...props} />;
}

function Row({
  item: _item,
  context,
  ...props
}: ItemProps<unknown> & ContextProp<VirtualTableContext>) {
  const href = context.rowHref(props["data-index"]);
  return (
    <TableRow
      {...props}
      aria-rowindex={props["data-index"] + 2}
      className="group/row motion-reduce:transition-none [&>td]:border-b [&>td]:border-border/50"
      data-clickable={href ? true : undefined}
      onClick={href ? (event) => context.openRow(event, href) : undefined}
      onAuxClick={href ? (event) => context.openRow(event, href) : undefined}
    />
  );
}

function Filler({
  height,
  context,
}: FillerRowProps & ContextProp<VirtualTableContext>) {
  return (
    <TableRow aria-hidden="true" className="pointer-events-none border-0">
      <TableCell
        colSpan={context.columnCount}
        style={{ height, padding: 0, border: 0 }}
      />
    </TableRow>
  );
}

const components = {
  Table: TableElement,
  TableHead: Header,
  TableBody: Body,
  TableRow: Row,
  FillerRow: Filler,
};

/** One page-scrolling table; only the visible rows and a small buffer enter the DOM. */
export function VirtualTable<T>({
  label,
  items,
  header,
  rowContent,
  itemKey,
  rowHref,
  contextKey,
  columnCount,
  columnWidths,
  minWidth = 1280,
}: {
  label: string;
  items: T[];
  header: ReactNode;
  rowContent: (item: T, index: number) => ReactNode;
  itemKey: (item: T) => string;
  rowHref?: (item: T) => string;
  contextKey: string;
  columnCount: number;
  columnWidths?: readonly string[];
  minWidth?: number;
}) {
  const openRow = useTableRowNavigation();
  const [pinned, setPinned] = useState<{
    contextKey: string;
    items: T[];
  } | null>(null);
  const tableItems = pinned?.contextKey === contextKey ? pinned.items : items;
  const context = useMemo(
    () => ({
      label,
      rowCount: tableItems.length,
      columnCount,
      columnWidths,
      openRow,
      rowHref: (index: number) => rowHref?.(tableItems[index]),
    }),
    [label, tableItems, columnCount, columnWidths, openRow, rowHref],
  );
  return (
    <div
      className="min-w-0 space-y-3"
      onFocusCapture={() =>
        setPinned((previous) =>
          previous?.contextKey === contextKey
            ? previous
            : { contextKey, items },
        )
      }
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPinned(null);
      }}
    >
      {tableItems !== items && (
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
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className="min-w-0 max-w-full overflow-x-auto overflow-y-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <TableVirtuoso<T, VirtualTableContext>
          useWindowScroll
          data={tableItems}
          context={context}
          components={components}
          computeItemKey={(_index, item) => itemKey(item)}
          fixedHeaderContent={() => header}
          itemContent={(index, item) => rowContent(item, index)}
          initialItemCount={Math.min(12, tableItems.length)}
          defaultItemHeight={88}
          increaseViewportBy={{ top: 400, bottom: 600 }}
          style={{ minWidth }}
        />
      </div>
    </div>
  );
}
