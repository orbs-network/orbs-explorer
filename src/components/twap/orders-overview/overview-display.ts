import type { OverviewOrderStatus } from "@/lib/twap/utils/orders-overview";

export const STATUS_COLORS: Record<OverviewOrderStatus, string> = {
  completed: "text-emerald-700 dark:text-emerald-400",
  partial: "text-amber-700 dark:text-amber-400",
  active: "text-sky-700 dark:text-sky-400",
  cancelled: "text-muted-foreground",
  expired: "text-muted-foreground",
  failed: "text-destructive",
  unknown: "text-muted-foreground",
};
export const formatOrderUsd = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
