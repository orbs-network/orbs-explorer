import React from "react";
import { Spinner } from "./ui/spinner";
import { TableVirtuoso, Virtuoso } from "react-virtuoso";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { cn } from "@/lib/utils/utils";
import { map } from "lodash";
import { useMobile } from "@/lib/hooks/use-mobile";
import { useHeight } from "@/lib/hooks/use-height";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { FileText, Layers } from "lucide-react";

export function VirtualTable<T>({
  isLoading,
  isFetchingNextPage,
  fetchNextPage,
  tableItems,
  headerLabels,
  desktopRows,
  onMobileRowClick,
  onSelect,
  title = "Recent Orders",
  headerAction,
}: {
  isLoading: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  tableItems: T[];
  onMobileRowClick?: (item: T) => void;
  onSelect?: (item: T) => void;
  title?: string;
  headerAction?: React.ReactNode;
  headerLabels: {
    text: string;
    className?: string;
    width?: string;
  }[];
  desktopRows: {
    Component: React.ComponentType<{ item: T }>;
    className?: string;
    width?: string;
  }[];
}) {
  const isMobile = useMobile();

  if (isMobile) {
    return (
      <MobileTable<T>
        headerLabels={headerLabels}
        rows={desktopRows}
        tableItems={tableItems}
        onMobileRowClick={onMobileRowClick}
        onEndReached={fetchNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isLoading={isLoading}
        title={title}
        headerAction={headerAction}
      />
    );
  }

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-30 bg-background border-b border-border">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">{title}</h2>
            {tableItems.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-muted rounded-full text-muted-foreground">
                {tableItems.length}
              </span>
            )}
          </div>
          {headerAction}
        </div>
      </div>

      <div className="border border-t-0 border-border rounded-b-lg overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center w-full py-12 gap-3 bg-card">
            <Spinner size={24} className="text-primary" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : !tableItems.length ? (
          <div className="flex flex-col items-center justify-center w-full py-12 gap-3 bg-card">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-base font-medium text-foreground">No Data</p>
              <p className="text-xs text-muted-foreground mt-1">
                No items to display yet
              </p>
            </div>
          </div>
        ) : (
          <TableVirtuoso
            useWindowScroll
            totalCount={tableItems.length}
            overscan={50}
            // ✅ single trigger point
            rangeChanged={(range) => {
              if (range.endIndex >= tableItems.length - 30) {
                fetchNextPage();
              }
            }}
            components={{
              Table: Table,
              TableHead: TableHeader,
              TableRow: TableRow,
              TableBody: TableBody,
            }}
            fixedHeaderContent={() => (
              <TableRow className="hover:bg-transparent cursor-default bg-muted/30">
                {map(headerLabels, (label, index) => {
                  const width = label.width || desktopRows[index]?.width;
                  return (
                    <TableHead
                      className={cn(label.className)}
                      key={label.text}
                      style={width ? { width } : undefined}
                    >
                      {label.text}
                    </TableHead>
                  );
                })}
              </TableRow>
            )}
            itemContent={(index) => {
              const tableItem = tableItems[index];
              if (!tableItem) return null;

              return map(desktopRows, (row, _index) => (
                <TableCell
                  key={_index}
                  className={cn(row.className)}
                  style={row.width ? { width: row.width } : undefined}
                  // optional: keep per-cell click
                  onClick={() => onSelect?.(tableItem)}
                >
                  <row.Component item={tableItem} />
                </TableCell>
              ));
            }}
          />
        )}

        {isFetchingNextPage && (
          <div className="flex items-center justify-center w-full py-3 bg-card border-t border-border">
            <Spinner size={16} className="text-primary" />
            <span className="ml-2 text-xs text-muted-foreground">
              Loading more...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const MobileTable = <T,>({
  rows,
  tableItems,
  headerLabels,
  onMobileRowClick,
  onEndReached,
  isFetchingNextPage,
  isLoading,
  title,
  headerAction,
}: {
  rows: { Component: React.ComponentType<{ item: T }>; className?: string }[];
  tableItems: T[];
  headerLabels: { text: string; className?: string }[];
  onMobileRowClick?: (item: T) => void;
  onEndReached?: () => void;
  isFetchingNextPage?: boolean;
  isLoading?: boolean;
  title?: string;
  headerAction?: React.ReactNode;
}) => {
  const height = useHeight();

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="border-b border-border py-2 px-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            </div>
            {headerAction}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <Spinner size={24} className="text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!tableItems.length) {
    return (
      <Card className="border-border">
        <CardHeader className="border-b border-border py-2 px-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            </div>
            {headerAction}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <FileText className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-base font-medium text-foreground">No Data</p>
            <p className="text-xs text-muted-foreground mt-1">
              No items to display yet
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-30 bg-background border-b border-border">
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <span className="px-1.5 py-0.5 text-xs font-medium bg-muted rounded-full text-muted-foreground">
              {tableItems.length}
            </span>
          </div>
          {headerAction}
        </div>
      </div>

      <div style={{ height: `calc(${height}px - 200px)` }}>
        <Virtuoso
          totalCount={tableItems.length}
          overscan={50}
          rangeChanged={(range) => {
            if (range.endIndex >= tableItems.length - 5 && onEndReached) {
              onEndReached();
            }
          }}
          components={{
            Footer: () =>
              isFetchingNextPage ? (
                <div className="flex items-center justify-center w-full py-3">
                  <Spinner size={16} className="text-primary" />
                  <span className="ml-2 text-xs text-muted-foreground">
                    Loading more...
                  </span>
                </div>
              ) : null,
          }}
          itemContent={(index) => {
            const tableItem = tableItems[index];
            return (
              <MobileItem<T>
                rows={rows}
                tableItem={tableItem}
                headerLabels={headerLabels}
                onMobileRowClick={onMobileRowClick}
              />
            );
          }}
        />
      </div>
    </div>
  );
};

const MobileItem = <T,>({
  rows,
  tableItem,
  headerLabels,
  onMobileRowClick,
}: {
  rows: { Component: React.ComponentType<{ item: T }>; className?: string }[];
  tableItem: T;
  headerLabels: { text: string; className?: string }[];
  onMobileRowClick?: (item: T) => void;
}) => {
  return (
    <Card
      className="mb-2 border-border hover:border-primary/30 transition-colors cursor-pointer"
      onClick={() => onMobileRowClick?.(tableItem)}
    >
      <CardContent className="p-3">
        <div className="flex flex-col gap-2">
          {map(rows, (row, _index) => {
            const headerLabel = headerLabels[_index]
              ? headerLabels[_index].text
              : null;
            if (headerLabel === "Action") return null;
            return (
              <div
                key={_index}
                className="flex flex-row items-center justify-between gap-2"
              >
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  {headerLabel}
                </span>
                <div className={cn("text-xs text-foreground", row.className)}>
                  <row.Component item={tableItem} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
