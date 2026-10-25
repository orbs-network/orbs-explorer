import type { ListOrder } from "@orbs/domain/twap/types";
import {
  getOrderValueUsd,
  getOverviewOrderStatus,
  OVERVIEW_STATUSES,
  type OverviewOrderStatus,
} from "@orbs/domain/twap/utils/orders-overview";
import { hasExecutionErrors } from "./order-diagnostics";

const DAY = 86_400_000;
export type ChartInterval = "day" | "week" | "month";
export const CHART_STATUSES = Object.keys(
  OVERVIEW_STATUSES,
) as OverviewOrderStatus[];

function bucketStart(timestamp: number, interval: ChartInterval) {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  if (interval === "month") date.setUTCDate(1);
  if (interval === "week")
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.getTime();
}

function bucketEnd(timestamp: number, interval: ChartInterval) {
  if (interval !== "month")
    return timestamp + (interval === "week" ? 7 : 1) * DAY;
  const date = new Date(timestamp);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.getTime();
}

export type OrderChartBucket = Record<OverviewOrderStatus, number> & {
  timestamp: number;
  coverageStart: number;
  coverageEnd: number;
  partialPeriod: boolean;
  label: string;
  total: number;
  value: number;
  withErrors: number;
  orders: ListOrder[];
};

export function buildOrderCharts(
  orders: ListOrder[],
  snapshot: number,
  days?: number,
  requestedInterval?: ChartInterval,
) {
  const dated = orders.filter(
    (order) =>
      Number.isFinite(Date.parse(order.timestamp)) &&
      Date.parse(order.timestamp) > 0 &&
      Date.parse(order.timestamp) <= snapshot,
  );
  const start = days
    ? snapshot - days * DAY
    : dated.reduce(
        (first, order) => Math.min(first, Date.parse(order.timestamp)),
        snapshot,
      );
  const span = (snapshot - start) / DAY;
  // Bound selectable intervals so long histories cannot create unbounded charts.
  const interval: ChartInterval =
    requestedInterval === "day" && span <= 730
      ? "day"
      : requestedInterval === "week" && span <= 5_110
        ? "week"
        : requestedInterval === "month"
          ? "month"
          : span > 366
            ? "month"
            : span > 60
              ? "week"
              : "day";
  const buckets = new Map<number, OrderChartBucket>();
  for (let time = bucketStart(start, interval); time <= snapshot; ) {
    buckets.set(time, {
      timestamp: time,
      coverageStart: Math.max(time, start),
      coverageEnd: Math.min(bucketEnd(time, interval), snapshot),
      partialPeriod: time < start || bucketEnd(time, interval) > snapshot,
      label: new Intl.DateTimeFormat("en-US", {
        month: "short",
        ...(interval === "month" ? { year: "numeric" } : { day: "numeric" }),
        timeZone: "UTC",
      }).format(time),
      total: 0,
      value: 0,
      withErrors: 0,
      completed: 0,
      partial: 0,
      active: 0,
      cancelled: 0,
      expired: 0,
      failed: 0,
      unknown: 0,
      orders: [],
    });
    time = bucketEnd(time, interval);
  }
  for (const order of dated) {
    const timestamp = Date.parse(order.timestamp);
    if (timestamp < start) continue;
    const bucket = buckets.get(bucketStart(timestamp, interval));
    if (!bucket) continue;
    bucket.total++;
    bucket.value += getOrderValueUsd(order);
    bucket[getOverviewOrderStatus(order)]++;
    if (hasExecutionErrors(order)) bucket.withErrors++;
    bucket.orders.push(order);
  }
  const outcomes = CHART_STATUSES.map((status) => ({
    status,
    label: OVERVIEW_STATUSES[status].label,
    orders: orders.filter((order) => getOverviewOrderStatus(order) === status),
  }));
  const sources = new Map<string, ListOrder[]>();
  const types = new Map<string, ListOrder[]>();
  for (const order of orders) {
    const source = order.source ?? "Source not provided";
    const type = order.metadata.orderType?.trim() || "Type not provided";
    if (!sources.has(source)) sources.set(source, []);
    if (!types.has(type)) types.set(type, []);
    sources.get(source)!.push(order);
    types.get(type)!.push(order);
  }
  const categories = (map: Map<string, ListOrder[]>) =>
    [...map].map(([label, group]) => ({
      label,
      orders: group,
      value: group.reduce((sum, order) => sum + getOrderValueUsd(order), 0),
    }));
  return {
    interval,
    rangeStart: start,
    snapshot,
    spanDays: span,
    buckets: [...buckets.values()],
    undatedOrders: orders.length - dated.length,
    outcomes,
    types: categories(types),
    sources: categories(sources),
  };
}

export type OrderChartData = ReturnType<typeof buildOrderCharts>;
