"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { buildOrderCharts, type ChartInterval } from "@/lib/order-charts";
import { useOperationsData } from "@/components/operations/operations-view";
import { PlacementHeatmap } from "@/components/analytics/placement-heatmap";
import { ViewTabs } from "@/components/view-tabs";
import { TimelineCharts } from "./timeline-charts";

export default function OrderCharts() {
  const { orders, updatedAt, scope, inspectOrders } = useOperationsData();
  const search = useSearchParams();
  const requested = search.get("chart_interval");
  const interval: ChartInterval | undefined =
    requested === "day" || requested === "week" || requested === "month"
      ? requested
      : undefined;
  const data = useMemo(
    () => buildOrderCharts(orders, updatedAt, scope.days, interval),
    [orders, updatedAt, scope.days, interval],
  );
  return (
    <ViewTabs
      label="Activity views"
      param="chart_view"
      tabs={[
        {
          value: "trends",
          label: "Timeline",
          content: <TimelineCharts data={data} onSelect={inspectOrders} />,
        },
        {
          value: "placement",
          label: "Placement patterns",
          content: <PlacementHeatmap />,
        },
      ]}
    />
  );
}
