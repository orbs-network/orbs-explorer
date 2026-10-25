"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { ListOrder } from "@orbs/domain/twap/types";
import type { ActivityBucket } from "@/lib/overview-monitoring";
import { ChartPlot } from "@/components/charts/chart-plot";
import { chartTooltip, useChartTheme } from "@/components/charts/chart-theme";
import { CHART_COLORS } from "@/components/charts/chart-colors";

const rate = (value?: number) =>
  value === undefined
    ? "—"
    : `${(value * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
const range = (bucket: ActivityBucket) =>
  `${new Date(bucket.timestamp).toLocaleString(undefined, { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}–${new Date(bucket.end).toLocaleString(undefined, { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} UTC`;

export default function OverviewActivityChart({
  buckets,
  measure,
  inspect,
}: {
  buckets: ActivityBucket[];
  measure: "activity" | "rates";
  inspect: (title: string, orders: ListOrder[], description?: string) => void;
}) {
  const theme = useChartTheme();
  const option = useMemo<EChartsOption>(
    () => ({
      grid: {
        top: 12,
        right: 10,
        left: 2,
        bottom: 6,
        outerBoundsMode: "same",
        outerBoundsContain: "axisLabel",
      },
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const point: unknown = Array.isArray(params) ? params[0] : params;
          const index =
            point &&
            typeof point === "object" &&
            "dataIndex" in point &&
            typeof point.dataIndex === "number"
              ? point.dataIndex
              : -1;
          const bucket = buckets[index];
          return bucket
            ? chartTooltip(
                range(bucket),
                [
                  {
                    label: "Orders placed",
                    value: bucket.orders.length.toLocaleString(),
                  },
                  {
                    label: "Currently completed",
                    value: bucket.completed.toLocaleString(),
                    color: CHART_COLORS.completed,
                  },
                  {
                    label: "Currently failed",
                    value: bucket.failed.toLocaleString(),
                    color: CHART_COLORS.failed,
                  },
                  {
                    label: "Other outcomes",
                    value: bucket.other.toLocaleString(),
                    color: CHART_COLORS.unknown,
                  },
                  {
                    label: "Terminal failure rate",
                    value: rate(bucket.failureRate),
                  },
                ],
                "Grouped by placement time; outcomes reflect the latest snapshot, not when failures occurred.",
              )
            : "";
        },
      },
      xAxis: {
        type: "category",
        data: buckets.map((bucket) => bucket.label),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: theme.border } },
        axisLabel: { color: theme.muted, fontSize: 10, hideOverlap: true },
      },
      yAxis: {
        type: "value",
        min: 0,
        ...(measure === "rates"
          ? {
              max: 100,
              axisLabel: {
                color: theme.muted,
                fontSize: 10,
                formatter: "{value}%",
              },
            }
          : {
              minInterval: 1,
              axisLabel: { color: theme.muted, fontSize: 10 },
            }),
        splitNumber: 3,
        splitLine: { lineStyle: { color: theme.grid, type: "dashed" } },
      },
      series:
        measure === "rates"
          ? [
              {
                type: "line",
                name: "Terminal failure rate",
                data: buckets.map((bucket) =>
                  bucket.failureRate === undefined
                    ? null
                    : bucket.failureRate * 100,
                ),
                connectNulls: false,
                showSymbol: true,
                symbolSize: 5,
                lineStyle: { width: 2 },
                itemStyle: { color: CHART_COLORS.failed },
              },
            ]
          : [
              {
                type: "bar",
                stack: "orders",
                name: "Completed",
                data: buckets.map((bucket) => bucket.completed),
                itemStyle: { color: CHART_COLORS.completed },
                barMaxWidth: 24,
              },
              {
                type: "bar",
                stack: "orders",
                name: "Failed",
                data: buckets.map((bucket) => bucket.failed),
                itemStyle: { color: CHART_COLORS.failed },
                barMaxWidth: 24,
              },
              {
                type: "bar",
                stack: "orders",
                name: "Other outcomes",
                data: buckets.map((bucket) => bucket.other),
                itemStyle: { color: CHART_COLORS.unknown },
                barMaxWidth: 24,
              },
            ],
    }),
    [buckets, measure, theme],
  );
  const select = (index: number) => {
    const bucket = buckets[index];
    if (bucket?.orders.length)
      inspect(
        "Placement cohort",
        bucket.orders,
        `${range(bucket)}. Current outcomes of orders placed in this interval.`,
      );
  };
  return (
    <div className="space-y-2">
      <ChartPlot
        option={option}
        label={`${measure === "rates" ? "Terminal failure rate" : "Orders by current outcome"}, grouped by placement time in UTC`}
        height={220}
        onSelect={select}
      />
      {measure === "activity" ? (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {(["completed", "failed", "unknown"] as const).map((key) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 rounded-sm"
                style={{ background: CHART_COLORS[key] }}
              />
              {key === "unknown"
                ? "Other outcomes"
                : key === "completed"
                  ? "Completed"
                  : "Failed"}
            </span>
          ))}
        </p>
      ) : null}
      <details className="text-xs">
        <summary className="cursor-pointer rounded py-1 text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Chart data & order lists
        </summary>
        <div className="mt-2 max-h-52 overflow-auto rounded">
          <table className="w-full text-left text-[11px] tabular-nums">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr>
                <th scope="col" className="p-2">
                  Interval (UTC)
                </th>
                <th scope="col">Placed</th>
                <th scope="col">Completed</th>
                <th scope="col">Failed</th>
                <th scope="col">Fail %</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((bucket, index) => (
                <tr key={bucket.timestamp} className="border-t border-border">
                  <th scope="row" className="p-2 text-left font-normal">
                    <button
                      type="button"
                      disabled={!bucket.orders.length}
                      className="rounded text-left enabled:text-link enabled:hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground"
                      onClick={() => select(index)}
                    >
                      {range(bucket)}
                    </button>
                  </th>
                  <td>{bucket.orders.length}</td>
                  <td>{bucket.completed}</td>
                  <td>{bucket.failed}</td>
                  <td>{rate(bucket.failureRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
