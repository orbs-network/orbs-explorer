"use client";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@orbs/ui/controls/table";

import { Button } from "@orbs/ui/controls/button";
import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { ListOrder } from "@orbs/domain/twap/types";
import { OVERVIEW_STATUSES } from "@orbs/domain/twap/utils/orders-overview";
import {
  CHART_STATUSES,
  type OrderChartBucket,
  type OrderChartData,
} from "@/lib/order-charts";
import { reportedNumber } from "@/lib/order-diagnostics";
import {
  formatOrderUsd,
  formatShare,
} from "@/components/orders-overview/overview-display";
import { ChartPlot } from "./chart-plot";
import { chartTooltip, useChartTheme } from "./chart-theme";

type ChartTheme = ReturnType<typeof useChartTheme>;
export type TimelineSelection = (label: string, orders: ListOrder[]) => void;

export function reportedUsdCount(bucket: OrderChartBucket): number {
  return bucket.orders.filter(
    (order) => reportedNumber(order.totalUSDAmount) !== undefined,
  ).length;
}

export function timelineBucketTitle(
  bucket: OrderChartBucket,
  interval: OrderChartData["interval"],
): string {
  const date = new Intl.DateTimeFormat(undefined, {
    month: interval === "month" ? "long" : "short",
    ...(interval === "month" ? {} : { day: "numeric" }),
    year: "numeric",
    timeZone: "UTC",
  }).format(bucket.timestamp);
  return `${interval === "week" ? "Week of " : ""}${date} · UTC${bucket.partialPeriod ? " · Partial period" : ""}`;
}

function tooltipIndex(params: unknown): number | undefined {
  const point: unknown = Array.isArray(params) ? params[0] : params;
  if (!point || typeof point !== "object" || !("dataIndex" in point)) return;
  return typeof point.dataIndex === "number" ? point.dataIndex : undefined;
}

export function timelineTooltip(
  data: OrderChartData,
  params: unknown,
  kind: "activity" | "value" | "errors",
  colors: ChartTheme["outcomes"],
): string {
  const index = tooltipIndex(params);
  const bucket = index === undefined ? undefined : data.buckets[index];
  if (!bucket) return "";
  const title = timelineBucketTitle(bucket, data.interval);
  const priced = reportedUsdCount(bucket);
  const value =
    priced || !bucket.total
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 2,
        }).format(bucket.value)
      : "Not reported";
  const coverage = `${priced.toLocaleString()}/${bucket.total.toLocaleString()} orders reporting USD`;
  const partial = bucket.partialPeriod
    ? ` Partial period: ${new Date(bucket.coverageStart).toISOString()} to ${new Date(bucket.coverageEnd).toISOString()}.`
    : "";
  if (kind === "value")
    return chartTooltip(
      title,
      [
        { label: "Reported placed value", value },
        { label: "Orders placed", value: bucket.total.toLocaleString() },
      ],
      `${coverage}. Original order sizes, not executed volume.${partial}`,
    );
  if (kind === "errors")
    return chartTooltip(
      title,
      [
        {
          label: "With error history",
          value: `${bucket.withErrors.toLocaleString()} · ${formatShare(bucket.withErrors, bucket.total)}`,
          color: colors.partial,
        },
        {
          label: "Terminal failures",
          value: `${bucket.failed.toLocaleString()} · ${formatShare(bucket.failed, bucket.total)}`,
          color: colors.failed,
        },
        { label: "Orders placed", value: bucket.total.toLocaleString() },
      ],
      `Grouped by placement date, not error occurrence time. Error history includes recovered orders; these series can overlap.${partial}`,
    );
  return chartTooltip(
    title,
    [
      { label: "Orders placed", value: bucket.total.toLocaleString() },
      ...CHART_STATUSES.filter((status) => bucket[status] > 0).map(
        (status) => ({
          label: OVERVIEW_STATUSES[status].label,
          value: `${bucket[status].toLocaleString()} · ${formatShare(bucket[status], bucket.total)}`,
          color: colors[status],
        }),
      ),
      { label: "Reported placed value", value },
    ],
    `${coverage}. Outcomes reflect the latest snapshot.${partial}`,
  );
}

export function timelineAxes(
  data: OrderChartData,
  theme: ChartTheme,
  valueAxis = false,
): EChartsOption {
  const zoomable = data.buckets.length > 30;
  return {
    grid: {
      top: 18,
      right: 10,
      left: 4,
      bottom: zoomable ? 58 : 14,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
        label: { backgroundColor: theme.surface, color: theme.text },
        lineStyle: { color: theme.border, type: "dashed" },
        crossStyle: { color: theme.border, type: "dashed" },
      },
    },
    xAxis: {
      type: "category",
      data: data.buckets.map(
        (bucket) => `${bucket.label}${bucket.partialPeriod ? " *" : ""}`,
      ),
      boundaryGap: true,
      axisLine: { lineStyle: { color: theme.border } },
      axisTick: { show: false },
      axisLabel: {
        color: theme.muted,
        fontSize: 10,
        margin: 13,
        hideOverlap: true,
        showMinLabel: true,
        showMaxLabel: true,
      },
    },
    yAxis: {
      type: "value",
      min: 0,
      minInterval: valueAxis ? undefined : 1,
      splitNumber: 4,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: theme.grid, type: "dashed" } },
      axisLabel: {
        color: theme.muted,
        fontSize: 10,
        hideOverlap: true,
        formatter: (value: number) =>
          valueAxis
            ? formatOrderUsd(value)
            : new Intl.NumberFormat(undefined, {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(value),
      },
    },
    ...(zoomable
      ? {
          dataZoom: [
            {
              type: "slider" as const,
              start: 0,
              end: 100,
              bottom: 0,
              height: 20,
              showDetail: false,
              brushSelect: false,
              borderColor: theme.border,
              backgroundColor: theme.background,
              fillerColor: `${theme.primary}20`,
              handleStyle: { color: theme.surface, borderColor: theme.primary },
              dataBackground: {
                lineStyle: { color: theme.muted, opacity: 0.2 },
                areaStyle: { color: theme.muted, opacity: 0.08 },
              },
              selectedDataBackground: {
                lineStyle: { color: theme.primary, opacity: 0.5 },
                areaStyle: { color: theme.primary, opacity: 0.15 },
              },
            },
          ],
        }
      : {}),
  };
}

