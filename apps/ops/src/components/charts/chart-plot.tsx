"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { init, use as registerCharts, type EChartsType } from "echarts/core";
import { BarChart, HeatmapChart, LineChart, PieChart } from "echarts/charts";
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { LegacyGridContainLabel } from "echarts/features";
import type { EChartsOption } from "echarts";
import { useChartTheme } from "./chart-theme";

registerCharts([
  BarChart,
  HeatmapChart,
  LineChart,
  PieChart,
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
  SVGRenderer,
  LegacyGridContainLabel,
]);

export type ChartOption = EChartsOption;

const subscribeMotion = (notify: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const serverMotion = () => true;

function applyOptions(
  instance: EChartsType,
  option: EChartsOption,
  element: HTMLElement,
) {
  instance.setOption(
    {
      ...option,
      textStyle: {
        ...option.textStyle,
        // ECharts measures SVG text with a canvas; CSS "inherit" is not a canvas font.
        fontFamily: getComputedStyle(element).fontFamily,
      },
    },
    { notMerge: true },
  );
}

export function ChartPlot({
  option,
  label,
  height = 300,
  className = "",
  onSelect,
}: {
  option: EChartsOption;
  label: string;
  height?: number;
  className?: string;
  onSelect?: (dataIndex: number, seriesIndex: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<EChartsType | null>(null);
  const select = useRef(onSelect);
  const keyboardIndex = useRef(-1);
  const instructionsId = useId();
  const theme = useChartTheme();
  const reduce = useSyncExternalStore(
    subscribeMotion,
    reducedMotion,
    serverMotion,
  );
  const options = useMemo<EChartsOption>(() => {
    const tooltip = {
      confine: true,
      transitionDuration: reduce ? 0 : 0.12,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 0,
      padding: 0,
      textStyle: { color: theme.text, fontFamily: "inherit" },
      extraCssText:
        "border-radius:12px;box-shadow:0 12px 36px -8px rgb(0 0 0 / 28%);pointer-events:none;z-index:40;",
    };
    return {
      ...option,
      backgroundColor: "transparent",
      animation: !reduce && option.animation !== false,
      animationDuration: 400,
      animationDurationUpdate: 250,
      textStyle: {
        fontFamily: "inherit",
        color: theme.text,
        fontSize: 11,
        ...option.textStyle,
      },
      tooltip: Array.isArray(option.tooltip)
        ? option.tooltip.map((item) => ({ ...tooltip, ...item }))
        : { ...tooltip, ...option.tooltip },
      aria: {
        ...option.aria,
        enabled: true,
        label: { enabled: true, description: label },
      },
    };
  }, [option, label, theme, reduce]);
  const latestOptions = useRef(options);

  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    latestOptions.current = options;
    keyboardIndex.current = -1;
    if (chart.current && container.current)
      applyOptions(chart.current, options, container.current);
  }, [options]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let frame = 0;
    const resize = () => {
      if (!element.clientWidth || !element.clientHeight) return;
      if (!chart.current) {
        const instance = init(element, undefined, { renderer: "svg" });
        chart.current = instance;
        instance.on("click", (event) => {
          if (
            event.componentType === "series" &&
            typeof event.dataIndex === "number"
          ) {
            select.current?.(
              event.dataIndex,
              typeof event.seriesIndex === "number" ? event.seriesIndex : 0,
            );
          }
        });
        instance.on("datazoom", () => {
          keyboardIndex.current = -1;
        });
        applyOptions(instance, latestOptions.current, element);
      } else chart.current.resize();
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(resize);
    });
    observer.observe(element);
    resize();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      chart.current?.dispatchAction({ type: "hideTip" });
      chart.current?.dispatchAction({ type: "downplay" });
      return;
    }
    if (!onSelect) return;
    const series = Array.isArray(option.series)
      ? option.series[0]
      : option.series;
    const count =
      series && "data" in series && Array.isArray(series.data)
        ? series.data.length
        : 0;
    if (!count) return;
    const zooms: unknown = chart.current?.getOption().dataZoom;
    const zoom: unknown = Array.isArray(zooms) ? zooms[0] : undefined;
    const categoryAxis = Array.isArray(option.xAxis)
      ? option.xAxis[0]
      : option.xAxis;
    const categories =
      categoryAxis && "data" in categoryAxis && Array.isArray(categoryAxis.data)
        ? categoryAxis.data
        : [];
    const bound = (value: unknown, percent: unknown, fallback: number) => {
      if (typeof value === "number" && Number.isFinite(value))
        return Math.max(0, Math.min(count - 1, Math.round(value)));
      if (typeof value === "string") {
        const match = categories.indexOf(value);
        if (match >= 0) return match;
      }
      return typeof percent === "number" && Number.isFinite(percent)
        ? Math.max(
            0,
            Math.min(count - 1, Math.round((percent / 100) * (count - 1))),
          )
        : fallback;
    };
    // The public zoom window uses raw category values; keyboard selection follows
    // the visible window while click dataIndex already refers to the raw data.
    const zoomWindow =
      zoom && typeof zoom === "object" ? (zoom as Record<string, unknown>) : {};
    const first = bound(zoomWindow.startValue, zoomWindow.start, 0);
    const last = Math.max(
      first,
      bound(zoomWindow.endValue, zoomWindow.end, count - 1),
    );
    let index = keyboardIndex.current;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      index = index < first || index > last ? first : Math.min(last, index + 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      index = index < first || index > last ? last : Math.max(first, index - 1);
    else if (event.key === "Home") index = first;
    else if (event.key === "End") index = last;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(Math.max(first, Math.min(last, index)), 0);
      return;
    } else return;
    event.preventDefault();
    keyboardIndex.current = index;
    chart.current?.dispatchAction({ type: "downplay" });
    chart.current?.dispatchAction({
      type: "highlight",
      seriesIndex: 0,
      dataIndex: index,
    });
    chart.current?.dispatchAction({
      type: "showTip",
      seriesIndex: 0,
      dataIndex: index,
    });
  };

  return (
    <>
      <div
        ref={container}
        role="img"
        aria-label={label}
        aria-describedby={onSelect ? instructionsId : undefined}
        tabIndex={onSelect ? 0 : undefined}
        onKeyDown={onKeyDown}
        onBlur={() => {
          chart.current?.dispatchAction({ type: "hideTip" });
          chart.current?.dispatchAction({ type: "downplay" });
        }}
        data-chart-engine="echarts"
        className={`min-w-0 w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${className}`}
        style={{ height }}
      />
      {onSelect && (
        <p id={instructionsId} className="sr-only">
          Use the arrow keys to explore data, then press Enter to inspect
          orders. A data list is also available below the chart.
        </p>
      )}
    </>
  );
}
