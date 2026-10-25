"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@orbs/ui/controls/dialog";
import { Input } from "@orbs/ui/controls/input";
import type { ListOrder } from "@orbs/domain/twap/types";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import {
  getOrderValueUsd,
  getOverviewOrderStatus,
  OVERVIEW_STATUSES,
  type OverviewOrderStatus,
} from "@orbs/domain/twap/utils/orders-overview";
import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import {
  orderDetailHref,
  type OrderNavigationScope,
} from "@/lib/order-investigation";
import { useOrderNavigationScope } from "@/hooks/use-order-navigation-scope";
import { Virtuoso } from "react-virtuoso";
import { formatOrderDate, formatOrderUsd } from "./overview-display";
import { getChain, shortenAddress } from "@orbs/domain/utils/utils";
import { ExportOrders } from "./export-orders";
import { Copy } from "@orbs/ui/controls/copy";
import { reportedNumber } from "@/lib/order-diagnostics";
import {
  OrderRowPair,
  OrderRowStatus,
  OrderRowNetwork,
  OrderRowProgress,
  OrderRowErrors,
} from "@/components/investigation/order-row-parts";
import { compactOrderType } from "@/components/investigation/order-presentation";
import { deadlineTime } from "@/lib/execution-analytics";
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
      order.metadata.status,
      order.metadata.displayOnlyStatus,
      order.metadata.chunkSummary?.lastChunkDescription,
      order.metadata.chunkSummary?.lastChunkStatus,
      order.exchangeAdapter,
      order.source,
      String(getTwapOrderChainId(order)),
      getChain(getTwapOrderChainId(order))?.name,
      order.totalUSDAmount,
      formatOrderDate(order.timestamp),
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
  navigationScope,
  expanded = false,
}: {
  order: ListOrder;
  navigationScope: OrderNavigationScope;
  expanded?: boolean;
}) {
  const variant = getOverviewOrderStatus(order);
  const href = orderDetailHref(order.hash, order.source, navigationScope);
  return (
    <article
      className={`min-w-0 rounded-lg bg-muted/40 border-l-4 bg-muted/20 p-3 text-xs ${borderColors[variant]}`}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <OrderRowPair order={order} />
        <span
          className="shrink-0 tabular-nums"
          title="Reported placed value, not executed value"
        >
          {reportedNumber(order.totalUSDAmount) === undefined
            ? "USD unreported"
            : `${formatOrderUsd(getOrderValueUsd(order))} placed`}
        </span>
      </div>
      <div className="mt-2 min-w-0">
        <OrderRowStatus
          order={order}
          href={href}
          compact
          reasonDisplay={expanded ? "full" : "truncate"}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <OrderRowNetwork order={order} />
        <span title={order.metadata.orderType}>
          {compactOrderType(order.metadata.orderType)}
        </span>
        <OrderRowProgress order={order} />
        <OrderRowErrors order={order} />
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        Placed {formatOrderDate(order.timestamp)}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
        <Copy text={shortenAddress(order.hash)} value={order.hash} />
        <Link
          href={href}
          prefetch={false}
          className="inline-flex min-h-8 items-center gap-1 rounded font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open order details
          <ArrowRight aria-hidden className="size-3" />
        </Link>
      </div>
    </article>
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
  description,
  navigationScope,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerName: string;
  orders: ListOrder[];
  title: string;
  variant?: OverviewOrderStatus;
  description?: string;
  emptyMessage?: string;
  onCloseAutoFocus?: (event: Event) => void;
  navigationScope?: OrderNavigationScope;
}) {
  const locationScope = useOrderNavigationScope();
  const singleOrder = orders.length === 1;
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
        className={`flex w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden sm:max-w-2xl ${singleOrder ? "max-h-[85dvh]" : "h-[85dvh]"}`}
      >
        <DialogHeader className="shrink-0 pr-6 text-left">
          <DialogTitle>
            {singleOrder ? "Order quick view" : `${title} orders`}
          </DialogTitle>
          <DialogDescription>
            {singleOrder ? (
              "Open the order page for execution history, technical details, logs and payload."
            ) : (
              <>
                {partnerName}.{" "}
                {description ??
                  (variant
                    ? OVERVIEW_STATUSES[variant].description
                    : "Orders in the current view.")}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {!singleOrder && (
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
              placeholder="Search ID, token, error, status, network, or date…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
            />
          </div>
        )}
        {!singleOrder && (
          <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <p
              role="status"
              className="mt-2 shrink-0 text-xs text-muted-foreground"
            >
              {filtered.length.toLocaleString()} of{" "}
              {sorted.length.toLocaleString()} orders ·{" "}
              {formatOrderUsd(totalUsd)} placed value · newest first
            </p>
            <ExportOrders orders={filtered} />
          </div>
        )}
        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto">
          {singleOrder ? (
            <OrderRow
              order={orders[0]}
              navigationScope={navigationScope ?? locationScope}
              expanded
            />
          ) : filtered.length ? (
            <Virtuoso
              style={{ height: "100%" }}
              className="overscroll-contain"
              data={filtered}
              computeItemKey={(_, order) =>
                `${getTwapOrderChainId(order)}:${order.hash}:${order.source}`
              }
              overscan={100}
              itemContent={(_, order) => (
                <div className="pb-2 pr-1">
                  <OrderRow
                    order={order}
                    navigationScope={navigationScope ?? locationScope}
                  />
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
