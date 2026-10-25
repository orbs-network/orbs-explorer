"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Virtuoso } from "react-virtuoso";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye } from "lucide-react";
import type { ListOrder } from "@orbs/domain/twap/types";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import { Button } from "@orbs/ui/controls/button";
import {
  orderDetailHref,
  type InvestigationSort,
} from "@/lib/order-investigation";
import { reportedNumber } from "@/lib/order-diagnostics";
import { useOperationsData } from "@/components/operations/operations-view";
import { ContinuousTable } from "@/components/operations/continuous-table";
import { formatOrderUsd } from "@/components/orders-overview/overview-display";
import { compactOrderType } from "./order-presentation";
import {
  OrderRawDetails,
  OrderRowErrors,
  OrderRowNetwork,
  OrderRowPair,
  OrderRowProgress,
  OrderRowStatus,
  OrderRowTime,
} from "./order-row-parts";

const mobileQuery = "(max-width: 1023px)";
const columnWidths = ["21%", "26%", "11%", "8%", "10%", "6%", "7%", "6%", "5%"];
const subscribeMobile = (notify: () => void) => {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const serverSnapshot = () => false;
const orderKey = (order: ListOrder) =>
  `${getTwapOrderChainId(order)}:${order.hash}:${order.source}`;

function RowDetailLink({
  order,
  href,
  quickView,
}: {
  order: ListOrder;
  href: string;
  quickView: () => void;
}) {
  return (
    <Link
      href={href}
      aria-label={`Open order ${order.hash}`}
      aria-keyshortcuts="Space"
      title="Open order details · Space for quick view"
      className="absolute inset-0 z-10 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      onKeyDown={(event) => {
        if (
          event.key === " " &&
          !event.repeat &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey
        ) {
          event.preventDefault();
          quickView();
        }
      }}
    >
      <span className="sr-only">Open order {order.hash}</span>
    </Link>
  );
}

function QuickView({ onClick, hash }: { onClick: () => void; hash: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-label={`Quick view order ${hash}`}
      title="Quick view"
      className="relative z-20 size-8 p-0 text-muted-foreground"
    >
      <Eye aria-hidden className="size-3.5" />
    </Button>
  );
}

function OrderCard({
  order,
  partner,
  showApp = true,
  now,
  resolveMetadata = true,
  children,
}: {
  order: ListOrder;
  partner?: string;
  showApp?: boolean;
  now: number;
  resolveMetadata?: boolean;
  children?: ReactNode;
}) {
  const { inspectOrders, scope } = useOperationsData();
  const href = orderDetailHref(order.hash, order.source, scope);
  const quickView = () => inspectOrders("Order inspection", [order]);
  const usd = reportedNumber(order.totalUSDAmount);
  return (
    <article
      aria-label={`Order ${order.hash}`}
      className="group/row relative mb-2 min-w-0 rounded-lg bg-card p-3 focus-within:ring-2 focus-within:ring-ring"
    >
      <RowDetailLink order={order} href={href} quickView={quickView} />
      <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
        <OrderRowPair order={order} resolveMetadata={resolveMetadata} />
        <QuickView hash={order.hash} onClick={quickView} />
      </div>
      <div className="mt-1.5 min-w-0">
        <OrderRowStatus order={order} href={href} compact />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="min-w-0 truncate">
          {showApp && (partner || "Unidentified app")}
        </span>
        <OrderRowNetwork order={order} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="whitespace-nowrap" title={order.metadata.orderType}>
          {compactOrderType(order.metadata.orderType)}
        </span>
        <span className="tabular-nums">
          {usd === undefined ? "USD unreported" : formatOrderUsd(usd)}
        </span>
        <span className="inline-flex items-center gap-2">
          <OrderRowProgress order={order} />
          <OrderRowErrors order={order} />
        </span>
        <Link href={href} tabIndex={-1} className="relative z-20">
          <OrderRowTime order={order} now={now} />
        </Link>
      </div>
      {children && (
        <div className="mt-3 border-t border-border pt-3">{children}</div>
      )}
    </article>
  );
}

