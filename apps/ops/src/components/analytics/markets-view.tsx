"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { ChartPlot } from "@/components/charts/chart-plot";
import { chartTooltip, useChartTheme } from "@/components/charts/chart-theme";
import { useQueryClient } from "@tanstack/react-query";
import type { Token } from "@orbs/domain/types";
import { getChainName, shortenAddress } from "@orbs/domain/utils/utils";
import { tokenQueryKey } from "@orbs/domain/token-metadata";
import {
  buildMarketAnalytics,
  type TokenActivity,
} from "@/lib/market-analytics";
import { useOperationsData } from "@/components/operations/operations-view";
import { Panel } from "@/components/operations/primitives";
import {
  formatOrderUsd,
  formatShare,
} from "@/components/orders-overview/overview-display";
import { RouteRankings, TokenRankings } from "./market-rankings";
import {
  inspectClass,
  NetworkLabel,
  TokenIdentity,
  TokenReferenceCopy,
} from "./analytics-labels";

import { ViewTabs } from "@/components/view-tabs";

function TokenDemand({
  tokens,
  side,
}: {
  tokens: TokenActivity[];
  side: "input" | "output";
}) {
  const { inspectOrders } = useOperationsData();
  const theme = useChartTheme();
  const ranked = [...tokens]
    .filter((token) => token[side].orders.length)
    .sort(
      (a, b) =>
        b[side].orders.length - a[side].orders.length ||
        a.key.localeCompare(b.key),
    )
    .slice(0, 8);
  const tokenLabel = (token: TokenActivity) =>
    token.token?.symbol ||
    (token.address === "not-provided"
      ? "Token not provided"
      : shortenAddress(token.address));
  const networkLabel = (chainId: number) =>
    getChainName(chainId) ??
    (chainId ? `Network ${chainId}` : "Network not provided");
  const option: EChartsOption = {
    grid: { top: 10, right: 30, bottom: 26, left: 0, containLabel: true },
    xAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { color: theme.muted, fontSize: 10 },
      splitLine: { lineStyle: { color: theme.grid, type: "dashed" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: ranked.map(
        (token) => `${tokenLabel(token)} · ${networkLabel(token.chainId)}`,
      ),
      axisLabel: {
        color: theme.muted,
        fontSize: 10,
        width: 122,
        overflow: "truncate",
      },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        const entry = Array.isArray(params) ? params[0] : params;
        const token = ranked[entry.dataIndex];
        if (!token) return "";
        return chartTooltip(
          `${tokenLabel(token)} · ${networkLabel(token.chainId)}`,
          [
            {
              label: `${side === "input" ? "Input" : "Output"} orders`,
              value: token[side].orders.length.toLocaleString(),
            },
          ],
          "Ranked by order count. Select to inspect orders.",
        );
      },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 22,
        data: ranked.map((token) => token[side].orders.length),
        itemStyle: { color: theme.primary, borderRadius: [0, 5, 5, 0] },
        label: {
          show: true,
          position: "right",
          color: theme.text,
          fontSize: 11,
        },
        emphasis: { focus: "self" },
        cursor: "pointer",
      },
    ],
  };
  return (
    <Panel
      title={
        side === "input"
          ? "Most placed input tokens"
          : "Most requested output tokens"
      }
      description={`Top eight tokens by the number of orders where they are the ${side} token. Each network and address is ranked separately.`}
    >
      {ranked.length ? (
        <>
          <ChartPlot
            option={option}
            label={`Most popular ${side} tokens by order count`}
            height={Math.max(200, ranked.length * 36 + 38)}
            onSelect={(index) => {
              const token = ranked[index];
              if (token)
                inspectOrders(
                  `${tokenLabel(token)} · ${side} orders`,
                  token[side].orders,
                );
            }}
          />
          <details className="mt-3 rounded-lg bg-muted/40 px-3 py-2.5">
            <summary className="cursor-pointer rounded text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              View token data and inspect orders
            </summary>
            <div className="mt-3 space-y-1">
              {ranked.map((token) => (
                <div key={token.key} className="flex items-center gap-1">
                  <button
                    type="button"
                    className={`flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 px-2 py-2 hover:bg-accent/40 ${inspectClass}`}
                    onClick={() =>
                      inspectOrders(
                        `${token.token?.symbol ?? token.address} · ${side} orders`,
                        token[side].orders,
                      )
                    }
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <TokenIdentity reference={token} />
                      <span className="text-[10px] text-muted-foreground">
                        <NetworkLabel chainId={token.chainId} />
                      </span>
                    </span>
                    <span className="ml-auto text-right text-xs font-medium">
                      {token[side].orders.length.toLocaleString()} orders →
                    </span>
                  </button>
                  <TokenReferenceCopy reference={token} />
                </div>
              ))}
            </div>
          </details>
        </>
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No token orders in the selected filters.
        </p>
      )}
    </Panel>
  );
}

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

function MarketDemand() {
  const data = useMarketData();
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <TokenDemand tokens={data.tokens} side="input" />
      <TokenDemand tokens={data.tokens} side="output" />
    </div>
  );
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
      title="Route concentration"
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

function MarketCoverage() {
  const data = useMarketData();
  const { orders, inspectOrders } = useOperationsData();
  return (
    <Panel
      title="Market data coverage"
      description="The service reports placed order size, not executed volume or token quantities. Outcome and error counts refer to the current snapshot."
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">
            Reported placed value
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {orders.length && !data.summary.pricedCount
              ? "—"
              : formatOrderUsd(data.summary.value)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            USD reporting coverage
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {formatShare(data.summary.pricedCount, orders.length)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Values reported</dt>
          <dd className="mt-1 tabular-nums">
            {data.summary.pricedCount.toLocaleString()} /{" "}
            {orders.length.toLocaleString()} orders
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Value unavailable</dt>
          <dd className="mt-1">
            <button
              className={inspectClass}
              type="button"
              disabled={!data.summary.unpriced.length}
              onClick={() =>
                inspectOrders(
                  "Orders without reported USD",
                  data.summary.unpriced,
                )
              }
            >
              {data.summary.unpriced.length.toLocaleString()} orders{" "}
              {data.summary.unpriced.length ? "→" : ""}
            </button>
          </dd>
        </div>
      </dl>
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
        { value: "demand", label: "Token demand", content: <MarketDemand /> },
        {
          value: "concentration",
          label: "Concentration",
          content: <MarketConcentration />,
        },
        {
          value: "coverage",
          label: "Data coverage",
          content: <MarketCoverage />,
        },
      ]}
    />
  );
}
