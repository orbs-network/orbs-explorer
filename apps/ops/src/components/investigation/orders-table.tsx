"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ListOrder } from "@orbs/domain/twap/types";
import {
  orderDetailHref,
  type InvestigationSort,
} from "@/lib/order-investigation";
import { orderIdentity } from "@/lib/order-selection";
import { reportedNumber } from "@/lib/order-diagnostics";
import { useOperationsData } from "@/components/operations/operations-view";
import { ContinuousTable } from "@/components/operations/continuous-table";
import { formatOrderUsd } from "@/components/orders-overview/overview-display";
import { InfoHint } from "@/components/info-hint";
import { compactOrderType } from "./order-presentation";
import {
  OrderIdentityCell,
  OrderRowErrors,
  OrderRowDeadline,
  OrderRowNetwork,
  OrderRowProgress,
  OrderRowStatus,
  OrderRowTime,
} from "./order-row-parts";

export function OrdersTable({
  orders,
  partners,
  showApp = true,
  sort = "newest",
  onSort,
}: {
  orders: ListOrder[];
  partners: Map<ListOrder, string>;
  showApp?: boolean;
  sort?: InvestigationSort;
  onSort?: (sort: InvestigationSort) => void;
}) {
  const { scope, updatedAt } = useOperationsData();
  function sortHeader(
    label: string,
    descending: InvestigationSort,
    ascending: InvestigationSort,
  ) {
    const active = sort === descending || sort === ascending;
    const ascendingActive = sort === ascending;
    const next = active && !ascendingActive ? ascending : descending;
    const Icon = active ? (ascendingActive ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th
        scope="col"
        className="text-right"
        aria-sort={
          active ? (ascendingActive ? "ascending" : "descending") : undefined
        }
      >
        {onSort ? (
          <button
            type="button"
            onClick={() => onSort(next)}
            aria-label={`${label}, sort ${next === ascending ? "ascending" : "descending"}`}
            className="inline-flex min-h-9 items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {label}
            <Icon aria-hidden className="size-3" />
          </button>
        ) : (
          label
        )}
      </th>
    );
  }
  return (
    <div className="rounded-xl bg-card p-3">
      <ContinuousTable
        label="Order investigation results"
        items={orders}
        itemKey={orderIdentity}
        minWidth={1280}
        header={
          <tr>
            <th scope="col">Order{showApp ? " · trading app" : ""}</th>
            <th scope="col">Current outcome</th>
            <th scope="col">Network</th>
            <th scope="col">
              Order type{" "}
              <InfoHint>
                TWAP (time-weighted average price) splits an order into planned
                trades. Stop loss and take profit describe its trading
                condition.
              </InfoHint>
            </th>
            {sortHeader("Placed value (USD)", "value-desc", "value-asc")}
            <th scope="col" className="text-right">
              Trade progress{" "}
              <InfoHint>
                Successful executions out of planned trades. This count does not
                measure the value filled.
              </InfoHint>
            </th>
            {sortHeader("Execution errors", "errors-desc", "errors-asc")}
            <th scope="col">Deadline</th>
            {sortHeader("Placed", "newest", "oldest")}
          </tr>
        }
        rowContent={(order) => {
          const href = orderDetailHref(order.hash, order.source, scope);
          const usd = reportedNumber(order.totalUSDAmount);
          return (
            <>
              <td>
                <OrderIdentityCell
                  order={order}
                  partner={showApp ? partners.get(order) : undefined}
                  scope={scope}
                />
              </td>
              <td className="min-w-64 max-w-80">
                <OrderRowStatus order={order} href={href} compact />
              </td>
              <td>
                <OrderRowNetwork order={order} />
              </td>
              <td className="text-xs" title={order.metadata.orderType}>
                {compactOrderType(order.metadata.orderType)}
              </td>
              <td
                className="text-right"
                title={
                  usd === undefined
                    ? "Placed value unavailable"
                    : new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 2,
                      }).format(usd)
                }
              >
                {usd === undefined ? "—" : formatOrderUsd(usd)}
              </td>
              <td className="text-right">
                <OrderRowProgress order={order} />
              </td>
              <td className="text-right">
                <OrderRowErrors order={order} />
              </td>
              <td>
                <OrderRowDeadline order={order} now={updatedAt} />
              </td>
              <td>
                <OrderRowTime order={order} now={updatedAt} />
              </td>
            </>
          );
        }}
      />
    </div>
  );
}
