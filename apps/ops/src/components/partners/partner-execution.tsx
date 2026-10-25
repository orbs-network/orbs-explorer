"use client";
import { useMemo } from "react";
import { StringParam, useQueryParam } from "use-query-params";
import { useOperationsData } from "@/components/operations/operations-view";
import { ExecutionHealth } from "@/components/execution/execution-health";
import { OrdersTable } from "@/components/investigation/orders-table";
import {
  Metric,
  MetricGrid,
  Panel,
  EmptyState,
} from "@/components/operations/primitives";
import { useInvestigationFilters } from "@/hooks/use-investigation-filters";
import { investigateOrders } from "@/lib/order-investigation";
import { getOverviewOrderStatus } from "@orbs/domain/twap/utils/orders-overview";
import { reportedNumber } from "@/lib/order-diagnostics";

export function PartnerExecutionHealth() {
  return <ExecutionHealth />;
}

export function PartnerExecutionProgress() {
  const { orders, partnerCards, updatedAt } = useOperationsData();
  const [requested, setScope] = useQueryParam("progress_scope", StringParam);
  const scope = requested === "all" ? "all" : "active";
  const { filters, setFilters } = useInvestigationFilters();
  const selection = useMemo(
    () =>
      orders.filter(
        (order) =>
          scope === "all" || getOverviewOrderStatus(order) === "active",
      ),
    [orders, scope],
  );
  const results = useMemo(
    () => investigateOrders(selection, filters, undefined, updatedAt),
    [selection, filters, updatedAt],
  );
  const partners = useMemo(
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
  const measures = useMemo(
    () => [
      {
        label: "Trades completed",
        values: selection.map((order) =>
          reportedNumber(order.metadata.chunkSummary?.success),
        ),
      },
      {
        label: "Reported execution errors",
        values: selection.map((order) =>
          reportedNumber(order.metadata.chunkSummary?.error),
        ),
      },
      {
        label: "Trades planned",
        values: selection.map((order) =>
          reportedNumber(order.metadata.expectedChunks),
        ),
      },
    ],
    [selection],
  );
  return (
    <div className="space-y-4">
      <MetricGrid>
        {measures.map((measure) => {
          const known = measure.values.filter(
            (value): value is number => value !== undefined,
          );
          return (
            <Metric
              key={measure.label}
              label={measure.label}
              value={
                known.length
                  ? known
                      .reduce((sum, value) => sum + value, 0)
                      .toLocaleString()
                  : "—"
              }
              note={`Reported for ${known.length} of ${selection.length} orders. Execution counts, not value filled.`}
            />
          );
        })}
      </MetricGrid>
      <Panel
        title="Trade progress"
        description="Successful and planned executions are the service’s chunk counts. Reported errors may exclude retry attempts. These counts do not measure executed volume."
      >
        <label className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          Orders
          <select
            aria-label="Progress orders"
            value={scope}
            onChange={(event) => setScope(event.target.value, "pushIn")}
            className="h-10 rounded-md bg-control-background px-3 text-foreground"
          >
            <option value="active">Currently active</option>
            <option value="all">All orders in this scope</option>
          </select>
        </label>
        {results.length ? (
          <OrdersTable
            orders={results}
            partners={partners}
            sort={filters.sort}
            onSort={(sort) => setFilters((previous) => ({ ...previous, sort }))}
          />
        ) : (
          <EmptyState
            title="No matching orders"
            description="Change the progress filter or the selected networks."
          />
        )}
      </Panel>
    </div>
  );
}
