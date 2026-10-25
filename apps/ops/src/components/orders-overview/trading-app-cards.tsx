"use client";

import { Network } from "@orbs/ui/controls/network";
import { OVERVIEW_STATUSES } from "@orbs/domain/twap/utils/orders-overview";
import {
  tradingAppPartnerHref,
  type TradingAppRow,
  type TradingAppColumns,
} from "@/lib/trading-apps-table";
import { formatHealthAge } from "@/lib/system-health";
import { placementChange } from "@/lib/placement-report";
import { TradingAppIdentity, TradingAppCount } from "./trading-app-cells";
import {
  formatOrderDate,
  formatOrderUsd,
  formatShare,
} from "./overview-display";

export function TradingAppCards({
  rows,
  query,
  snapshot,
  columns,
  totalOrders,
}: {
  rows: TradingAppRow[];
  query: string;
  snapshot: number;
  columns: TradingAppColumns;
  totalOrders: number;
}) {
  return (
    <ul
      aria-label="Trading app comparison"
      className="grid gap-3 p-3 sm:grid-cols-2"
    >
      {rows.map((row) => (
        <li
          key={row.rowId}
          className="min-w-0 rounded-lg bg-control-background p-4"
          style={
            rows.length > 50
              ? {
                  contentVisibility: "auto",
                  containIntrinsicSize: "auto 220px",
                }
              : undefined
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TradingAppIdentity
              row={row}
              href={tradingAppPartnerHref(row, query)}
            />
            {row.chainId !== undefined && (
              <Network
                chainId={row.chainId}
                variant="inline"
                showChainId={false}
              />
            )}
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-right text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Orders</dt>
              <dd className="mt-1">
                <TradingAppCount row={row} query={query} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Failed</dt>
              <dd className="mt-1">
                <TradingAppCount row={row} query={query} status="failed" />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Active</dt>
              <dd className="mt-1">
                <TradingAppCount row={row} query={query} status="active" />
              </dd>
            </div>
          </dl>
          {columns === "detailed" && (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-right text-sm">
              {(
                [
                  "completed",
                  "partial",
                  "cancelled",
                  "expired",
                  ...(row.groups.unknown.length ? ["unknown" as const] : []),
                ] as const
              ).map((status) => (
                <div key={status}>
                  <dt className="text-xs text-muted-foreground">
                    {OVERVIEW_STATUSES[status].label}
                  </dt>
                  <dd>
                    <TradingAppCount row={row} query={query} status={status} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {columns === "business" && (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Share of orders</dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {formatShare(row.totalOrders, totalOrders)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  Orders vs previous period
                </dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {placementChange(row.totalOrders, row.previousOrders)}
                </dd>
              </div>
            </dl>
          )}
          <dl className="mt-4 flex flex-wrap justify-between gap-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Placed value</dt>
              <dd
                className="mt-1 font-medium tabular-nums"
                title={`${row.pricedOrders} of ${row.totalOrders} orders report USD`}
              >
                {row.pricedOrders || !row.totalOrders
                  ? formatOrderUsd(row.totalUsd)
                  : "Unavailable"}
              </dd>
            </div>
            <div className="text-right">
              <dt className="text-muted-foreground">Last placed</dt>
              <dd className="mt-1">
                {row.lastPlaced === undefined ? (
                  "Not reported"
                ) : (
                  <time
                    dateTime={new Date(row.lastPlaced).toISOString()}
                    title={formatOrderDate(row.lastPlaced)}
                  >
                    {row.lastPlaced <= snapshot
                      ? `${formatHealthAge(snapshot - row.lastPlaced)} ago`
                      : formatOrderDate(row.lastPlaced)}
                  </time>
                )}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
