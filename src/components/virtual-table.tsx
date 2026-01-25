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
}: {
  isLoading: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  tableItems: T[];
  onMobileRowClick?: (item: T) => void;
  onSelect?: (item: T) => void;
  title?: string;
  headerLabels: {
    text: string;
    className?: string;
  }[];
  desktopRows: {
    Component: React.ComponentType<{ item: T }>;
    className?: string;
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
        isLoading={isLoading}
        title={title}
      />
    );
  }

  return (
    <Card className="border-border overflow-hidden">
      <CardHeader className="border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          {tableItems.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-muted rounded-full text-muted-foreground">
              {tableItems.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center w-full py-16 gap-4">
            <Spinner size={32} className="text-primary" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : !tableItems.length ? (
          <div className="flex flex-col items-center justify-center w-full py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">No Data</p>
              <p className="text-sm text-muted-foreground mt-1">
                No items to display yet
              </p>
            </div>
          </div>
        ) : (
          <TableVirtuoso
            endReached={fetchNextPage}
            useWindowScroll
            totalCount={tableItems.length}
            overscan={10}
            components={{
              Table: Table,
              TableHead: TableHeader,
              TableRow: TableRow,
              TableBody: TableBody,
            }}
            fixedHeaderContent={() => {
              return (
                <TableRow className="hover:bg-transparent cursor-default bg-muted/30">
                  {map(headerLabels, (label) => {
                    return (
                      <TableHead
                        className={cn(label.className)}
                        key={label.text}
                      >
                        {label.text}
                      </TableHead>
                    );
                  })}
                </TableRow>
              );
            }}
            itemContent={(index) => {
              const tableItem = tableItems[index];

              if (!tableItem) return null;

              return map(desktopRows, (row, _index) => {
                return (
                  <TableCell
                    key={_index}
                    className={cn(row.className)}
                    onClick={() => onSelect?.(tableItem)}
                  >
                    <row.Component item={tableItem} />
                  </TableCell>
                );
              });
            }}
          />
        )}
        {isFetchingNextPage && (
          <div className="flex items-center justify-center w-full py-8 border-t border-border">
            <Spinner size={24} className="text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading more...
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const MobileTable = <T,>({
  rows,
  tableItems,
  headerLabels,
  onMobileRowClick,
  isLoading,
  title,
}: {
  rows: { Component: React.ComponentType<{ item: T }>; className?: string }[];
  tableItems: T[];
  headerLabels: { text: string; className?: string }[];
  onMobileRowClick?: (item: T) => void;
  isLoading?: boolean;
  title?: string;
}) => {
  const height = useHeight();

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="border-b border-border">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <Spinner size={32} className="text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!tableItems.length) {
    return (
      <Card className="border-border">
        <CardHeader className="border-b border-border">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-foreground">No Data</p>
            <p className="text-sm text-muted-foreground mt-1">
              No items to display yet
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <Layers className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <span className="ml-1 px-2 py-0.5 text-xs font-medium bg-muted rounded-full text-muted-foreground">
          {tableItems.length}
        </span>
      </div>
      <div style={{ height: `calc(${height}px - 200px)` }}>
        <Virtuoso
          totalCount={tableItems.length}
          itemContent={(index) => {
            const tableItem = tableItems[index];
            return (
              <MobileItem<T>
                rows={rows}
                tableItem={tableItem}
                headerLabels={headerLabels}
                onMobileRowClick={onMobileRowClick}
                index={index}
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
  index,
}: {
  rows: { Component: React.ComponentType<{ item: T }>; className?: string }[];
  tableItem: T;
  headerLabels: { text: string; className?: string }[];
  onMobileRowClick?: (item: T) => void;
  index: number;
}) => {
  return (
    <Card
      className="mb-3 border-border hover:border-primary/30 transition-colors cursor-pointer"
      onClick={() => onMobileRowClick?.(tableItem)}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
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
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {headerLabel}
                </span>
                <div className={cn("text-sm text-foreground", row.className)}>
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
