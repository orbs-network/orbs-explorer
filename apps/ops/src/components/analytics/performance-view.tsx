"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { ChartPlot } from "@/components/charts/chart-plot";
import { chartTooltip, useChartTheme } from "@/components/charts/chart-theme";
import { useOperationsData } from "@/components/operations/operations-view";
import { Panel } from "@/components/operations/primitives";
import {
  buildCategoricalCohorts,
  buildOrderSizeDistribution,
  summarizeCohort,
} from "@/lib/market-analytics";
import {
  formatOrderUsd,
  formatShare,
} from "@/components/orders-overview/overview-display";
import { CohortTable } from "./cohort-table";
import { PlacementHeatmap } from "./placement-heatmap";
import { inspectClass } from "./analytics-labels";
import { ViewTabs } from "@/components/view-tabs";

function ComparePerformance({ by }: { by: "partners" | "networks" }) {
  const { partnerCards, networkActivity } = useOperationsData();
  const groups = useMemo(
    () =>
      by === "partners"
        ? partnerCards.map((partner) => ({
            key: partner.partnerId,
            label: partner.partnerName,
            orders: partner.chains.flatMap((chain) => chain.orders),
          }))
        : networkActivity.map((network) => ({
            key: String(network.chainId),
            label: network.chainName,
            chainId: network.chainId,
            orders: network.orders,
          })),
    [by, partnerCards, networkActivity],
  );
  const label = by === "partners" ? "Trading apps" : "Networks";
  return (
    <Panel
      title={label}
      description="Current outcomes and reported sizes. Completion share does not measure service uptime."
    >
      <CohortTable groups={groups} label={label} />
    </Panel>
  );
}

function OrderTypePerformance() {
  const { orders } = useOperationsData();
  const groups = useMemo(
    () => buildCategoricalCohorts(orders, "type"),
    [orders],
  );
  const label = "Order types";
  return (
    <Panel
      title={label}
      description="Current outcomes and error history, including recovered orders."
    >
      <CohortTable groups={groups} label={label} />
    </Panel>
  );
}

function OrderSizes() {
  const { orders, inspectOrders } = useOperationsData();
  const summary = useMemo(() => summarizeCohort(orders), [orders]);
  const sizes = useMemo(() => buildOrderSizeDistribution(orders), [orders]);
  const theme = useChartTheme();
  const sizeOption: EChartsOption = {
    grid: { top: 8, right: 34, bottom: 26, left: 0, containLabel: true },
    xAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { color: theme.muted },
      splitLine: { lineStyle: { color: theme.grid, type: "dashed" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: sizes.map((bucket) => bucket.label),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: theme.muted, fontSize: 11 },
    },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        const entry = Array.isArray(params) ? params[0] : params;
        const bucket = sizes[entry.dataIndex];
        if (!bucket) return "";
        return chartTooltip(
          bucket.label,
          [
            { label: "Orders", value: bucket.orders.length.toLocaleString() },
            {
              label: "Share of selected orders",
              value: formatShare(bucket.orders.length, orders.length),
            },
            {
              label: "Reported placed USD",
              value:
                bucket.key === "unpriced"
                  ? "Unavailable"
                  : formatOrderUsd(bucket.summary.value),
            },
          ],
          bucket.orders.length
            ? "Select to inspect orders."
            : "No orders in this size bucket.",
        );
      },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 22,
        data: sizes.map((bucket) => ({
          value: bucket.orders.length,
          itemStyle: {
            color: bucket.key === "unpriced" ? theme.muted : theme.primary,
            borderRadius: [0, 5, 5, 0],
          },
        })),
        emphasis: { focus: "self" },
        label: {
          show: true,
          position: "right",
          color: theme.text,
          fontSize: 11,
        },
        cursor: "pointer",
      },
    ],
  };
  const sized = (value: number | undefined) =>
    value === undefined ? "—" : formatOrderUsd(value);
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-2">
      <Panel
        title="Placed order size distribution"
        description="USD size buckets are exclusive. The upper boundary is excluded except for the open-ended final bucket; missing and invalid values remain separate."
      >
        <ChartPlot
          option={sizeOption}
          label="Order count by reported placed USD size bucket"
          height={290}
          onSelect={(index) => {
            const bucket = sizes[index];
            if (bucket?.orders.length)
              inspectOrders(
                `${bucket.label} · placed order size`,
                bucket.orders,
              );
          }}
        />
        <details className="mt-3 rounded-lg bg-muted/40 px-3 py-2.5">
          <summary className="cursor-pointer rounded text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            View size data and inspect orders
          </summary>
          <div className="mt-3 space-y-1">
            {sizes.map((bucket) => (
              <button
                key={bucket.key}
                type="button"
                disabled={!bucket.orders.length}
                className={`flex w-full items-center justify-between gap-4 px-2 py-2 enabled:hover:bg-accent/30 ${inspectClass}`}
                onClick={() =>
                  inspectOrders(
                    `${bucket.label} · placed order size`,
                    bucket.orders,
                  )
                }
              >
                <span className="min-w-28 text-xs">{bucket.label}</span>
                <span className="text-right text-xs tabular-nums">
                  {bucket.orders.length.toLocaleString()}{" "}
                  <span className="text-muted-foreground">
                    ({formatShare(bucket.orders.length, orders.length)})
                  </span>
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {bucket.key === "unpriced"
                      ? "USD unavailable"
                      : formatOrderUsd(bucket.summary.value)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </details>
      </Panel>
      <Panel
        title="Reported order values"
        description="Reported placed USD sizes, including zero, are not executed volume. P90 uses linear interpolation between reported values."
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-6 text-sm">
          {[
            ["Reported placed USD", formatOrderUsd(summary.value)],
            ["Mean placed size", sized(summary.mean)],
            ["Median placed size", sized(summary.median)],
            ["P90 placed size", sized(summary.p90)],
            ["Largest placed order", sized(summary.maximum)],
            [
              "USD coverage",
              `${formatShare(summary.pricedCount, orders.length)} (${summary.pricedCount.toLocaleString()}/${orders.length.toLocaleString()})`,
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {summary.unpriced.length > 0 && (
          <button
            type="button"
            className={`mt-6 text-xs ${inspectClass}`}
            onClick={() =>
              inspectOrders(
                "Orders with unavailable USD size",
                summary.unpriced,
              )
            }
          >
            Inspect {summary.unpriced.length.toLocaleString()} orders excluded
            from size statistics →
          </button>
        )}
      </Panel>
    </div>
  );
}

export function PerformanceView() {
  return (
    <ViewTabs
      label="Performance views"
      param="performance_view"
      tabs={[
        {
          value: "apps",
          label: "Trading apps",
          content: <ComparePerformance by="partners" />,
        },
        {
          value: "networks",
          label: "Networks",
          content: <ComparePerformance by="networks" />,
        },
        { value: "sizes", label: "Order sizes", content: <OrderSizes /> },
        {
          value: "placement",
          label: "Placement times",
          content: <PlacementHeatmap />,
        },
        {
          value: "types",
          label: "Order types",
          content: <OrderTypePerformance />,
        },
      ]}
    />
  );
}