export function PlacementActivityPlot({
  data,
  onSelect,
  height = 300,
}: {
  data: OrderChartData;
  onSelect: TimelineSelection;
  height?: number;
}) {
  const theme = useChartTheme();
  const option = useMemo<EChartsOption>(() => {
    const statuses = CHART_STATUSES.filter((status) =>
      data.buckets.some((bucket) => bucket[status] > 0),
    );
    const topStatuses = data.buckets.map((bucket) =>
      statuses.findLast((status) => bucket[status] > 0),
    );
    return {
      ...timelineAxes(data, theme),
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
          shadowStyle: { color: `${theme.primary}0d` },
        },
        formatter: (params: unknown) =>
          timelineTooltip(data, params, "activity", theme.outcomes),
      },
      series: statuses.map((status) => ({
        name: OVERVIEW_STATUSES[status].label,
        type: "bar",
        stack: "orders",
        barMaxWidth: 42,
        barCategoryGap: "30%",
        itemStyle: { color: theme.outcomes[status] },
        emphasis: {
          itemStyle: {
            borderColor: theme.surface,
            borderWidth: 1,
            shadowBlur: 8,
            shadowColor: `${theme.outcomes[status]}30`,
          },
        },
        data: data.buckets.map((bucket, index) => ({
          value: bucket[status],
          itemStyle: {
            borderRadius: topStatuses[index] === status ? [4, 4, 0, 0] : 0,
          },
        })),
      })),
    };
  }, [data, theme]);
  return (
    <>
      <ChartPlot
        option={option}
        label="Orders placed over time in UTC, stacked by current outcome; partial periods marked with an asterisk"
        height={height}
        onSelect={(index) => {
          const bucket = data.buckets[index];
          if (bucket?.total) onSelect(`${bucket.label} UTC`, bucket.orders);
        }}
      />
      {data.buckets.some((bucket) => bucket.partialPeriod) && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          * Partial period at the start or end of the placement range.
        </p>
      )}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
        {CHART_STATUSES.filter((status) =>
          data.buckets.some((bucket) => bucket[status] > 0),
        ).map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-sm"
              style={{ background: theme.outcomes[status] }}
            />
            {OVERVIEW_STATUSES[status].label}
          </li>
        ))}
      </ul>
    </>
  );
}

export function TimelineDataTable({
  data,
  onSelect,
}: {
  data: OrderChartData;
  onSelect: TimelineSelection;
}) {
  return (
    <details className="mt-4 border-t border-border pt-3 text-xs">
      <summary className="cursor-pointer rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        View timeline data
      </summary>
      <div className="mt-3 max-h-72 overflow-auto">
        <Table
          containerProps={{ className: "overflow-visible" }}
          className="w-full text-left tabular-nums"
        >
          <TableCaption className="sr-only">
            Timeline totals in UTC; select a period to inspect its orders
          </TableCaption>
          <TableHeader>
            <TableRow>
              {[
                "Period (UTC)",
                "Orders",
                "Placed value",
                "Reporting USD",
                "With errors",
                "Failed",
              ].map((label) => (
                <TableHead
                  scope="col"
                  key={label}
                  className="whitespace-nowrap px-2 py-2 font-medium text-muted-foreground"
                >
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.buckets.map((bucket) => {
              const priced = reportedUsdCount(bucket);
              return (
                <TableRow
                  key={bucket.timestamp}
                  className="border-t border-border"
                >
                  <TableHead scope="row" className="px-2 py-2 font-normal">
                    <Button
                      variant="ghost"
                      size="content"
                      type="button"
                      disabled={!bucket.total}
                      onClick={() =>
                        onSelect(`${bucket.label} UTC`, bucket.orders)
                      }
                      className="whitespace-nowrap rounded text-link enabled:hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground"
                    >
                      {bucket.label}
                      {bucket.partialPeriod ? " · Partial" : ""}
                    </Button>
                  </TableHead>
                  <TableCell className="px-2 py-2">
                    {bucket.total.toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-2 py-2">
                    {priced || !bucket.total
                      ? formatOrderUsd(bucket.value)
                      : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                    {priced.toLocaleString()}/{bucket.total.toLocaleString()}
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    {bucket.withErrors.toLocaleString()}
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    {bucket.failed.toLocaleString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </details>
  );
}
