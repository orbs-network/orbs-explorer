"use client";

import { TableRow, TableHead, TableCell } from "@orbs/ui/controls/table";

import { Button } from "@orbs/ui/controls/button";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ListOrder } from "@orbs/domain/twap/types";
import {
  orderDetailHref,
  type InvestigationSort,
} from "@/lib/order-investigation";
import { orderIdentity } from "@/lib/order-selection";
import { reportedNumber } from "@/lib/order-diagnostics";
import { useOperationsData } from "@/components/operations/operations-view";
import { useOrderNavigationScope } from "@/hooks/use-order-navigation-scope";
import { VirtualTable } from "@/components/operations/virtual-table";
import { formatOrderUsd } from "@/components/orders-overview/overview-display";
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

const COLUMN_WIDTHS = [
  "17%",
  "13%",
  "12%",
  "8%",
  "13%",
  "10%",
  "12%",
  "9%",
  "6%",
];

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
  const { updatedAt } = useOperationsData();
  const scope = useOrderNavigationScope();
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
      <TableHead
        scope="col"
        className="text-left"
        aria-sort={
          active ? (ascendingActive ? "ascending" : "descending") : undefined
        }
      >
        {onSort ? (
          <Button
            variant="ghost"
            size="content"
            type="button"
            onClick={() => onSort(next)}
            aria-label={`${label}, sort ${next === ascending ? "ascending" : "descending"}`}
            className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {label}
            <Icon aria-hidden className="size-3" />
          </Button>
        ) : (
          label
        )}
      </TableHead>
    );
  }
  return (
    <div className="rounded-xl bg-card">
      <VirtualTable
        label="Order investigation results"
        items={orders}
        itemKey={orderIdentity}
        rowHref={(order) => orderDetailHref(order.hash, order.source, scope)}
        minWidth={1180}
        columnCount={9}
        columnWidths={COLUMN_WIDTHS}
        contextKey={`${scope.partnerId ?? "global"}:${scope.query}:${sort}`}
        header={
          <TableRow>
            <TableHead scope="col">
              Order{showApp ? " · trading app" : ""}
            </TableHead>
            <TableHead scope="col">Current outcome</TableHead>
            <TableHead scope="col">Network</TableHead>
            <TableHead scope="col">Order type</TableHead>
            {sortHeader("Placed value (USD)", "value-desc", "value-asc")}
            <TableHead scope="col" className="text-left">
              Trade progress
            </TableHead>
            {sortHeader("Execution errors", "errors-desc", "errors-asc")}
            <TableHead scope="col">Deadline</TableHead>
            {sortHeader("Placed", "newest", "oldest")}
          </TableRow>
        }
        rowContent={(order) => {
          const href = orderDetailHref(order.hash, order.source, scope);
          const usd = reportedNumber(order.totalUSDAmount);
          return (
            <>
              <TableCell>
                <OrderIdentityCell
                  order={order}
                  partner={showApp ? partners.get(order) : undefined}
                  scope={scope}
                />
              </TableCell>
              <TableCell className="min-w-56 max-w-72 whitespace-normal">
                <OrderRowStatus order={order} href={href} compact />
              </TableCell>
              <TableCell>
                <OrderRowNetwork order={order} />
              </TableCell>
              <TableCell className="text-xs" title={order.metadata.orderType}>
                {compactOrderType(order.metadata.orderType)}
              </TableCell>
              <TableCell
                className="text-left"
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
              </TableCell>
              <TableCell className="text-left">
                <OrderRowProgress order={order} />
              </TableCell>
              <TableCell className="text-left">
                <OrderRowErrors order={order} />
              </TableCell>
              <TableCell>
                <OrderRowDeadline order={order} now={updatedAt} />
              </TableCell>
              <TableCell className="text-left">
                <OrderRowTime order={order} now={updatedAt} />
              </TableCell>
            </>
          );
        }}
      />
    </div>
  );
}
