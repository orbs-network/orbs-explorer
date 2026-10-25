"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import { ActiveReviewQueue } from "./active-review-queue";
import { ViewTabs } from "@/components/view-tabs";
import { useOperationsData } from "@/components/operations/operations-view";
import {
  EmptyState,
  Metric,
  MetricGrid,
  Panel,
} from "@/components/operations/primitives";
import { formatOrderUsd } from "@/components/orders-overview/overview-display";
import { buildExecutionHealth } from "@/lib/execution-analytics";
import { CohortRows, inspectClass } from "./execution-ui";

export function ExecutionHealth() {
  const { orders, updatedAt, inspectOrders } = useOperationsData();
  const data = useMemo(
    () => buildExecutionHealth(orders, updatedAt),
    [orders, updatedAt],
  );
  if (!orders.length)
    return (
      <EmptyState
        title="No orders in this view"
        description="Change networks or trading apps, or broaden an explicitly selected placement period."
      />
    );
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
        <Metric
          label="Currently active orders"
          value={data.active.length.toLocaleString()}
          note={`${data.activeValueCoverage ? formatOrderUsd(data.activeValue) : "—"} placed value`}
          orders={data.active}
        />
        {data.deadlines[0].orders.length > 0 && (
          <Metric
            label="Active past deadline"
            value={data.deadlines[0].orders.length.toLocaleString()}
            note="Still reported active"
            orders={data.deadlines[0].orders}
            tone="danger"
          />
        )}
        {data.lastErrors.length > 0 && (
          <Metric
            label="Active · latest attempt failed"
            value={data.lastErrors.length.toLocaleString()}
            orders={data.lastErrors}
            tone="warning"
          />
        )}
        {data.deadlines[1].orders.length > 0 && (
          <Metric
            label="Deadline within 1 hour"
            value={data.deadlines[1].orders.length.toLocaleString()}
            note="Upcoming reported deadlines"
            orders={data.deadlines[1].orders}
            tone="warning"
          />
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {[
          {
            count: data.deadlines[0].orders.length,
            text: "No active orders past deadline",
          },
          {
            count: data.lastErrors.length,
            text: "No active latest-attempt errors",
          },
          {
            count: data.deadlines[1].orders.length,
            text: "No deadlines within 1h",
          },
        ]
          .filter((signal) => signal.count === 0)
          .map((signal) => (
            <span key={signal.text} className="inline-flex items-center gap-1">
              <Check aria-hidden className="size-3" />
              {signal.text}
            </span>
          ))}
      </div>
      {data.active.length ? (
        <ViewTabs
          label="Active order views"
          param="execution_view"
          tabs={[
            {
              value: "review",
              label: "Review queue",
              content: (
                <Panel
                  title="Active orders to review"
                  description="Past deadline, failed latest attempt, or missing deadline. Each order is counted once; age alone is not an execution issue."
                  action={
                    <button
                      type="button"
                      disabled={!data.attention.length}
                      className={inspectClass}
                      onClick={() =>
                        inspectOrders("Active orders to review", data.attention)
                      }
                    >
                      Inspect all ({data.attention.length.toLocaleString()})
                    </button>
                  }
                >
                  {data.attention.length ? (
                    <ActiveReviewQueue orders={data.attention} />
                  ) : (
                    <EmptyState
                      title="No active orders meet these review signals"
                      description="Active orders remain available in the deadline, age, and waiting-state views."
                    />
                  )}
                </Panel>
              ),
            },
            {
              value: "deadlines",
              label: "Deadlines",
              content: (
                <Panel
                  title="Active deadline window"
                  description="Every active order appears in one deadline band."
                >
                  <CohortRows
                    cohorts={data.deadlines}
                    total={data.active.length}
                  />
                </Panel>
              ),
            },
            {
              value: "age",
              label: "Order age",
              content: (
                <Panel
                  title="Active order age"
                  description="Time since placement, regardless of the next scheduled execution."
                >
                  <CohortRows cohorts={data.ages} total={data.active.length} />
                </Panel>
              ),
            },
            {
              value: "waiting",
              label: "Waiting state",
              content: (
                <Panel
                  title="Reported waiting state"
                  description="Current service signals; the list response does not include the next execution schedule."
                >
                  <CohortRows
                    cohorts={data.signals}
                    total={data.active.length}
                  />
                </Panel>
              ),
            },
            {
              value: "progress",
              label: "Chunk progress",
              content: (
                <Panel
                  title="Execution progress"
                  description="Reported chunk summaries for active orders. Missing summaries are excluded from totals."
                >
                  <MetricGrid>
                    <Metric
                      label="Successful chunks"
                      value={
                        data.successfulCoverage
                          ? data.successfulChunks.toLocaleString()
                          : "—"
                      }
                      note={`Reported for ${data.successfulCoverage}/${data.active.length} active orders`}
                    />
                    <Metric
                      label="Failed chunks"
                      value={
                        data.errorCoverage
                          ? data.errorChunks.toLocaleString()
                          : "—"
                      }
                      note={`Reported for ${data.errorCoverage}/${data.active.length} active orders`}
                    />
                    <Metric
                      label="Planned chunks remaining"
                      value={
                        data.remainingCoverage
                          ? data.remainingChunks.toLocaleString()
                          : "—"
                      }
                      note={`Planned minus successful · ${data.remainingCoverage}/${data.active.length} orders`}
                    />
                    <Metric
                      label="Latest attempt reports error"
                      value={data.lastErrors.length.toLocaleString()}
                      note="Current order outcome remains active"
                      orders={data.lastErrors}
                    />
                  </MetricGrid>
                  <div className="mt-4 border-t border-border pt-3">
                    <CohortRows
                      total={data.active.length}
                      cohorts={[
                        {
                          id: "started",
                          label: "At least one successful chunk",
                          description:
                            "Active orders reporting one or more successful chunks.",
                          orders: data.withProgress,
                        },
                        {
                          id: "not-started",
                          label: "No successful chunks reported",
                          description:
                            "Active orders reporting zero successful chunks.",
                          orders: data.noSuccess,
                        },
                        {
                          id: "unknown",
                          label: "Successful chunk count unavailable",
                          description:
                            "Active orders without a usable successful chunk count.",
                          orders: data.progressUnavailable,
                        },
                      ]}
                    />
                  </div>
                </Panel>
              ),
            },
          ]}
        />
      ) : (
        <EmptyState
          title="No active orders"
          description="All orders in this view have ended or have another reported status."
        />
      )}
    </div>
  );
}
