"use client";

import { useMemo } from "react";
import { FailureReasons } from "./failure-reasons";
import { useOperationsData } from "@/components/operations/operations-view";
import {
  EmptyState,
  Metric,
  MetricGrid,
} from "@/components/operations/primitives";
import { formatShare } from "@/components/orders-overview/overview-display";
import { buildFailureAnalytics } from "@/lib/execution-analytics";

export function FailureAnalysis() {
  const { orders } = useOperationsData();
  const data = useMemo(() => buildFailureAnalytics(orders), [orders]);
  if (!orders.length)
    return (
      <EmptyState
        title="No orders in this view"
        description="Change the period, networks, or trading apps to inspect failures."
      />
    );
  return (
    <div className="space-y-5">
      <MetricGrid>
        <Metric
          label="Orders with error signals"
          value={data.cohorts.all.length.toLocaleString()}
          note={`${formatShare(data.cohorts.all.length, orders.length)} of orders`}
          orders={data.cohorts.all}
        />
        <Metric
          label="Failed orders"
          value={data.cohorts.terminal.length.toLocaleString()}
          orders={data.cohorts.terminal}
        />
        <Metric
          label="Active with error history"
          value={data.cohorts.active.length.toLocaleString()}
          note="These orders can still execute"
          orders={data.cohorts.active}
        />
        <Metric
          label="Completed with error history"
          value={data.cohorts.completed.length.toLocaleString()}
          orders={data.cohorts.completed}
        />
      </MetricGrid>
      <details className="text-xs text-muted-foreground">
        <summary className="w-fit cursor-pointer rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          How errors are counted
        </summary>
        <p className="mt-2 max-w-3xl leading-relaxed">
          A failed execution attempt can belong to an active or completed order.
          The list response reports chunk counts and the latest attempt; it does
          not provide the times or messages for every earlier error.
        </p>
      </details>
      <FailureReasons orders={orders} />
      <details className="rounded-xl bg-card p-4 text-xs">
        <summary className="cursor-pointer rounded-sm font-medium focus-visible:ring-2 focus-visible:ring-ring">
          Reported execution counts
        </summary>
        <p className="mt-3 text-muted-foreground">
          {data.errorCoverage ? data.reportedErrors.toLocaleString() : "—"}{" "}
          failed chunks reported across {data.errorCoverage}/{orders.length}{" "}
          orders. Chunk counts do not include every retry attempt.
        </p>
      </details>
    </div>
  );
}
