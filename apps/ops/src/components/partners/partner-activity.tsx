"use client";

import { useMemo } from "react";
import {
  PlacementActivityPlot,
  TimelineDataTable,
} from "@/components/charts/timeline-plot";
import { useOperationsData } from "@/components/operations/operations-view";
import { EmptyState, Panel } from "@/components/operations/primitives";
import { buildOrderCharts } from "@/lib/order-charts";

export function PartnerActivity() {
  const { orders, updatedAt, scope, inspectOrders } = useOperationsData();
  const trend = useMemo(
    () => buildOrderCharts(orders, updatedAt, scope.days),
    [orders, updatedAt, scope.days],
  );

  return (
    <Panel
      title="Placement activity"
      description={`Orders placed per ${trend.interval} in UTC, colored by their current outcome. Select a bar or a timeline row to inspect its orders. USD values describe placed orders, not executed volume.`}
    >
      {orders.length ? (
        <>
          <PlacementActivityPlot data={trend} onSelect={inspectOrders} />
          <TimelineDataTable data={trend} onSelect={inspectOrders} />
          {trend.undatedOrders > 0 && (
            <p className="mt-3 text-[10px] text-muted-foreground">
              {trend.undatedOrders.toLocaleString()} orders without a valid
              placement time at the snapshot are excluded from this trend.
            </p>
          )}
        </>
      ) : (
        <EmptyState description="Choose a longer period or different networks to see this partner’s placement activity." />
      )}
    </Panel>
  );
}
