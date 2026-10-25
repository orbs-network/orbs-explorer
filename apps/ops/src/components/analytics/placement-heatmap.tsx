"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { ChartPlot } from "@/components/charts/chart-plot";
import { chartTooltip, useChartTheme } from "@/components/charts/chart-theme";
import { buildPlacementHeatmap, UTC_WEEKDAYS } from "@/lib/market-analytics";
import { useOperationsData } from "@/components/operations/operations-view";
import { Panel } from "@/components/operations/primitives";
import { inspectClass } from "./analytics-labels";

export function PlacementHeatmap() {
  const { orders, updatedAt, inspectOrders } = useOperationsData();
  const data = useMemo(
    () => buildPlacementHeatmap(orders, updatedAt),
    [orders, updatedAt],
  );
  const theme = useChartTheme();
  const peak = [...data.cells].sort(
    (a, b) => b.orders.length - a.orders.length,
  )[0];
  const inspectCell = (index: number) => {
    const cell = data.cells[index];
    if (!cell?.orders.length) return;
    inspectOrders(
      `${UTC_WEEKDAYS[cell.day]} · ${cell.hour.toString().padStart(2, "0")}:00 UTC placements`,
      cell.orders,
      "Grouped by order placement time in UTC across the selected period.",
    );
  };
  const option: EChartsOption = {
    grid: { top: 12, right: 5, bottom: 60, left: 0, containLabel: true },
    xAxis: {
      type: "category",
      data: Array.from({ length: 24 }, (_, hour) =>
        hour.toString().padStart(2, "0"),
      ),
      axisLabel: { interval: 2, color: theme.muted, fontSize: 10 },
      axisTick: { show: false },
      axisLine: { show: false },
      splitArea: { show: false },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: UTC_WEEKDAYS.map((day) => day.slice(0, 3)),
      axisLabel: { color: theme.muted, fontSize: 11 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    visualMap: {
      min: 0,
      max: Math.max(1, data.maximum),
      orient: "horizontal",
      left: "center",
      bottom: 0,
      itemWidth: 12,
      itemHeight: 95,
      text: ["More orders", "Fewer orders"],
      textStyle: { color: theme.muted, fontSize: 10 },
      inRange: { color: [theme.surface, theme.primary] },
      calculable: false,
    },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        const entry = Array.isArray(params) ? params[0] : params;
        const cell = data.cells[entry.dataIndex];
        if (!cell) return "";
        return chartTooltip(
          `${UTC_WEEKDAYS[cell.day]} · ${cell.hour.toString().padStart(2, "0")}:00–${cell.hour.toString().padStart(2, "0")}:59 UTC`,
          [
            {
              label: "Orders placed",
              value: cell.orders.length.toLocaleString(),
            },
          ],
          cell.orders.length
            ? "Select to inspect these placements."
            : "No orders placed in this UTC hour.",
        );
      },
    },
    series: [
      {
        type: "heatmap",
        data: data.cells.map((cell) => [
          cell.hour,
          cell.day,
          cell.orders.length,
        ]),
        itemStyle: {
          borderColor: theme.background,
          borderWidth: 3,
          borderRadius: 3,
        },
        emphasis: { itemStyle: { borderColor: theme.text, borderWidth: 1 } },
        label: { show: false },
        cursor: "pointer",
      },
    ],
  };
  return (
    <Panel
      title="When orders are placed · UTC"
      description="Weekday × hour aggregates placement timestamps across the selected period. Stronger color indicates more orders. Select a nonempty cell to inspect its orders."
    >
      <ChartPlot
        option={option}
        label="Order placements by UTC weekday and hour"
        height={310}
        onSelect={inspectCell}
      />
      <details className="mt-3 rounded-lg bg-muted/40 px-3 py-2.5">
        <summary className="cursor-pointer rounded text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          View hourly data and inspect orders
        </summary>
        <div
          className="mt-3 max-h-72 overflow-auto rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          tabIndex={0}
          role="region"
          aria-label="UTC placement data"
        >
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              Order placements for each weekday and UTC hour
            </caption>
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr>
                <th scope="col" className="px-2 py-2 font-medium">
                  UTC placement hour
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Orders
                </th>
              </tr>
            </thead>
            <tbody>
              {data.cells.map((cell, index) => (
                <tr
                  key={`${cell.day}-${cell.hour}`}
                  className="border-t border-border/50"
                >
                  <th scope="row" className="px-2 py-2 font-normal">
                    {UTC_WEEKDAYS[cell.day]}{" "}
                    {cell.hour.toString().padStart(2, "0")}:00–
                    {cell.hour.toString().padStart(2, "0")}:59
                  </th>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      disabled={!cell.orders.length}
                      className={inspectClass}
                      aria-label={`Inspect ${cell.orders.length.toLocaleString()} orders placed ${UTC_WEEKDAYS[cell.day]} ${cell.hour.toString().padStart(2, "0")}:00 UTC`}
                      onClick={() => inspectCell(index)}
                    >
                      {cell.orders.length.toLocaleString()}
                      {cell.orders.length ? " →" : ""}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {data.included.toLocaleString()} / {orders.length.toLocaleString()}{" "}
          orders have usable placement times.
          {data.excluded.length > 0 && (
            <>
              {" "}
              <button
                type="button"
                className={inspectClass}
                onClick={() =>
                  inspectOrders(
                    "Orders excluded from UTC placement heatmap",
                    data.excluded,
                    "Placement timestamp is missing, invalid, or after the current data snapshot.",
                  )
                }
              >
                Inspect {data.excluded.length.toLocaleString()} excluded →
              </button>
            </>
          )}
        </span>
        {data.maximum > 0 && (
          <button
            type="button"
            className={inspectClass}
            onClick={() =>
              inspectOrders("Busiest UTC placement hour", peak.orders)
            }
          >
            Peak: {UTC_WEEKDAYS[peak.day].slice(0, 3)}{" "}
            {peak.hour.toString().padStart(2, "0")}:00 UTC ·{" "}
            {peak.orders.length.toLocaleString()} orders →
          </button>
        )}
      </div>
    </Panel>
  );
}
