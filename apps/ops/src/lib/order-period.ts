export const ORDER_PERIODS = [
  { label: "Last 24 hours", value: "1" },
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "All available history", value: "all" },
] as const;

export function isOrderPeriod(
  value: unknown,
): value is (typeof ORDER_PERIODS)[number]["value"] {
  return ORDER_PERIODS.some((option) => option.value === value);
}

export function orderPeriodDuration(days = 7): string {
  return days === 1 ? "24 hours" : `${days} days`;
}

export function orderPeriodRange(period = "7"): string {
  return period === "all"
    ? "all available history"
    : `the last ${orderPeriodDuration(Number(period))}`;
}
