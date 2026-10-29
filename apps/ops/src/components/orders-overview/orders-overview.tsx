"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  groupOverviewOrders,
  OVERVIEW_STATUSES,
  type OverviewOrderStatus,
  getOrderValueUsd,
} from "@orbs/domain/twap/utils/orders-overview";
import type { ListOrder } from "@orbs/domain/twap/types";
import { ChevronRight } from "lucide-react";
import { cn } from "@orbs/domain/utils/utils";

import { STATUS_COLORS, formatOrderUsd, formatShare } from "./overview-display";
import { ExportOrders } from "./export-orders";
import { reportedNumber } from "@/lib/order-diagnostics";
import {
  ordersScopeHref,
  type OrderNavigationScope,
} from "@/lib/order-investigation";
import { placementChange, type PlacementReport } from "@/lib/placement-report";
import { orderPeriodDuration } from "@/lib/order-period";

const hasReportedUsd = (orders: ListOrder[]) =>
  !orders.length ||
  orders.some((order) => reportedNumber(order.totalUSDAmount) !== undefined);

export function OrdersOverview({
  allOrders,
  navigationScope,
  report,
}: {
  allOrders: ListOrder[];
  navigationScope: OrderNavigationScope;
  report?: PlacementReport;
}) {
  // Match the displayed cohort without carrying hidden Orders-only filters.
  const scope = {
    period: navigationScope.period,
    chainIds: navigationScope.chainIds,
    partnerIds: navigationScope.partnerIds,
  };
  const groups = useMemo(() => groupOverviewOrders(allOrders), [allOrders]);
  const statuses: OverviewOrderStatus[] = [
    "failed",
    "active",
    "completed",
    "partial",
    "cancelled",
    "expired",
    ...(groups.unknown.length ? ["unknown" as const] : []),
  ];
  const totalValue = allOrders.reduce(
    (sum, order) => sum + getOrderValueUsd(order),
    0,
  );
  return (
    <section aria-label="Order outcomes" className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {report ? (
            <h2 className="text-sm font-semibold">Placement activity</h2>
          ) : (
            <>
              <Link
                href={ordersScopeHref(scope)}
                prefetch={false}
                className="rounded text-left text-base font-semibold hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="View all orders in this view"
              >
                {allOrders.length.toLocaleString()}{" "}
                {allOrders.length === 1 ? "order" : "orders"}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  in this view
                </span>
              </Link>
              <p className="text-xs text-muted-foreground">
                Placed value{" "}
                <strong
                  className="ml-1 font-semibold text-foreground tabular-nums"
                  title={`${allOrders.filter((order) => reportedNumber(order.totalUSDAmount) !== undefined).length}/${allOrders.length} orders report USD. ${
                    hasReportedUsd(allOrders)
                      ? new Intl.NumberFormat(undefined, {
                          style: "currency",
                          currency: "USD",
                        }).format(totalValue)
                      : "Placed value unavailable."
                  }`}
                >
                  {hasReportedUsd(allOrders) ? formatOrderUsd(totalValue) : "—"}
                </strong>
              </p>
            </>
          )}
        </div>
        <ExportOrders orders={allOrders} snapshotAt={report?.end} />
      </div>
      {report && (
        <dl className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            {
              label: "Orders placed",
              value: report.current.orders.toLocaleString(),
              change: placementChange(
                report.current.orders,
                report.previous?.orders,
              ),
              previous: report.previous?.orders.toLocaleString(),
              href: ordersScopeHref(scope),
            },
            {
              label: "Placed value (USD)",
              value:
                report.current.placedUsd === undefined
                  ? "Unavailable"
                  : formatOrderUsd(report.current.placedUsd),
              change: placementChange(
                report.current.placedUsd,
                report.previous?.placedUsd,
              ),
              previous:
                report.previous?.placedUsd === undefined
                  ? undefined
                  : formatOrderUsd(report.previous.placedUsd),
              // Coverage only matters when some orders are missing a USD value.
              note:
                report.current.pricedOrders < report.current.orders
                  ? `${report.current.orders - report.current.pricedOrders} orders without a USD value`
                  : undefined,
            },
            {
              label: "Apps with orders",
              value: report.current.apps.toLocaleString(),
              change: placementChange(
                report.current.apps,
                report.previous?.apps,
              ),
              previous: report.previous?.apps.toLocaleString(),
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="min-w-0 rounded-xl bg-card px-3 py-3 sm:px-4 sm:py-3.5"
            >
              <dt className="text-xs text-muted-foreground">{metric.label}</dt>
              <dd className="mt-1 truncate text-lg font-semibold tabular-nums sm:text-xl">
                {metric.href ? (
                  <Link
                    href={metric.href}
                    prefetch={false}
                    className="rounded hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {metric.value}
                  </Link>
                ) : (
                  metric.value
                )}
              </dd>
              {report.previous && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {metric.change}
                  </span>
                  {/* Phones keep the change; the comparison detail needs more room. */}
                  <span className="hidden sm:inline">
                    {" "}
                    vs previous {orderPeriodDuration(report.days)}
                    {metric.previous ? ` (${metric.previous})` : ""}
                  </span>
                </p>
              )}
              {metric.note && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {metric.note}
                </p>
              )}
            </div>
          ))}
        </dl>
      )}
      <div
        className={cn(
          "grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-control-background sm:grid-cols-3",
          statuses.length === 7 ? "xl:grid-cols-7" : "xl:grid-cols-6",
        )}
      >
        {statuses.map((key) => (
          <Link
            key={key}
            href={ordersScopeHref({
              ...scope,
              query: new URLSearchParams({ order_status: key }).toString(),
            })}
            prefetch={false}
            aria-label={`View ${OVERVIEW_STATUSES[key].label.toLowerCase()} orders (${groups[key].length})`}
            className={cn(
              "min-w-0 bg-card px-3.5 py-2.5 text-left transition-colors hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none",
              statuses.length === 7 &&
                "last:col-span-2 sm:last:col-span-3 xl:last:col-span-1",
            )}
          >
            <span className="flex items-center justify-between gap-1 text-xs font-medium">
              <span>
                {key === "active"
                  ? "Active from this period"
                  : OVERVIEW_STATUSES[key].label}
              </span>
              {groups[key].length > 0 && (
                <ChevronRight
                  aria-hidden
                  className="size-3 shrink-0 text-muted-foreground"
                />
              )}
            </span>
            <span
              className={cn(
                "mt-1 flex flex-wrap items-baseline justify-between gap-x-2 text-xl font-semibold tabular-nums",
                groups[key].length
                  ? STATUS_COLORS[key]
                  : "text-muted-foreground",
              )}
            >
              {groups[key].length.toLocaleString()}{" "}
              <span className="text-[11px] font-normal text-muted-foreground">
                {formatShare(groups[key].length, allOrders.length)}
              </span>
            </span>
            <span className="block text-[11px] text-muted-foreground">
              {hasReportedUsd(groups[key])
                ? formatOrderUsd(
                    groups[key].reduce(
                      (sum, o) => sum + getOrderValueUsd(o),
                      0,
                    ),
                  )
                : "—"}{" "}
              placed
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
