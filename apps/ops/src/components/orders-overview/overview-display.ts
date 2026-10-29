import type { OverviewOrderStatus } from "@orbs/domain/twap/utils/orders-overview";

export const STATUS_COLORS: Record<OverviewOrderStatus, string> = {
  completed: "text-success",
  partial: "text-warning",
  active: "text-link",
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

export function formatOrderDate(value: string | number | undefined) {
  const date = value === undefined ? new Date(NaN) : new Date(value);
  return Number.isFinite(date.getTime()) && Number(date) > 0
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date) +
        " " +
        (new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
          .formatToParts(date)
          .find((part) => part.type === "timeZoneName")?.value ?? "")
    : "Not provided";
}

export const formatShare = (count: number, total: number) =>
  total
    ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format((count / total) * 100)}%`
    : "—";
