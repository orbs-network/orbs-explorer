"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { OrderChartData } from "@/lib/order-charts";
import { ChartFrame } from "./chart-frame";
import { ChartPlot } from "./chart-plot";
import { useChartTheme } from "./chart-theme";
import { CHART_COLORS } from "./chart-colors";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  InvestigationSelect,
  InvestigationSelectItem,
} from "@/components/investigation/investigation-controls";
import {
  PlacementActivityPlot,
  TimelineDataTable,
  reportedUsdCount,
  timelineAxes,
  timelineTooltip,
  type TimelineSelection,
} from "./timeline-plot";

export function TimelineCharts({
  data,
  onSelect,
}: {
  data: OrderChartData;
  onSelect: TimelineSelection;
}) {
  const theme = useChartTheme();
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requestedMetric = search.get("timeline_view");
  const metric =
    requestedMetric === "value" || requestedMetric === "errors"
      ? requestedMetric
      : "activity";
  const requestedInterval = search.get("chart_interval");
  const interval =
    requestedInterval === "month" ||
    (requestedInterval === "day" && data.spanDays <= 730) ||
    (requestedInterval === "week" && data.spanDays <= 5_110)
      ? requestedInterval
      : "auto";
  const update = (param: string, value: string, fallback: string) => {
    const next = new URLSearchParams(search.toString());
    if (value === fallback) next.delete(param);
    else next.set(param, value);
    router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const utcTime = (timestamp: number) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(timestamp);
  const valueOption = useMemo<EChartsOption>(() => {
    const axes = timelineAxes(data, theme, true);
    return {
      ...axes,
      tooltip: {
        ...axes.tooltip,
        formatter: (params: unknown) => timelineTooltip(data, params, "value"),
      },
      series: [
        {
          type: "line",
          name: "Reported placed value",
          data: data.buckets.map((bucket) =>
            bucket.total && !reportedUsdCount(bucket) ? null : bucket.value,
          ),
          connectNulls: false,
          symbol: "circle",
          symbolSize: 6,
          showSymbol: data.buckets.length < 10,
          lineStyle: { width: 2.5, color: theme.primary },
          itemStyle: { color: theme.primary },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${theme.primary}38` },
                { offset: 1, color: `${theme.primary}00` },
              ],
            },
          },
          emphasis: { scale: 1.6 },
        },
      ],
    };
  }, [data, theme]);
  const errorsOption = useMemo<EChartsOption>(() => {
    const axes = timelineAxes(data, theme);
    return {
      ...axes,
      tooltip: {
        ...axes.tooltip,
        formatter: (params: unknown) => timelineTooltip(data, params, "errors"),
      },
      series: [
        {
          type: "line",
          name: "With error history",
          data: data.buckets.map((bucket) => bucket.withErrors),
          symbol: "circle",
          symbolSize: 6,
          showSymbol: data.buckets.length < 10,
          itemStyle: { color: CHART_COLORS.partial },
          lineStyle: { color: CHART_COLORS.partial, width: 2.5 },
          emphasis: { scale: 1.6 },
        },
        {
          type: "line",
          name: "Terminal failures",
          data: data.buckets.map((bucket) => bucket.failed),
          symbol: "circle",
          symbolSize: 6,
          showSymbol: data.buckets.length < 10,
          itemStyle: { color: CHART_COLORS.failed },
          lineStyle: {
            color: CHART_COLORS.failed,
            width: 2,
            type: "dashed",
          },
          emphasis: { scale: 1.6 },
        },
      ],
    };
  }, [data, theme]);
  return (
    <div className="space-y-4">
      <ChartFrame
        action={
          <div className="flex flex-wrap items-center gap-2 [&>div]:w-44">
            <InvestigationSelect
              label="Metric"
              compact
              value={metric}
              onChange={(value) => update("timeline_view", value, "activity")}
            >
              <InvestigationSelectItem value="activity">
                Orders placed
              </InvestigationSelectItem>
              <InvestigationSelectItem value="value">
                Placed value (USD)
              </InvestigationSelectItem>
              <InvestigationSelectItem value="errors">
                Orders with errors
              </InvestigationSelectItem>
            </InvestigationSelect>
            <InvestigationSelect
              label="Time interval"
              compact
              value={interval}
              onChange={(value) => update("chart_interval", value, "auto")}
            >
              <InvestigationSelectItem value="auto">
                Automatic ({data.interval})
              </InvestigationSelectItem>
              <InvestigationSelectItem
                value="day"
                disabled={data.spanDays > 730}
              >
                Daily
              </InvestigationSelectItem>
              <InvestigationSelectItem
                value="week"
                disabled={data.spanDays > 5_110}
              >
                Weekly
              </InvestigationSelectItem>
              <InvestigationSelectItem value="month">
                Monthly
              </InvestigationSelectItem>
            </InvestigationSelect>
          </div>
        }
        title={
          metric === "value"
            ? "Placed order value · UTC"
            : metric === "errors"
              ? "Orders with error history · UTC"
              : "Orders placed · UTC"
        }
        description={
          metric === "value"
            ? `Original reported order sizes in USD per ${data.interval}. Unreported USD appears as gaps; this is not executed trading volume.`
            : metric === "errors"
              ? `Error history and terminal failures in each placement ${data.interval}. This is a placement cohort, not the time errors occurred; the series can overlap.`
              : `Orders placed per ${data.interval}, stacked by current outcome. Select a bar or data row to inspect orders.`
        }
      >
        {metric === "activity" ? (
          <PlacementActivityPlot data={data} onSelect={onSelect} height={320} />
        ) : (
          <ChartPlot
            option={metric === "value" ? valueOption : errorsOption}
            label={
              metric === "value"
                ? "Reported placed order value by UTC placement time; partial periods marked with an asterisk and unreported USD appears as gaps"
                : "Orders with error history and terminal failures by UTC placement time, not error occurrence time; partial periods marked with an asterisk"
            }
            height={300}
          />
        )}
        {metric === "errors" && (
          <p className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-0.5 w-3"
                style={{ background: CHART_COLORS.partial }}
              />
              Error history
            </span>
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="w-3 border-t-2 border-dashed"
                style={{ borderColor: CHART_COLORS.failed }}
              />
              Terminal failures
            </span>
          </p>
        )}
        <TimelineDataTable data={data} onSelect={onSelect} />
      </ChartFrame>
    </div>
  );
}
