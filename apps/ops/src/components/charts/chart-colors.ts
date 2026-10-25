import type { OverviewOrderStatus } from "@orbs/domain/twap/utils/orders-overview";

// Orbs hues with enough contrast for thin series on both light and dark cards.
// Shared by charts and legends so each outcome keeps the same meaning.
export const CHART_COLORS: Record<OverviewOrderStatus, string> = {
  completed: "#017d86",
  partial: "#a153a6",
  active: "#5c6ff4",
  cancelled: "#858586",
  expired: "#a17ae9",
  failed: "#bd7778",
  unknown: "#626eba",
};
