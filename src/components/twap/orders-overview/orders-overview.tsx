"use client";

import { useMemo, useRef, useState } from "react";
import {
  groupOverviewOrders,
  OVERVIEW_STATUSES,
  type OverviewOrderStatus,
  getOrderValueUsd,
} from "@/lib/twap/utils/orders-overview";
import type { ListOrder } from "@/lib/twap/types";
import { ChevronRight } from "lucide-react";
import { StatusOrdersModal } from "./status-order-modal";
import { cn } from "@/lib/utils/utils";

import { STATUS_COLORS, formatOrderUsd } from "./overview-display";

export function OrdersOverview({ allOrders }: { allOrders: ListOrder[] }) {
  const lastTrigger = useRef<HTMLButtonElement>(null);
  const [openStatus, setOpenStatus] = useState<OverviewOrderStatus | null>(
    null,
  );
  const groups = useMemo(() => groupOverviewOrders(allOrders), [allOrders]);
  const statuses = (
    Object.keys(OVERVIEW_STATUSES) as OverviewOrderStatus[]
  ).filter((key) => key !== "unknown" || groups.unknown.length);
  const totalValue = allOrders.reduce(
    (sum, order) => sum + getOrderValueUsd(order),
    0,
  );
  return (
    <section aria-label="Order outcomes" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {allOrders.length.toLocaleString()}{" "}
          {allOrders.length === 1 ? "order" : "orders"}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            in this view
          </span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Placed order value{" "}
          <strong
            className="ml-1 font-semibold text-foreground tabular-nums"
            title={new Intl.NumberFormat(undefined, {
              style: "currency",
              currency: "USD",
            }).format(totalValue)}
          >
            {formatOrderUsd(totalValue)}
          </strong>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {statuses.map((key) => (
          <button
            key={key}
            type="button"
            disabled={!groups[key].length}
            onClick={(event) => {
              lastTrigger.current = event.currentTarget;
              setOpenStatus(key);
            }}
            aria-label={`View ${OVERVIEW_STATUSES[key].label.toLowerCase()} orders (${groups[key].length})`}
            className="min-w-0 rounded-xl border border-border bg-card p-4 text-left transition-colors enabled:hover:border-primary/40 enabled:hover:bg-muted/30 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center justify-between gap-1 text-sm font-medium">
              <span>{OVERVIEW_STATUSES[key].label}</span>
              {groups[key].length > 0 && (
                <ChevronRight
                  aria-hidden
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
              )}
            </span>
            <span
              className={cn(
                "mt-2 block text-2xl font-semibold tabular-nums",
                STATUS_COLORS[key],
              )}
            >
              {groups[key].length.toLocaleString()}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {formatOrderUsd(
                groups[key].reduce((sum, o) => sum + getOrderValueUsd(o), 0),
              )}{" "}
              placed
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Values are the original order sizes reported by the services, not the
        amounts actually traded. Select a status to see its orders.
      </p>
      {openStatus && (
        <StatusOrdersModal
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            lastTrigger.current?.focus();
          }}
          open
          onOpenChange={(open) => {
            if (!open) setOpenStatus(null);
          }}
          partnerName="All trading apps in this view"
          orders={groups[openStatus]}
          title={OVERVIEW_STATUSES[openStatus].label}
          variant={openStatus}
        />
      )}
    </section>
  );
}
