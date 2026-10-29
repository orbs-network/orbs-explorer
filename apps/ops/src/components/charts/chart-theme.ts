"use client";

import { useTheme } from "next-themes";
import { CHART_COLORS } from "./chart-colors";

const themes = {
  dark: {
    text: "#f6f6f6",
    muted: "#c5c5c5",
    grid: "#29292b",
    border: "#414142",
    surface: "#29292b",
    background: "#121214",
    primary: "#7a89e9",
    outcomes: CHART_COLORS.dark,
  },
  light: {
    text: "#121214",
    muted: "#59595a",
    grid: "#eeeeef",
    border: "#e2e2e2",
    surface: "#ffffff",
    background: "#f6f6f6",
    primary: "#3346f2",
    outcomes: CHART_COLORS.light,
  },
};

export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? themes.dark : themes.light;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });

/** Service labels are text, even inside an ECharts HTML tooltip. */
export function chartTooltip(
  title: string,
  rows: { label: string; value: string; color?: string }[],
  footer?: string,
) {
  return `<div class="w-[min(18rem,calc(100vw-3rem))] overflow-hidden rounded-xl text-popover-foreground">
    <div class="border-b border-border px-3.5 py-3 text-xs font-semibold">${escapeHtml(title)}</div>
    <div class="space-y-2 px-3.5 py-3">${rows
      .map((row) => {
        const color =
          row.color && /^#[\da-f]{3,8}$/i.test(row.color)
            ? row.color
            : undefined;
        return `<div class="flex items-center justify-between gap-5 text-xs"><span class="flex min-w-0 items-center gap-2 text-muted-foreground">${color ? `<span aria-hidden="true" style="background:${color};width:7px;height:7px;border-radius:2px;flex-shrink:0"></span>` : ""}<span class="whitespace-normal">${escapeHtml(row.label)}</span></span><strong class="shrink-0 text-right font-semibold tabular-nums">${escapeHtml(row.value)}</strong></div>`;
      })
      .join("")}</div>
    ${footer ? `<div class="whitespace-normal border-t border-border px-3.5 py-2.5 text-[10px] leading-relaxed text-muted-foreground">${escapeHtml(footer)}</div>` : ""}
  </div>`;
}
