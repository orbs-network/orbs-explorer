"use client";

import { useId, useMemo, useOptimistic, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { EChartsOption } from "echarts";
import { ArrowUpRight } from "lucide-react";
import {
  OVERVIEW_STATUSES,
  type OverviewOrderStatus,
} from "@orbs/domain/twap/utils/orders-overview";
import { usePartner } from "@orbs/domain/hooks/use-partner";
import { Avatar, AvatarFallback, AvatarImage } from "@orbs/ui/controls/avatar";
import { NetworkIcon } from "@orbs/ui/controls/network";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orbs/ui/controls/select";
import { ChartPlot } from "@/components/charts/chart-plot";
import { CHART_COLORS } from "@/components/charts/chart-colors";
import { chartTooltip, useChartTheme } from "@/components/charts/chart-theme";
import {
  tradingAppOrdersHref,
  type TradingAppGrouping,
  type TradingAppRow,
} from "@/lib/trading-apps-table";
import { formatOrderUsd, formatShare, STATUS_COLORS } from "./overview-display";

type ChartMetric = "outcomes" | "failure-rate" | "value";
const METRIC_QUERY = "app_chart_metric";
const VISIBLE_ROWS = 12;
const outcomes: OverviewOrderStatus[] = [
  "completed",
  "partial",
  "active",
  "failed",
  "expired",
  "cancelled",
  "unknown",
];
const metrics: Record<ChartMetric, { label: string; title: string }> = {
  outcomes: { label: "Current outcomes", title: "Orders by current outcome" },
  "failure-rate": {
    label: "Failure rate",
    title: "Failed orders / placed orders",
  },
  value: { label: "Placed value", title: "Reported placed value" },
};
const compactCount = (value: number) =>
  new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
const exactUsd = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
const rowLabel = (row: TradingAppRow) =>
  row.chainId === undefined
    ? row.partnerName
    : `${row.partnerName} · ${row.chainName ?? `Chain ${row.chainId}`}`;
const failureRate = (row: TradingAppRow) =>
  formatShare(row.groups.failed.length, row.totalOrders);
const valueLabel = (row: TradingAppRow) =>
  row.pricedOrders ? formatOrderUsd(row.totalUsd) : "Not reported";

function RowIdentity({ row }: { row: TradingAppRow }) {
  const partner = usePartner(row.partnerId);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar aria-hidden className="size-6 shrink-0">
        <AvatarImage src={partner?.logo} alt="" />
        <AvatarFallback className="text-[9px]">
          {row.partnerName.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block break-words font-medium">{row.partnerName}</span>
        {row.chainId !== undefined && (
          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <NetworkIcon
              chainId={row.chainId}
              name={row.chainName}
              className="size-3.5 shrink-0"
            />
            <span className="break-words">
              {row.chainName ?? `Chain ${row.chainId}`}
            </span>
          </span>
        )}
      </span>
    </span>
  );
}

export default function TradingAppsChart({
  rows,
  query,
  grouping,
}: {
  rows: TradingAppRow[];
  query: string;
  grouping: TradingAppGrouping;
}) {
  const theme = useChartTheme();
  const router = useRouter();
  const pathname = usePathname();
  const metricId = useId();
  const value = new URLSearchParams(query).get(METRIC_QUERY);
  const metric: ChartMetric =
    value === "failure-rate" || value === "value" ? value : "outcomes";
  const [displayMetric, setDisplayMetric] = useOptimistic(metric);
  const [, startTransition] = useTransition();
  const displayedOutcomes = outcomes.filter((status) =>
    rows.some((row) => row.groups[status].length > 0),
  );
  const hasValueGaps = rows.some((row) => row.pricedOrders < row.totalOrders);
  const totalOrders = rows.reduce((total, row) => total + row.totalOrders, 0);
  const totalPriced = rows.reduce((total, row) => total + row.pricedOrders, 0);
  const option = useMemo<EChartsOption>(() => {
    const tooltipRows = (row: TradingAppRow) => [
      { label: "Placed orders", value: row.totalOrders.toLocaleString() },
      ...(displayMetric === "outcomes"
        ? outcomes
            .filter((status) => row.groups[status].length > 0)
            .map((status) => ({
              label: OVERVIEW_STATUSES[status].label,
              value: `${row.groups[status].length.toLocaleString()} · ${formatShare(row.groups[status].length, row.totalOrders)}`,
              color: CHART_COLORS[status],
            }))
        : [
            {
              label: "Failed / placed",
              value: `${row.groups.failed.length.toLocaleString()} / ${row.totalOrders.toLocaleString()} · ${failureRate(row)}`,
              color: CHART_COLORS.failed,
            },
          ]),
      {
        label: "Reported placed value",
        value: row.pricedOrders ? exactUsd(row.totalUsd) : "Not reported",
      },
    ];
    return {
      grid: {
        top: 10,
        bottom: 28,
        left: 4,
        right: rows.length > VISIBLE_ROWS ? 40 : 24,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
          shadowStyle: { color: `${theme.muted}0a` },
        },
        formatter: (params: unknown) => {
          const point: unknown = Array.isArray(params) ? params[0] : params;
          const index =
            point &&
            typeof point === "object" &&
            "dataIndex" in point &&
            typeof point.dataIndex === "number"
              ? point.dataIndex
              : -1;
          const row = rows[index];
          return row
            ? chartTooltip(
                rowLabel(row),
                tooltipRows(row),
                `${row.pricedOrders.toLocaleString()}/${row.totalOrders.toLocaleString()} orders report USD.${row.totalOrders > 0 && row.totalOrders < 10 ? " Small sample: fewer than 10 orders." : ""} Select any bar to open this row’s orders.`,
              )
            : "";
        },
      },
      xAxis: {
        type: "value",
        min: 0,
        ...(displayMetric === "failure-rate" ? { max: 100 } : {}),
        minInterval: displayMetric === "outcomes" ? 1 : undefined,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: theme.muted,
          fontSize: 10,
          hideOverlap: true,
          formatter:
            displayMetric === "failure-rate"
              ? "{value}%"
              : displayMetric === "value"
                ? formatOrderUsd
                : compactCount,
        },
        splitLine: { lineStyle: { color: theme.grid, type: "dashed" } },
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: rows.map(rowLabel),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: theme.text,
          fontSize: 11,
          width: grouping === "networks" ? 120 : 96,
          overflow: "truncate",
          margin: 10,
        },
      },
      dataZoom:
        rows.length > VISIBLE_ROWS
          ? [
              {
                type: "slider",
                yAxisIndex: 0,
                startValue: 0,
                endValue: VISIBLE_ROWS - 1,
                filterMode: "none",
                zoomLock: true,
                right: 0,
                width: 12,
                borderColor: theme.border,
                backgroundColor: `${theme.muted}0a`,
                fillerColor: `${theme.primary}22`,
                handleStyle: {
                  color: theme.primary,
                  borderColor: theme.primary,
                },
                showDataShadow: false,
                showDetail: false,
                brushSelect: false,
              },
            ]
          : [],
      series:
        displayMetric === "outcomes"
          ? outcomes.map((status) => ({
              type: "bar" as const,
              name: OVERVIEW_STATUSES[status].label,
              stack: "orders",
              barMaxWidth: 20,
              cursor: "pointer",
              itemStyle: { color: CHART_COLORS[status] },
              emphasis: { focus: "self" as const },
              data: rows.map((row) => row.groups[status].length),
            }))
          : [
              {
                type: "bar" as const,
                name: metrics[displayMetric].label,
                barMaxWidth: 20,
                cursor: "pointer",
                itemStyle: {
                  color:
                    displayMetric === "failure-rate"
                      ? CHART_COLORS.failed
                      : theme.primary,
                  borderRadius: [0, 3, 3, 0],
                },
                data: rows.map((row) =>
                  displayMetric === "failure-rate"
                    ? row.failedRate === undefined
                      ? null
                      : row.failedRate * 100
                    : row.pricedOrders
                      ? row.totalUsd
                      : null,
                ),
              },
            ],
    };
  }, [rows, displayMetric, grouping, theme]);

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold">
            {metrics[displayMetric].title}
          </h3>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label htmlFor={metricId} className="text-xs text-muted-foreground">
            Compare
          </label>
          <Select
            value={displayMetric}
            onValueChange={(next: ChartMetric) => {
              const search = new URLSearchParams(query);
              if (next === "outcomes") search.delete(METRIC_QUERY);
              else search.set(METRIC_QUERY, next);
              startTransition(() => {
                setDisplayMetric(next);
                router.replace(
                  `${pathname}${search.size ? `?${search}` : ""}`,
                  {
                    scroll: false,
                  },
                );
              });
            }}
          >
            <SelectTrigger id={metricId} className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(metrics) as [
                  ChartMetric,
                  (typeof metrics)[ChartMetric],
                ][]
              ).map(([key, item]) => (
                <SelectItem key={key} value={key}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {totalOrders ? (
        <ChartPlot
          option={option}
          height={Math.max(180, Math.min(rows.length, VISIBLE_ROWS) * 34 + 44)}
          label={`${metrics[displayMetric].title} by trading app${grouping === "networks" ? " and network" : ""}. Bar selection opens all orders for that row. Exact values and status links follow in Chart data and order links.`}
          onSelect={(index) => {
            // Every stacked segment and keyboard selection refer to the same
            // row cohort. Status-specific navigation is explicit in the list.
            const row = rows[index];
            if (row?.totalOrders) router.push(tradingAppOrdersHref(row, query));
          }}
        />
      ) : (
        <p className="rounded-lg bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          No orders in this view. Change the filters to compare activity.
        </p>
      )}
      <div className="space-y-2">
        {displayMetric === "outcomes" && displayedOutcomes.length > 0 && (
          <p
            aria-label="Current outcome legend"
            className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground"
          >
            {displayedOutcomes.map((status) => (
              <span key={status} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 rounded-sm"
                  style={{ background: CHART_COLORS[status] }}
                />
                {OVERVIEW_STATUSES[status].label}
              </span>
            ))}
          </p>
        )}
      </div>
      <details className="border-t border-border pt-3 text-xs">
        <summary className="w-fit cursor-pointer rounded py-1 font-medium text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Chart data & order links
        </summary>
        <ul className="mt-2 max-h-96 divide-y divide-border overflow-y-auto overscroll-contain">
          {rows.map((row) => (
            <li
              key={row.rowId}
              className="space-y-2 px-1 py-3 [content-visibility:auto] [contain-intrinsic-size:auto_110px]"
            >
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={tradingAppOrdersHref(row, query)}
                  aria-label={`View ${row.totalOrders.toLocaleString()} orders for ${rowLabel(row)}`}
                  className="min-w-0 rounded-sm hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RowIdentity row={row} />
                </Link>
                <Link
                  href={tradingAppOrdersHref(row, query)}
                  className="flex shrink-0 items-center gap-1 rounded-sm py-2 text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`View all ${row.totalOrders.toLocaleString()} orders for ${rowLabel(row)}`}
                >
                  <span className="tabular-nums">
                    {row.totalOrders.toLocaleString()}
                  </span>{" "}
                  orders
                  <ArrowUpRight aria-hidden className="size-3" />
                </Link>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] tabular-nums">
                {outcomes
                  .filter((status) => row.groups[status].length > 0)
                  .map((status) => (
                    <Link
                      key={status}
                      href={tradingAppOrdersHref(row, query, { status })}
                      className={`rounded-sm py-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${STATUS_COLORS[status]}`}
                    >
                      {row.groups[status].length.toLocaleString()}{" "}
                      {OVERVIEW_STATUSES[status].label.toLowerCase()}
                    </Link>
                  ))}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground tabular-nums">
                Failed {row.groups.failed.length.toLocaleString()}/
                {row.totalOrders.toLocaleString()} · {failureRate(row)}
                {row.totalOrders > 0 && row.totalOrders < 10
                  ? " · Small sample (<10 orders)"
                  : ""}
                <span className="block">
                  Placed value {valueLabel(row)} · USD reported for{" "}
                  {row.pricedOrders.toLocaleString()}/
                  {row.totalOrders.toLocaleString()} orders
                </span>
              </p>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
