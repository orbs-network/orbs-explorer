"use client";

import Link from "next/link";
import { Network } from "@orbs/ui/controls/network";
import type { ListOrder } from "@orbs/domain/twap/types";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import { ContinuousTable } from "@/components/operations/continuous-table";
import { useOperationsData } from "@/components/operations/operations-view";
import { formatOrderDate } from "@/components/orders-overview/overview-display";
import { deadlineTime, placementTime } from "@/lib/execution-analytics";
import { orderDetailHref } from "@/lib/order-investigation";
import {
  hasExecutionErrors,
  hasLastExecutionError,
  reportedNumber,
} from "@/lib/order-diagnostics";
import { formatDuration, inspectClass } from "./execution-ui";

function ReviewSignals({
  order,
  snapshot,
}: {
  order: ListOrder;
  snapshot: number;
}) {
  const deadline = deadlineTime(order);
  const placed = placementTime(order);
  const flags = [
    deadline !== undefined && deadline <= snapshot
      ? { label: "Past deadline", urgent: true }
      : deadline !== undefined && deadline <= snapshot + 3_600_000
        ? { label: "Deadline within 1h", urgent: false }
        : deadline === undefined
          ? { label: "Deadline unreported", urgent: false }
          : undefined,
    hasLastExecutionError(order)
      ? { label: "Latest attempt failed", urgent: true }
      : hasExecutionErrors(order)
        ? { label: "Earlier errors", urgent: false }
        : undefined,
    placed !== undefined && snapshot - placed >= 86_400_000
      ? { label: "Age ≥24h", urgent: false }
      : undefined,
  ].filter((flag) => flag !== undefined);
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((flag) => (
        <span
          key={flag.label}
          className={`rounded px-1.5 py-0.5 text-[10px] ${flag.urgent ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}
        >
          {flag.label}
        </span>
      ))}
    </div>
  );
}

function LatestError({ order }: { order: ListOrder }) {
  const message = order.metadata.chunkSummary?.lastChunkDescription;
  return hasLastExecutionError(order) && message ? (
    <p
      className="mt-1 line-clamp-2 max-w-md break-words text-[11px] text-destructive"
      title={message}
    >
      {message}
    </p>
  ) : null;
}

export function ActiveReviewQueue({ orders }: { orders: ListOrder[] }) {
  const { updatedAt, networkActivity, scope } = useOperationsData();
  const networkNames = new Map(
    networkActivity.map((network) => [network.chainId, network.chainName]),
  );
  return (
    <ContinuousTable
      label="Active orders to review"
      items={orders}
      minWidth={0}
      itemKey={(order) =>
        `${order.source}:${getTwapOrderChainId(order)}:${order.hash}`
      }
      header={
        <tr>
          <th scope="col">Order</th>
          <th scope="col" className="hidden md:table-cell">
            Review signals
          </th>
          <th scope="col" className="hidden md:table-cell">
            Deadline
          </th>
          <th scope="col" className="hidden md:table-cell">
            Chunks
          </th>
        </tr>
      }
      rowContent={(order) => {
        const deadline = deadlineTime(order);
        const chainId = getTwapOrderChainId(order) ?? 0;
        const success = reportedNumber(order.metadata.chunkSummary?.success);
        const expected = reportedNumber(order.metadata.expectedChunks);
        const countdown =
          deadline === undefined
            ? "Deadline not provided"
            : deadline <= updatedAt
              ? `${formatDuration(updatedAt - deadline)} past deadline`
              : `Due in ${formatDuration(deadline - updatedAt)}`;
        const chunks = `${success?.toLocaleString() ?? "—"} / ${expected?.toLocaleString() ?? "—"}`;
        return (
          <>
            <td className="min-w-0">
              <div className="mb-2 md:hidden">
                <ReviewSignals order={order} snapshot={updatedAt} />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link
                  href={orderDetailHref(order.hash, order.source, scope)}
                  className={`${inspectClass} font-mono text-xs hover:underline`}
                  aria-label={`View order ${order.hash}`}
                >
                  {order.hash.slice(0, 8)}…{order.hash.slice(-6)}
                </Link>
                <Network
                  chainId={chainId}
                  data={{ id: chainId, name: networkNames.get(chainId) }}
                  variant="inline"
                  showChainId={false}
                />
              </div>
              <p
                className="mt-1 text-[11px] text-muted-foreground"
                title={`Placed ${formatOrderDate(order.timestamp)}`}
              >
                {order.metadata.orderType || "Type not provided"}
                <span className="md:hidden"> · {countdown}</span>
              </p>
              <div className="md:hidden">
                <LatestError order={order} />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Successful / planned chunks: {chunks}
                </p>
              </div>
            </td>
            <td className="hidden md:table-cell">
              <ReviewSignals order={order} snapshot={updatedAt} />
              <LatestError order={order} />
            </td>
            <td
              className="hidden text-[11px] md:table-cell"
              title={formatOrderDate(deadline)}
            >
              {countdown}
            </td>
            <td
              className="hidden md:table-cell"
              title="Successful / planned chunks"
            >
              {chunks}
            </td>
          </>
        );
      }}
    />
  );
}
