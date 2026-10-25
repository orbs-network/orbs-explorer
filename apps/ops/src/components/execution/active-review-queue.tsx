"use client";
import type { ListOrder } from "@orbs/domain/twap/types";
import { useMemo } from "react";
import { ContinuousTable } from "@/components/operations/continuous-table";
import { useOperationsData } from "@/components/operations/operations-view";
import {
  OrderIdentityCell,
  OrderRowNetwork,
  OrderRowProgress,
} from "@/components/investigation/order-row-parts";
import {
  orderListMessage,
  orderReasonSummary,
} from "@/components/investigation/order-presentation";
import { formatOrderDate } from "@/components/orders-overview/overview-display";
import { deadlineTime } from "@/lib/execution-analytics";
import { orderIdentity } from "@/lib/order-selection";
import { hasLastExecutionError } from "@/lib/order-diagnostics";

export function ActiveReviewQueue({ orders }: { orders: ListOrder[] }) {
  const { partnerCards, scope, updatedAt } = useOperationsData();
  const names = useMemo(
    () =>
      new Map(
        partnerCards.flatMap((app) =>
          app.chains.flatMap((chain) =>
            chain.orders.map((order) => [order, app.partnerName] as const),
          ),
        ),
      ),
    [partnerCards],
  );
  const duration = (milliseconds: number) => {
    const days = Math.ceil(milliseconds / 86400000),
      hours = Math.ceil(milliseconds / 3600000);
    return days > 1
      ? `${days} days`
      : `${hours} ${hours === 1 ? "hour" : "hours"}`;
  };
  return (
    <ContinuousTable
      label="Active orders to review"
      items={orders}
      itemKey={orderIdentity}
      minWidth={960}
      header={
        <tr>
          <th scope="col">Order · trading app</th>
          <th scope="col">Network</th>
          <th scope="col">Review reason</th>
          <th scope="col" className="text-right">
            Trade progress
          </th>
          <th scope="col">Deadline</th>
        </tr>
      }
      rowContent={(order) => {
        const deadline = deadlineTime(order);
        return (
          <>
            <td>
              <OrderIdentityCell
                order={order}
                partner={names.get(order)}
                scope={scope}
              />
            </td>
            <td>
              <OrderRowNetwork order={order} />
            </td>
            <td className="min-w-60 max-w-80 text-xs">
              {hasLastExecutionError(order) && (
                <p className="font-medium text-destructive">
                  Latest attempt failed
                </p>
              )}
              {deadline !== undefined && deadline <= updatedAt && (
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  Past deadline · still reported active
                </p>
              )}
              {deadline === undefined && (
                <p className="font-medium">Deadline unreported</p>
              )}
              <p className="mt-1 text-muted-foreground">
                {orderReasonSummary(
                  order.metadata.chunkSummary?.lastChunkDescription ||
                    order.metadata.description ||
                    "No additional reason reported",
                )}
              </p>
            </td>
            <td className="text-right">
              <OrderRowProgress order={order} />
            </td>
            <td
              className="whitespace-nowrap text-xs"
              title={`${formatOrderDate(deadline)} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}
            >
              {deadline === undefined
                ? "Not reported"
                : deadline <= updatedAt
                  ? `${duration(updatedAt - deadline)} past deadline`
                  : `${duration(deadline - updatedAt)} remaining`}
            </td>
          </>
        );
      }}
    />
  );
}
