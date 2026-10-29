import type { OverviewOrderStatus } from "@orbs/domain/twap/utils/orders-overview";

// Same outcome hues in both modes, with separate shades for readable series.
// Match the semantic colors in globals.css; tooltips and legends use this too.
export const CHART_COLORS: Record<
  "light" | "dark",
  Record<OverviewOrderStatus, string>
> = {
  light: {
    completed: "#017d86",
    partial: "#8b4590",
    active: "#3346f2",
    cancelled: "#59595a",
    expired: "#8165c7",
    failed: "#664344",
    unknown: "#626eba",
  },
  dark: {
    completed: "#2cedfc",
    partial: "#dc8ae0",
    active: "#7a89e9",
    cancelled: "#c5c5c5",
    expired: "#a17ae9",
    failed: "#ffadae",
    unknown: "#95a1ed",
  },
};
