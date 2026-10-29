"use client";

import { Button } from "@orbs/ui/controls/button";
import { useState } from "react";
import type { EChartsOption } from "echarts";
import { ChevronRight } from "lucide-react";
import type { ListOrder } from "@orbs/domain/twap/types";
import { NetworkIcon } from "@orbs/ui/controls/network";
import { Avatar, AvatarFallback, AvatarImage } from "@orbs/ui/controls/avatar";
import {
  formatOrderUsd,
  formatShare,
} from "@/components/orders-overview/overview-display";
import { reportedNumber } from "@/lib/order-diagnostics";
import { ChartPlot } from "./chart-plot";
import { chartTooltip, useChartTheme } from "./chart-theme";

export type RankingDatum = {
  id: string;
  label: string;
  value: number;
  orders: ListOrder[];
  logo?: string;
  chainId?: number;
};
export type RankingMetric = "orders" | "value";

const exactUsd = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
const compactCount = (value: number) =>
  new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export function RankedChart({
  data,
  metric,
  onSelect,
}: {
  data: RankingDatum[];
  metric: RankingMetric;
  onSelect: (label: string, orders: ListOrder[]) => void;
}) {
  const [all, setAll] = useState(false);
  const theme = useChartTheme();
  const measure = (row: RankingDatum) =>
    metric === "value" ? row.value : row.orders.length;
  const sorted = data
    .filter((row) => row.orders.length > 0)
    .map((row) => ({
      ...row,
      priced: row.orders.filter(
        (order) => reportedNumber(order.totalUSDAmount) !== undefined,
      ).length,
    }))
    .sort((a, b) => measure(b) - measure(a) || a.label.localeCompare(b.label));
  const visible = all ? sorted : sorted.slice(0, 10);
  const total = sorted.reduce((sum, row) => sum + measure(row), 0);
  const valueLabel = (row: (typeof sorted)[number]) =>
    metric === "value"
      ? row.priced
        ? formatOrderUsd(row.value)
        : "Not reported"
      : row.orders.length.toLocaleString();
  const option: EChartsOption = {
    grid: { top: 10, bottom: 30, left: 12, right: 78, containLabel: true },
    xAxis: {
      type: "value",
      min: 0,
      minInterval: metric === "orders" ? 1 : undefined,
      axisLabel: {
        color: theme.muted,
        fontSize: 10,
        hideOverlap: true,
        formatter: metric === "value" ? formatOrderUsd : compactCount,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: theme.grid, type: "dashed" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: visible.map((row) => row.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: theme.text,
        fontSize: 11,
        width: 104,
        overflow: "truncate",
        margin: 10,
      },
    },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params;
        const row = visible[item.dataIndex];
        if (!row) return "";
        return chartTooltip(
          row.label,
          [
            {
              label: "Orders",
              value: row.orders.length.toLocaleString(),
              color: theme.primary,
            },
            {
              label: "Placed value",
              value: row.priced ? exactUsd(row.value) : "Not reported",
            },
            {
              label:
                metric === "value"
                  ? "Share of reported value"
                  : "Share of orders",
              value:
                metric === "value" && !row.priced
                  ? "—"
                  : formatShare(measure(row), total),
            },
          ],
          `${row.priced}/${row.orders.length} orders report USD. Select to inspect orders.`,
        );
      },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 18,
        showBackground: true,
        backgroundStyle: { color: `${theme.muted}0a`, borderRadius: 5 },
        itemStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: `${theme.primary}99` },
              { offset: 1, color: theme.primary },
            ],
          },
          borderRadius: [0, 5, 5, 0],
        },
        emphasis: {
          itemStyle: {
            color: theme.primary,
            shadowBlur: 10,
            shadowColor: `${theme.primary}30`,
          },
        },
        label: {
          show: true,
          position: "right",
          distance: 8,
          color: theme.text,
          fontSize: 11,
          formatter: (params) => valueLabel(visible[params.dataIndex]),
        },
        data: visible.map((row) => ({
          name: row.label,
          value: metric === "value" && !row.priced ? "-" : measure(row),
        })),
      },
    ],
  };
  if (!sorted.length)
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No orders in this view.
      </p>
    );
  return (
    <div>
      <div className="max-h-96 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain">
        <ChartPlot
          option={option}
          label={`Ranked ${metric === "value" ? "placed USD value" : "order count"} by category. Data and order links follow the chart.`}
          height={Math.max(180, visible.length * 32 + 46)}
          onSelect={(index) => {
            const row = visible[index];
            if (row) onSelect(row.label, row.orders);
          }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground">
          {metric === "value" ? "Reported placed value · USD" : "Orders placed"}
          {metric === "value" && visible.some((row) => !row.priced)
            ? " · Blank bars have no reported USD value"
            : ""}
        </p>
        {sorted.length > 10 && (
          <Button
            variant="ghost"
            size="content"
            type="button"
            onClick={() => setAll(!all)}
            className="rounded text-xs font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {all ? "Show top 10" : `Show all ${sorted.length}`}
          </Button>
        )}
      </div>
      <details className="mt-4 border-t border-border pt-3 text-xs">
        <summary className="cursor-pointer rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          View ranking data
        </summary>
        <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto overscroll-contain">
          {visible.map((row) => (
            <li key={row.id}>
              <Button
                variant="ghost"
                size="content"
                type="button"
                onClick={() => onSelect(row.label, row.orders)}
                className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                aria-label={`View ${row.orders.length} orders for ${row.label}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {row.chainId !== undefined ? (
                    <span aria-hidden>
                      <NetworkIcon
                        chainId={row.chainId}
                        name={row.label}
                        className="size-5"
                      />
                    </span>
                  ) : (
                    <Avatar aria-hidden className="size-5 shrink-0">
                      <AvatarImage src={row.logo} alt="" />
                      <AvatarFallback className="text-[9px]">
                        {row.label.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <span className="min-w-0 break-words font-medium">
                    {row.label}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2.5">
                  <span className="text-right tabular-nums">
                    <span className="block font-semibold">
                      {valueLabel(row)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {metric === "value" && !row.priced
                        ? "USD not reported"
                        : formatShare(measure(row), total)}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="size-3.5 text-muted-foreground group-hover:text-primary"
                  />
                </span>
              </Button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
