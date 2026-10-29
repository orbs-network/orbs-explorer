"use client";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@orbs/ui/controls/table";

import { Button } from "@orbs/ui/controls/button";
import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { ListOrder } from "@orbs/domain/twap/types";
import type { ActivityBucket } from "@/lib/overview-monitoring";
import { ChartPlot } from "@/components/charts/chart-plot";
import { chartTooltip, useChartTheme } from "@/components/charts/chart-theme";

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
                    color: theme.outcomes.completed,
                  },
                  {
                    label: "Currently failed",
                    value: bucket.failed.toLocaleString(),
                    color: theme.outcomes.failed,
                  },
                  {
                    label: "Other outcomes",
                    value: bucket.other.toLocaleString(),
                    color: theme.outcomes.unknown,
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
                itemStyle: { color: theme.outcomes.failed },
              },
            ]
          : [
              {
                type: "bar",
                stack: "orders",
                name: "Completed",
                data: buckets.map((bucket) => bucket.completed),
                itemStyle: { color: theme.outcomes.completed },
                barMaxWidth: 24,
              },
              {
                type: "bar",
                stack: "orders",
                name: "Failed",
                data: buckets.map((bucket) => bucket.failed),
                itemStyle: { color: theme.outcomes.failed },
                barMaxWidth: 24,
              },
              {
                type: "bar",
                stack: "orders",
                name: "Other outcomes",
                data: buckets.map((bucket) => bucket.other),
                itemStyle: { color: theme.outcomes.unknown },
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
                style={{ background: theme.outcomes[key] }}
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
          <Table
            containerProps={{ className: "overflow-visible" }}
            className="w-full text-left text-[11px] tabular-nums"
          >
            <TableHeader className="sticky top-0 bg-card text-muted-foreground">
              <TableRow>
                <TableHead scope="col" className="p-2">
                  Interval (UTC)
                </TableHead>
                <TableHead scope="col">Placed</TableHead>
                <TableHead scope="col">Completed</TableHead>
                <TableHead scope="col">Failed</TableHead>
                <TableHead scope="col">Fail %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buckets.map((bucket, index) => (
                <TableRow
                  key={bucket.timestamp}
                  className="border-t border-border"
                >
                  <TableHead scope="row" className="p-2 text-left font-normal">
                    <Button
                      variant="ghost"
                      size="content"
                      type="button"
                      disabled={!bucket.orders.length}
                      className="rounded text-left enabled:text-link enabled:hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground"
                      onClick={() => select(index)}
                    >
                      {range(bucket)}
                    </Button>
                  </TableHead>
                  <TableCell>{bucket.orders.length}</TableCell>
                  <TableCell>{bucket.completed}</TableCell>
                  <TableCell>{bucket.failed}</TableCell>
                  <TableCell>{rate(bucket.failureRate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </details>
    </div>
  );
}
