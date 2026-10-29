import type { ReactNode } from "react";
import { Skeleton } from "@orbs/ui/skeleton";
import { cn } from "@orbs/domain/utils/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@orbs/ui/controls/table";

/** Announce one loading state; the visual placeholders are decorative. */
function LoadingState({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      data-slot="loading-state"
      className={cn("w-full min-w-0", className)}
    >
      <span className="sr-only">{label}…</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export function InlineSkeleton({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      aria-busy="true"
      data-slot="loading-state"
      className="inline-block max-w-full align-middle"
    >
      <span className="sr-only">{label}…</span>
      <Skeleton
        as="span"
        className={cn("inline-block h-3 w-36 max-w-full", className)}
      />
    </span>
  );
}

function MetricPlaceholders({ count = 3 }: { count?: number }) {
  return (
    <div
      className={cn(
        "grid gap-3",
        count === 3 ? "grid-cols-3" : "grid-cols-2 lg:grid-cols-4",
      )}
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="min-w-0 space-y-3 rounded-xl bg-card p-4">
          <Skeleton className="h-3 w-24 max-w-full" />
          <Skeleton className="h-6 w-20 max-w-full" />
          <Skeleton className="h-3 w-36 max-w-full" />
        </div>
      ))}
    </div>
  );
}

function FieldPlaceholders({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4",
        className,
      )}
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-28 max-w-full" />
          <Skeleton className="h-5 w-20 max-w-full" />
        </div>
      ))}
    </div>
  );
}

function TablePlaceholders({
  columns,
  rows,
  header,
}: {
  columns: number;
  rows: number;
  header?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-card">
      {header}
      <Table style={{ minWidth: columns > 7 ? 1100 : 720 }}>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }, (_, column) => (
              <TableHead key={column}>
                <Skeleton className="my-3 h-3 w-16" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, row) => (
            <TableRow key={row} className="pointer-events-none">
              {Array.from({ length: columns }, (_, column) => (
                <TableCell key={column} className="py-5">
                  <Skeleton
                    className={cn("h-3", column === 0 ? "w-28" : "w-16")}
                  />
                  {(column === 0 || column === 1) && (
                    <Skeleton className="mt-3 h-2.5 w-20" />
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Skeleton className="m-4 h-3 w-20" />
    </div>
  );
}

export function TableSkeleton({
  label = "Loading order history",
  columns = 9,
  rows = 6,
}: {
  label?: string;
  columns?: number;
  rows?: number;
}) {
  return (
    <LoadingState label={label}>
      <TablePlaceholders columns={columns} rows={rows} />
    </LoadingState>
  );
}

function ChartPlaceholders() {
  return (
    <div className="space-y-5 rounded-xl bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="flex h-56 items-end gap-3 pt-5 sm:gap-5">
        {[36, 64, 48, 80, 55, 72, 44].map((height, index) => (
          <Skeleton
            key={index}
            className="min-w-0 flex-1 rounded-b-none"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between gap-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-2.5 w-12" />
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({
  label = "Loading activity chart",
}: {
  label?: string;
}) {
  return (
    <LoadingState label={label}>
      <ChartPlaceholders />
    </LoadingState>
  );
}

/** Keeps an uninitialized chart's footprint without adding another card. */
export function ChartPlotSkeleton({
  label,
  height = 300,
}: {
  label: string;
  height?: number;
}) {
  return (
    <LoadingState label={label}>
      <div
        style={{ height }}
        className="flex items-end gap-3 rounded-lg px-4 pb-6 pt-5 sm:gap-5"
      >
        {[36, 64, 48, 80, 55, 72, 44].map((value, index) => (
          <Skeleton
            key={index}
            className="min-w-0 flex-1 rounded-b-none"
            style={{ height: `${value}%` }}
          />
        ))}
      </div>
    </LoadingState>
  );
}

export function ServiceStatusSkeleton({ label }: { label: string }) {
  return (
    <LoadingState label={label}>
      <div className="space-y-3 py-1">
        <Skeleton className="h-5 w-24 max-w-full" />
        <Skeleton className="h-3 w-40 max-w-full" />
        <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
          <Skeleton className="h-3 w-20 max-w-full" />
          <Skeleton className="h-3 w-20 max-w-full" />
        </div>
      </div>
    </LoadingState>
  );
}

export function FilterFieldsSkeleton() {
  return (
    <LoadingState label="Loading filter options">
      <div className="space-y-5">
        {[0, 1].map((index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
      </div>
    </LoadingState>
  );
}

export function OverviewSkeleton() {
  return (
    <LoadingState label="Loading placement activity" className="space-y-6">
      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-36" />
          <MetricPlaceholders />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="space-y-3 rounded-lg bg-card p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-10" />
              </div>
            ))}
          </div>
        </div>
        <TablePlaceholders
          columns={7}
          rows={6}
          header={
            <div className="flex flex-wrap items-center justify-between gap-4 p-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-9 w-52 max-w-full" />
            </div>
          }
        />
      </div>
    </LoadingState>
  );
}

export function AnalyticsSkeleton({
  label = "Loading analytics",
}: {
  label?: string;
}) {
  return (
    <LoadingState label={label}>
      <div className="space-y-4">
        <MetricPlaceholders />
        <ChartPlaceholders />
        <TablePlaceholders columns={6} rows={4} />
      </div>
    </LoadingState>
  );
}

export function PartnerOverviewSkeleton() {
  return (
    <LoadingState label="Loading partner activity">
      <div className="space-y-4">
        <Skeleton className="h-4 w-64 max-w-full" />
        <div className="space-y-4 rounded-xl bg-card p-5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-8 w-60 max-w-full" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <ChartPlaceholders />
        <TablePlaceholders columns={6} rows={3} />
      </div>
    </LoadingState>
  );
}

export function OrderDetailSkeleton() {
  return (
    <LoadingState label="Loading order details">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-xl bg-card p-5 sm:p-6">
          <Skeleton className="h-7 w-48 max-w-full" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-11 w-96 max-w-full rounded-lg" />
        <div className="space-y-4 rounded-xl bg-card p-5 sm:p-6">
          <Skeleton className="h-5 w-48 max-w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-44" />
        </div>
        <div className="space-y-4 rounded-xl bg-card p-4 sm:p-5">
          <Skeleton className="h-4 w-32" />
          <FieldPlaceholders count={4} />
          <div className="space-y-2.5 border-t border-border/60 pt-3">
            <Skeleton className="h-4 w-36" />
            <FieldPlaceholders
              count={3}
              className="sm:grid-cols-3 lg:grid-cols-3"
            />
          </div>
          <Skeleton className="h-3 w-3/4" />
        </div>
        <div className="space-y-6 rounded-xl bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
          <FieldPlaceholders />
          <FieldPlaceholders count={8} className="lg:grid-cols-2" />
        </div>
        <div className="rounded-xl bg-card p-5 sm:p-6">
          <FieldPlaceholders count={2} className="lg:grid-cols-2" />
        </div>
      </div>
    </LoadingState>
  );
}

export function EventListSkeleton({
  label = "Loading client logs",
}: {
  label?: string;
}) {
  return (
    <LoadingState label={label}>
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-lg bg-muted/30 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-40 max-w-full" />
          </div>
        ))}
      </div>
    </LoadingState>
  );
}

export function PageSkeleton({ children }: { children?: ReactNode }) {
  return (
    <div className="min-w-0 space-y-5">
      <LoadingState label="Loading page">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-8 w-28" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </LoadingState>
      {children ?? <AnalyticsSkeleton />}
    </div>
  );
}
