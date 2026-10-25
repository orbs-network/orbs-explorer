"use client";

import { Network } from "@orbs/ui/controls/network";
import type { ListOrder } from "@orbs/domain/twap/types";
import { useOperationsData } from "@/components/operations/operations-view";
import { TableFrame } from "@/components/operations/primitives";
import {
  formatOrderUsd,
  formatShare,
} from "@/components/orders-overview/overview-display";
import type { ExecutionCohort } from "@/lib/execution-analytics";

export const cellClass = "whitespace-nowrap px-3 py-3 text-left tabular-nums";
export const headClass = `${cellClass} font-medium text-muted-foreground`;
export const inspectClass =
  "rounded text-link underline-offset-4 enabled:hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground";

export function InspectCount({
  orders,
  label,
}: {
  orders: ListOrder[];
  label: string;
}) {
  const { inspectOrders } = useOperationsData();
  return (
    <button
      type="button"
      disabled={!orders.length}
      onClick={() => inspectOrders(label, orders)}
      aria-label={`Inspect ${label.toLowerCase()}: ${orders.length} orders`}
      className={inspectClass}
    >
      {orders.length.toLocaleString()}
    </button>
  );
}

export function CohortRows({
  cohorts,
  total,
}: {
  cohorts: ExecutionCohort[];
  total: number;
}) {
  const { inspectOrders } = useOperationsData();
  return (
    <div className="space-y-1">
      {cohorts.map((cohort) => (
        <button
          key={cohort.id}
          type="button"
          disabled={!cohort.orders.length}
          onClick={() =>
            inspectOrders(cohort.label, cohort.orders, cohort.description)
          }
          className="block w-full rounded-lg p-2 text-left enabled:hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <span className="flex items-start justify-between gap-3 text-sm">
            <span>{cohort.label}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {cohort.orders.length.toLocaleString()}{" "}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {formatShare(cohort.orders.length, total)}
              </span>
            </span>
          </span>
          <span
            aria-hidden="true"
            className="mt-2 block h-1 overflow-hidden rounded-full bg-muted"
          >
            <span
              className="block h-full rounded-full bg-primary/70"
              style={{
                width: `${total ? (cohort.orders.length / total) * 100 : 0}%`,
              }}
            />
          </span>
        </button>
      ))}
    </div>
  );
}

export interface ImpactRow {
  chainId?: number;
  id: string;
  label: string;
  orders: ListOrder[];
  all: ListOrder[];
  terminal: ListOrder[];
  latest: ListOrder[];
  active: ListOrder[];
  completed: ListOrder[];
  affectedValue: number;
  affectedValueCoverage: number;
}

export function FailureImpactTable({
  rows,
  label,
}: {
  rows: ImpactRow[];
  label: string;
}) {
  return (
    <TableFrame label={label}>
      <thead>
        <tr>
          {[
            label,
            "Affected",
            "Share of orders",
            "Failed",
            "Latest error",
            "Active with errors",
            "Completed with errors",
            "Placed value",
          ].map((heading) => (
            <th key={heading} scope="col" className={headClass}>
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t border-border hover:bg-muted/30">
            <th scope="row" className={`${cellClass} font-medium`}>
              {row.chainId !== undefined ? (
                <Network
                  chainId={row.chainId}
                  data={{ id: row.chainId, name: row.label }}
                  variant="inline"
                  showChainId={false}
                />
              ) : (
                row.label
              )}
            </th>
            <td className={cellClass}>
              <InspectCount
                orders={row.all}
                label={`${row.label}: all error signals`}
              />
            </td>
            <td className={cellClass}>
              {formatShare(row.all.length, row.orders.length)}
            </td>
            <td className={`${cellClass} text-destructive`}>
              <InspectCount
                orders={row.terminal}
                label={`${row.label}: failed orders`}
              />
            </td>
            <td className={cellClass}>
              <InspectCount
                orders={row.latest}
                label={`${row.label}: latest attempt errors`}
              />
            </td>
            <td className={cellClass}>
              <InspectCount
                orders={row.active}
                label={`${row.label}: active with errors`}
              />
            </td>
            <td className={cellClass}>
              <InspectCount
                orders={row.completed}
                label={`${row.label}: completed with errors`}
              />
            </td>
            <td className={cellClass}>
              {row.affectedValueCoverage
                ? formatOrderUsd(row.affectedValue)
                : "—"}
              {row.affectedValueCoverage < row.all.length && (
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {row.affectedValueCoverage}/{row.all.length} reported
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

export function formatDuration(milliseconds: number | undefined): string {
  if (
    milliseconds === undefined ||
    !Number.isFinite(milliseconds) ||
    milliseconds < 0
  )
    return "Not provided";
  const unit =
    milliseconds >= 86_400_000 ? "d" : milliseconds >= 3_600_000 ? "h" : "m";
  const divisor = unit === "d" ? 86_400_000 : unit === "h" ? 3_600_000 : 60_000;
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(milliseconds / divisor)}${unit}`;
}
