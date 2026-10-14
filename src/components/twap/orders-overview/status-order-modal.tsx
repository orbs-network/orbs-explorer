"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ListOrder } from "@/lib/twap/types";
import { getTwapOrderChainId } from "@/lib/twap/utils";
import {
  getOrderValueUsd,
  OVERVIEW_STATUSES,
  type OverviewOrderStatus,
} from "@/lib/twap/utils/orders-overview";
import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { Virtuoso } from "react-virtuoso";
import { OrderTokenLabel } from "./order-token-label";
import { formatOrderUsd } from "./overview-display";
import { shortenAddress } from "@/lib/utils/utils";

function formatDate(value: string | number): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && Number(date) > 0
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
    : "Not provided";
}
function filterOrders(orders: ListOrder[], query: string): ListOrder[] {
  const q = query.trim().toLowerCase();
  if (!q) return orders;
  return orders.filter((order) =>
    [
      order.hash,
      order.inputToken,
      order.outputToken,
      order.metadata.srcToken?.symbol,
      order.metadata.dstToken?.symbol,
      order.metadata.displayOnlyStatusDescription,
      order.metadata.description,
      order.totalUSDAmount,
      formatDate(order.timestamp),
      order.metadata.orderType,
    ].some((value) => value?.toLowerCase().includes(q)),
  );
}
export type StatusOrdersModalVariant = OverviewOrderStatus;
const borderColors: Record<OverviewOrderStatus, string> = {
  completed: "border-l-emerald-500/60",
  partial: "border-l-amber-500/60",
  active: "border-l-sky-500/60",
  cancelled: "border-l-muted-foreground/40",
  expired: "border-l-muted-foreground/40",
  failed: "border-l-destructive/60",
  unknown: "border-l-muted-foreground/40",
};

function OrderRow({
  order,
  variant,
}: {
  order: ListOrder;
  variant: OverviewOrderStatus;
}) {
  const chainId = getTwapOrderChainId(order);
  const summary = order.metadata.chunkSummary;
  const deadline = Number(order.order.witness.deadline) * 1000;
  return (
    <Link
      href={`${ROUTES.TWAP.ORDER(order.hash)}?order_source=${order.source ?? "v1"}`}
      className={`block min-w-0 rounded-lg border border-border border-l-4 bg-muted/20 p-3 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${borderColors[variant]}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 font-medium">
          <OrderTokenLabel
            address={order.inputToken}
            chainId={chainId}
            token={order.metadata.srcToken}
          />
          <ArrowRight
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          <OrderTokenLabel
            address={order.outputToken}
            chainId={chainId}
            token={order.metadata.dstToken}
          />
        </span>
        <span className="shrink-0 tabular-nums">
          {formatOrderUsd(getOrderValueUsd(order))}{" "}
          <span className="text-xs text-muted-foreground">placed</span>
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {order.metadata.orderType || "Order"}
        {summary && order.metadata.expectedChunks > 0
          ? ` · ${summary.success} of ${order.metadata.expectedChunks} trades completed`
          : ""}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Placed {formatDate(order.timestamp)} · Expires {formatDate(deadline)}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-mono text-muted-foreground">
          {shortenAddress(order.hash)}
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-link">
          View order
          <ArrowRight aria-hidden className="size-3" />
        </span>
      </div>
    </Link>
  );
}

export function StatusOrdersModal({
  open,
  onOpenChange,
  partnerName,
  orders,
  title,
  variant,
  emptyMessage = "No orders in this view.",
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerName: string;
  orders: ListOrder[];
  title: string;
  variant: OverviewOrderStatus;
  emptyMessage?: string;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const [query, setQuery] = useState("");
  const sorted = useMemo(
    () =>
      [...orders].sort(
        (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
      ),
    [orders],
  );
  const filtered = useMemo(() => filterOrders(sorted, query), [sorted, query]);
  const totalUsd = filtered.reduce(
    (sum, order) => sum + getOrderValueUsd(order),
    0,
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        className="flex h-[85dvh] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0 pr-6 text-left">
          <DialogTitle>{title} orders</DialogTitle>
          <DialogDescription>
            {partnerName}. {OVERVIEW_STATUSES[variant].description}
          </DialogDescription>
        </DialogHeader>
        <div className="relative mt-4 shrink-0">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label={`Search ${title.toLowerCase()} orders`}
            autoComplete="off"
            spellCheck={false}
            placeholder="Search order ID, token address, type, or date…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <p
          role="status"
          className="mt-2 shrink-0 text-xs text-muted-foreground"
        >
          {filtered.length.toLocaleString()} of {sorted.length.toLocaleString()}{" "}
          orders · {formatOrderUsd(totalUsd)} placed value · newest first
        </p>
        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          {filtered.length ? (
            <Virtuoso
              style={{ height: "100%" }}
              className="overscroll-contain"
              data={filtered}
              computeItemKey={(_, order) =>
                `${getTwapOrderChainId(order)}:${order.hash}`
              }
              overscan={100}
              itemContent={(_, order) => (
                <div className="pb-2 pr-1">
                  <OrderRow order={order} variant={variant} />
                </div>
              )}
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {sorted.length
                ? "No orders match this search. Try another order ID, token address, or date."
                : emptyMessage}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
