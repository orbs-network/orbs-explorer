"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { ListOrder } from "@orbs/domain/twap/types";
import { buildOrderDiagnostics } from "@/lib/order-diagnostics";
import {
  formatOrderDate,
  formatOrderUsd,
  formatShare,
} from "./overview-display";
import { StatusOrdersModal } from "./status-order-modal";
import { CardDisclosure } from "./card-disclosure";

export function OrderDiagnostics({
  orders,
  snapshot,
  scope,
  headingLevel = 4,
}: {
  orders: ListOrder[];
  snapshot: number;
  scope: string;
  headingLevel?: 3 | 4;
}) {
  const data = useMemo(
    () => buildOrderDiagnostics(orders, snapshot),
    [orders, snapshot],
  );
  const Heading = headingLevel === 3 ? "h3" : "h4";
  const trigger = useRef<HTMLButtonElement>(null);
  const [selection, setSelection] = useState<{
    title: string;
    orders: ListOrder[];
  } | null>(null);
  if (!orders.length) return null;
  const open = (
    event: React.MouseEvent<HTMLButtonElement>,
    title: string,
    selected: ListOrder[],
  ) => {
    trigger.current = event.currentTarget;
    setSelection({ title, orders: selected });
  };
  const errorMetrics = [
    {
      label: "Orders with errors",
      share: formatShare(data.withErrors.length, orders.length),
      orders: data.withErrors,
      title: "With execution errors",
    },
    {
      label: "Active with error history",
      orders: data.activeWithErrors,
      title: "Active with error history",
    },
  ];
  const chunks = [
    {
      label: "Successful",
      value: data.successfulCoverage
        ? data.successfulChunks.toLocaleString()
        : "—",
      coverage: data.successfulCoverage,
    },
    {
      label: "Failed",
      value: data.errorCoverage ? data.errorChunks.toLocaleString() : "—",
      coverage: data.errorCoverage,
    },
    {
      label: "Planned",
      value: data.expectedCoverage ? data.expectedChunks.toLocaleString() : "—",
      coverage: data.expectedCoverage,
    },
  ];
  const sameCoverage = chunks.every(
    (chunk) => chunk.coverage === chunks[0].coverage,
  );
  const failureOrders = data.reasons.reduce(
    (sum, reason) => sum + reason.orders.length,
    0,
  );
  return (
    <section aria-label={`Execution diagnostics for ${scope}`}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Heading className="text-xs font-medium">Execution</Heading>
        <p
          className="text-[10px] text-muted-foreground"
          title="Orders placed in the last 24 hours within the current filters"
        >
          Placed in 24h{" "}
          <strong className="ml-1 font-medium tabular-nums text-foreground">
            {data.recentOrders.toLocaleString()}
          </strong>
        </p>
      </div>
      <div>
        {errorMetrics.map((metric) => {
          const content = (
            <>
              <span className="text-muted-foreground">{metric.label}</span>
              <span className="inline-flex shrink-0 items-center gap-2 tabular-nums">
                {metric.share && (
                  <span className="text-[10px] text-muted-foreground">
                    {metric.share}
                  </span>
                )}
                <strong
                  className={
                    metric.orders.length
                      ? "font-semibold text-amber-700 dark:text-amber-400"
                      : "font-medium text-muted-foreground"
                  }
                >
                  {metric.orders.length.toLocaleString()}
                </strong>
                {metric.orders.length > 0 && (
                  <ChevronRight
                    aria-hidden
                    className="size-3 text-muted-foreground"
                  />
                )}
              </span>
            </>
          );
          const row =
            "flex min-h-10 w-full items-center justify-between gap-3 rounded-[4px] px-1 text-left text-xs";
          return metric.orders.length ? (
            <button
              key={metric.label}
              type="button"
              onClick={(event) => open(event, metric.title, metric.orders)}
              aria-label={`View ${metric.orders.length} ${metric.label.toLowerCase()} for ${scope}`}
              className={`${row} transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none`}
            >
              {content}
            </button>
          ) : (
            <div key={metric.label} className={row}>
              {content}
            </div>
          );
        })}
      </div>
      <div className="mb-2 border-t border-border/60 pt-3">
        <p className="mb-2 text-[10px] text-muted-foreground">
          Reported chunks
        </p>
        <dl className="grid grid-cols-3 divide-x divide-border/60">
          {chunks.map((chunk) => (
            <div
              key={chunk.label}
              className="min-w-0 px-3 first:pl-0 last:pr-0"
            >
              <dt className="text-[11px] text-muted-foreground">
                {chunk.label}
              </dt>
              <dd className="mt-1 font-mono text-lg font-medium leading-tight tabular-nums">
                {chunk.value}
              </dd>
              {!sameCoverage && (
                <dd className="mt-1 text-[10px] text-muted-foreground">
                  {chunk.coverage}/{orders.length} reported
                </dd>
              )}
            </div>
          ))}
        </dl>
        {sameCoverage && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Reported for {chunks[0].coverage.toLocaleString()} of{" "}
            {orders.length.toLocaleString()} orders
          </p>
        )}
      </div>
      <CardDisclosure label="Order mix, timing & value">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
          {[
            [
              "Average placed value",
              data.averageValue === undefined
                ? "—"
                : formatOrderUsd(data.averageValue),
            ],
            [
              "Largest placed value",
              data.largestValue === undefined
                ? "—"
                : formatOrderUsd(data.largestValue),
            ],
            [
              "Orders reporting USD value",
              `${data.pricedOrders}/${orders.length}`,
            ],
            [
              "Last attempt reported error",
              data.lastErrors.length.toLocaleString(),
            ],
            ["Active expiring within 24h", data.expiring.toLocaleString()],
            ["Active past reported deadline", data.overdue.toLocaleString()],
            ["First order in view", formatOrderDate(data.firstPlaced)],
            ["Latest order in view", formatOrderDate(data.lastPlaced)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 border-t border-border pt-3 text-xs">
          <p className="mb-2 text-muted-foreground">
            Order types · orders · placed value
          </p>
          {data.types.map((type) => (
            <button
              key={type.label}
              type="button"
              onClick={(event) => open(event, type.label, type.orders)}
              className="flex min-h-9 w-full items-center justify-between gap-3 rounded-[4px] px-1 py-1.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 break-words">{type.label}</span>
              <span className="shrink-0 tabular-nums">
                {type.orders.length} · {formatOrderUsd(type.value)}
              </span>
            </button>
          ))}
        </div>
      </CardDisclosure>
      {data.reasons.length ? (
        <CardDisclosure
          label="Latest failure reasons"
          detail={`${failureOrders.toLocaleString()} ${failureOrders === 1 ? "order" : "orders"}`}
        >
          <p className="mt-2 text-xs text-muted-foreground">
            Latest failed attempt or terminal failure reported by the service.
            Check individual order details for any returned execution history.
          </p>
          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto overscroll-contain">
            {data.reasons.map((reason) => (
              <button
                key={reason.reason}
                type="button"
                onClick={(event) =>
                  open(event, "Matching failure reason", reason.orders)
                }
                className="block w-full rounded-[6px] bg-muted/15 p-2 text-left text-xs hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block whitespace-pre-wrap break-words text-destructive">
                  {reason.reason}
                </span>
                <span className="mt-1 block text-muted-foreground">
                  {reason.orders.length} orders · latest order{" "}
                  {formatOrderDate(reason.latest)}
                </span>
              </button>
            ))}
          </div>
        </CardDisclosure>
      ) : (
        <div className="flex min-h-10 items-center justify-between gap-3 border-t border-border/60 text-xs">
          <span className="text-muted-foreground">Failure reasons</span>
          <span className="text-[10px] text-muted-foreground">
            None reported
          </span>
        </div>
      )}
      {selection && (
        <StatusOrdersModal
          open
          onOpenChange={(open) => {
            if (!open) setSelection(null);
          }}
          title={selection.title}
          partnerName={scope}
          orders={selection.orders}
          description="Matching orders from the current view. Each row shows its current service status."
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        />
      )}
    </section>
  );
}
