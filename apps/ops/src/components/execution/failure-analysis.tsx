"use client";

import { useMemo } from "react";
import { FailureReasons } from "./failure-reasons";
import { ViewTabs } from "@/components/view-tabs";
import {
  groupOverviewOrders,
  OVERVIEW_STATUSES,
} from "@orbs/domain/twap/utils/orders-overview";
import { useOperationsData } from "@/components/operations/operations-view";
import {
  EmptyState,
  Metric,
  MetricGrid,
  Panel,
} from "@/components/operations/primitives";
import { formatShare } from "@/components/orders-overview/overview-display";
import {
  buildFailureAnalytics,
  buildFailureImpact,
} from "@/lib/execution-analytics";
import { CohortRows, FailureImpactTable } from "./execution-ui";

export function FailureAnalysis() {
  const { orders, networkActivity, partnerCards } = useOperationsData();
  const data = useMemo(() => buildFailureAnalytics(orders), [orders]);
  const networkImpact = useMemo(
    () =>
      buildFailureImpact(
        networkActivity.map((network) => ({
          id: String(network.chainId),
          label: network.chainName,
          orders: network.orders,
        })),
      ).map((row) => ({ ...row, chainId: Number(row.id) })),
    [networkActivity],
  );
  const appImpact = useMemo(
    () =>
      buildFailureImpact(
        partnerCards.map((partner) => ({
          id: partner.partnerId,
          label: partner.partnerName,
          orders: partner.chains.flatMap((chain) => chain.orders),
        })),
      ),
    [partnerCards],
  );
  const outcomes = useMemo(
    () => groupOverviewOrders(data.history),
    [data.history],
  );
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
      <ViewTabs
        label="Failure analysis views"
        param="failure_view"
        tabs={[
          {
            value: "reasons",
            label: "Failure reasons",
            content: <FailureReasons orders={orders} />,
          },
          {
            value: "history",
            label: "Error history",
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel
                  title="Latest attempt and reported errors"
                  description="Attempt signals and order outcomes can overlap."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Metric
                      label="Latest attempt reports error"
                      value={data.cohorts.latest.length.toLocaleString()}
                      note="Latest chunk status is error or failed"
                      orders={data.cohorts.latest}
                    />
                    <Metric
                      label="Reported failed chunks"
                      value={
                        data.errorCoverage
                          ? data.reportedErrors.toLocaleString()
                          : "—"
                      }
                      note={`Chunk error count reported for ${data.errorCoverage}/${orders.length} orders`}
                    />
                  </div>
                  <div className="mt-4 rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                    Use the reason groups to inspect current failure messages.
                    Completed orders with earlier errors can have no historical
                    failure message in this summary.
                  </div>
                </Panel>
                <Panel
                  title="Current outcomes after execution errors"
                  description="Only orders with reported chunk errors or a latest failed attempt are included."
                >
                  <CohortRows
                    total={data.history.length}
                    cohorts={Object.entries(outcomes).map(
                      ([id, cohortOrders]) => ({
                        id,
                        label:
                          OVERVIEW_STATUSES[
                            id as keyof typeof OVERVIEW_STATUSES
                          ].label,
                        description:
                          "Current order outcome for orders with execution error history.",
                        orders: cohortOrders,
                      }),
                    )}
                  />
                </Panel>
              </div>
            ),
          },
          {
            value: "networks",
            label: "Affected networks",
            content: (
              <Panel
                title="Affected networks"
                description="Error signals across all orders in the current filters. Share uses every order on each network."
              >
                {networkImpact.length ? (
                  <FailureImpactTable rows={networkImpact} label="Network" />
                ) : (
                  <EmptyState
                    title="No affected networks"
                    description="No terminal failures or execution errors are reported in this view."
                  />
                )}
              </Panel>
            ),
          },
          {
            value: "apps",
            label: "Affected apps",
            content: (
              <Panel
                title="Affected trading apps"
                description="Error signals across all orders in the current filters. Share uses every order for each app."
              >
                {appImpact.length ? (
                  <FailureImpactTable rows={appImpact} label="Trading app" />
                ) : (
                  <EmptyState
                    title="No affected trading apps"
                    description="No terminal failures or execution errors are reported in this view."
                  />
                )}
              </Panel>
            ),
          },
        ]}
      />
    </div>
  );
}