export function OrdersTable({
  orders,
  partners,
  showApp = true,
  showRawFields = false,
  sort = "newest",
  onSort,
}: {
  orders: ListOrder[];
  partners: Map<ListOrder, string>;
  /** Off where every order belongs to one app, such as a partner page. */
  showApp?: boolean;
  showRawFields?: boolean;
  sort?: InvestigationSort;
  onSort?: (sort: InvestigationSort) => void;
}) {
  const { inspectOrders, scope, updatedAt } = useOperationsData();
  const mobile = useSyncExternalStore(
    subscribeMobile,
    mobileSnapshot,
    serverSnapshot,
  );
  const [clock, setClock] = useState(0);
  useEffect(() => {
    const update = () => {
      if (document.visibilityState !== "hidden") setClock(Date.now());
    };
    const frame = window.requestAnimationFrame(update);
    const timer = window.setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const now = Math.max(updatedAt || 0, clock);

  function sortHeader(
    label: string,
    descending: InvestigationSort,
    ascending: InvestigationSort,
    numeric = false,
  ) {
    const active = sort === descending || sort === ascending;
    const ascendingActive = sort === ascending;
    const next = active && !ascendingActive ? ascending : descending;
    const Icon = active ? (ascendingActive ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th
        scope="col"
        className={numeric ? "text-right" : undefined}
        aria-sort={
          active ? (ascendingActive ? "ascending" : "descending") : undefined
        }
      >
        {onSort ? (
          <button
            type="button"
            onClick={() => onSort(next)}
            aria-label={`${label}, sort ${next === ascending ? "ascending" : "descending"}`}
            className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-sm text-left whitespace-normal hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {label}
            <Icon aria-hidden className="size-3 shrink-0" />
          </button>
        ) : (
          label
        )}
      </th>
    );
  }

  if (mobile || showRawFields)
    return (
      <div role="region" aria-label="Order investigation results">
        <Virtuoso
          useWindowScroll
          data={orders}
          computeItemKey={(_index, order) => orderKey(order)}
          overscan={300}
          itemContent={(_index, order) => (
            <OrderCard
              order={order}
              partner={partners.get(order)}
              showApp={showApp}
              now={now}
              resolveMetadata={!showRawFields}
            >
              {showRawFields && <OrderRawDetails order={order} />}
            </OrderCard>
          )}
        />
      </div>
    );
  return (
    <div className="rounded-xl bg-card px-2 [&_table_td]:px-2 [&_table_th]:px-2 [&_table_td]:py-2.5 [&_table_th]:py-2.5 [&_thead_th]:whitespace-normal">
      <ContinuousTable
        label="Order investigation results"
        items={orders}
        itemKey={orderKey}
        minWidth={0}
        columnWidths={columnWidths}
        header={
          <tr>
            <th scope="col">{showApp ? "Pair · trading app" : "Pair"}</th>
            <th scope="col">Status · latest reason</th>
            <th scope="col">Network</th>
            <th scope="col">Type</th>
            {sortHeader("Value", "value-desc", "value-asc", true)}
            <th scope="col" className="text-right">
              Chunks
            </th>
            {sortHeader("Errors", "errors-desc", "errors-asc", true)}
            {sortHeader("Placed", "newest", "oldest")}
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        }
        rowContent={(order) => {
          const href = orderDetailHref(order.hash, order.source, scope);
          const quickView = () => inspectOrders("Order inspection", [order]);
          const usd = reportedNumber(order.totalUSDAmount);
          return (
            <>
              <td className="min-w-0">
                <RowDetailLink
                  order={order}
                  href={href}
                  quickView={quickView}
                />
                <div className="flex min-w-0 flex-col items-start gap-1">
                  <OrderRowPair
                    order={order}
                    resolveMetadata={!showRawFields}
                  />
                  {showApp && (
                    <span
                      className="max-w-full truncate text-[11px] text-muted-foreground"
                      title={partners.get(order) || order.exchangeAdapter}
                    >
                      {partners.get(order) || "Unidentified app"}
                    </span>
                  )}
                </div>
              </td>
              <td className="min-w-0">
                <OrderRowStatus order={order} href={href} compact />
              </td>
              <td className="min-w-0">
                <OrderRowNetwork order={order} />
              </td>
              <td
                className="break-words text-[11px]"
                title={order.metadata.orderType || "Type unreported"}
              >
                {compactOrderType(order.metadata.orderType)}
              </td>
              <td className="whitespace-nowrap text-right text-xs tabular-nums">
                {usd === undefined ? "—" : formatOrderUsd(usd)}
              </td>
              <td className="text-right">
                <OrderRowProgress order={order} />
              </td>
              <td className="text-right">
                <OrderRowErrors order={order} />
              </td>
              <td>
                <Link href={href} tabIndex={-1} className="relative z-20">
                  <OrderRowTime order={order} now={now} />
                </Link>
              </td>
              <td>
                <QuickView hash={order.hash} onClick={quickView} />
              </td>
            </>
          );
        }}
      />
    </div>
  );
}
