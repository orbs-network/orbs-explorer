"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { ChartPlot } from "@/components/charts/chart-plot";
import { chartTooltip, useChartTheme } from "@/components/charts/chart-theme";
import { useQueryClient } from "@tanstack/react-query";
import type { Token } from "@orbs/domain/types";
import { tokenQueryKey } from "@orbs/domain/token-metadata";
import { buildMarketAnalytics } from "@/lib/market-analytics";
import { useOperationsData } from "@/components/operations/operations-view";
import { Panel } from "@/components/operations/primitives";
import {
  formatOrderUsd,
  formatShare,
} from "@/components/orders-overview/overview-display";
import { RouteRankings, TokenRankings } from "./market-rankings";
import { inspectClass } from "./analytics-labels";

import { ViewTabs } from "@/components/view-tabs";

function useMarketData() {
  const { orders } = useOperationsData();
  const queryClient = useQueryClient();
  const data = useMemo(
    () =>
      buildMarketAnalytics(
        orders,
        (address, chainId) =>
          queryClient.getQueryData<Token | null>(
            tokenQueryKey(address, chainId),
          ) ?? undefined,
      ),
    [orders, queryClient],
  );
  return data;
}

function MarketRoutes() {
  const data = useMarketData();
  const { inspectOrders } = useOperationsData();
  return <RouteRankings routes={data.routes} inspect={inspectOrders} />;
}

function MarketTokens() {
  const data = useMarketData();
  const { inspectOrders } = useOperationsData();
  return <TokenRankings tokens={data.tokens} inspect={inspectOrders} />;
}

function MarketConcentration() {
  const data = useMarketData();
  const { inspectOrders } = useOperationsData();
  const theme = useChartTheme();
  const concentration = [1, 3, 5, 10].map((count) => {
    const routes = data.routes.slice(0, count);
    const value = routes.reduce((sum, route) => sum + route.summary.value, 0);
    return {
      label: `Top ${count === 1 ? "route" : `${count} routes`}${count > data.routes.length ? ` (${data.routes.length} available)` : ""}`,
      routes,
      value,
      share: data.summary.value ? (value / data.summary.value) * 100 : 0,
    };
  });
  const concentrationOption: EChartsOption = {
    grid: { top: 10, right: 44, bottom: 25, left: 0, containLabel: true },
    xAxis: {
      type: "value",
      max: 100,
      axisLabel: { color: theme.muted, fontSize: 10, formatter: "{value}%" },
      splitLine: { lineStyle: { color: theme.grid, type: "dashed" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: concentration.map((entry) => entry.label),
      axisLabel: { color: theme.muted, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        const entry = Array.isArray(params) ? params[0] : params;
        const point = concentration[entry.dataIndex];
        if (!point) return "";
        return chartTooltip(
          point.label,
          [
            {
              label: "Share of reported placed USD",
              value: formatShare(point.value, data.summary.value),
            },
            {
              label: "Reported placed USD",
              value: formatOrderUsd(point.value),
            },
            {
              label: "Orders",
              value: point.routes
                .reduce((sum, route) => sum + route.summary.orders.length, 0)
                .toLocaleString(),
            },
          ],
          "Original order size, not executed volume. Select to inspect orders.",
        );
      },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 25,
        data: concentration.map((entry) => entry.share),
        itemStyle: { color: theme.primary, borderRadius: [0, 5, 5, 0] },
        label: {
          show: true,
          position: "right",
          color: theme.text,
          fontSize: 11,
          formatter: (params) => `${Number(params.value).toFixed(1)}%`,
        },
        cursor: "pointer",
      },
    ],
  };
  return (
    <Panel
      title="Route concentration · share of placed value (USD)"
      description="Cumulative share of reported placed USD across the largest directional routes. Unreported values contribute no dollars."
    >
      {data.summary.value > 0 ? (
        <ChartPlot
          option={concentrationOption}
          label="Cumulative share of reported placed USD by largest routes"
          height={230}
          onSelect={(index) => {
            const entry = concentration[index];
            if (entry?.routes.length)
              inspectOrders(
                `${entry.label} by placed USD`,
                entry.routes.flatMap((route) => route.summary.orders),
              );
          }}
        />
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Route concentration needs a reported placed USD total greater than
          zero.
        </p>
      )}
      <details className="mt-3 rounded-lg bg-muted/40 px-3 py-2.5">
        <summary className="cursor-pointer rounded text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          View concentration data and inspect orders
        </summary>
        <div className="mt-3 space-y-2">
          {concentration.map((entry) => (
            <button
              key={entry.label}
              type="button"
              className={`block w-full ${inspectClass}`}
              disabled={!entry.routes.length}
              onClick={() =>
                inspectOrders(
                  `${entry.label} by placed USD`,
                  entry.routes.flatMap((route) => route.summary.orders),
                )
              }
            >
              <span className="mb-1.5 flex justify-between gap-3 text-xs">
                <span>{entry.label}</span>
                <span className="font-medium">
                  {data.summary.value > 0
                    ? formatShare(entry.value, data.summary.value)
                    : "—"}{" "}
                  <span className="ml-2 text-muted-foreground">
                    {formatOrderUsd(entry.value)}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </details>
    </Panel>
  );
}

export function MarketsView() {
  return (
    <ViewTabs
      label="Market views"
      param="market_view"
      tabs={[
        { value: "routes", label: "Routes", content: <MarketRoutes /> },
        { value: "tokens", label: "Tokens", content: <MarketTokens /> },
        {
          value: "concentration",
          label: "Concentration",
          content: <MarketConcentration />,
        },
      ]}
    />
  );
}
