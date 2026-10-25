import { OVERVIEW_STATUSES } from "@orbs/domain/twap/utils/orders-overview";
import { canonicalOverviewQuery } from "./overview-views";
import { reportWindow } from "./placement-report";
import type { TradingAppGrouping, TradingAppRow } from "./trading-apps-table";

export function placementComparisonExport({
  rows,
  query,
  snapshot,
  grouping,
  search,
  exportedAt,
}: {
  rows: TradingAppRow[];
  query: string;
  snapshot: number;
  grouping: TradingAppGrouping;
  search: string;
  exportedAt: number;
}) {
  const filters = canonicalOverviewQuery(query);
  const period = new URLSearchParams(filters).get("period") ?? "7";
  const days = period === "all" ? undefined : Number(period);
  const start = days ? snapshot - days * 86_400_000 : undefined;
  const time = (value: number | undefined) =>
    value !== undefined && Number.isFinite(value) && value > 0
      ? new Date(value).toISOString()
      : null;
  const metadata = {
    snapshot_utc: time(snapshot),
    exported_utc: time(exportedAt),
    timezone: "UTC",
    placement_range: reportWindow(start, snapshot),
    previous_range:
      start !== undefined && days
        ? reportWindow(start - days * 86_400_000, start) + " (end exclusive)"
        : null,
    filter_query: filters,
    table_search: search.trim(),
    grouping,
    time_basis:
      "Orders placed in range, with latest reported outcomes at snapshot",
    definitions:
      "Orders: unique network + order hash, v2 preferred over v1. Placed USD: original reported order size, not executed volume; missing prices excluded, source/time not provided. Failure rate: currently failed / placed orders. Growth: placed order count vs immediately preceding equal range. Share denominator: all scoped orders before table search. Executed volume and unique trading wallets unavailable in history feed.",
  };
  const records = rows.map((row) => ({
    trading_app_id: row.partnerId,
    trading_app: row.partnerName,
    network_id: row.chainId ?? null,
    network: row.chainName ?? null,
    orders_placed: row.totalOrders,
    placed_usd: row.pricedOrders || !row.totalOrders ? row.totalUsd : null,
    priced_orders: row.pricedOrders,
    previous_orders: row.previousOrders ?? null,
    order_change_fraction: row.orderChange ?? null,
    failed_fraction: row.failedRate ?? null,
    active_latest_error: row.activeLatestErrors,
    active_past_deadline: row.activePastDeadline,
    last_placed_utc: time(row.lastPlaced),
    ...Object.fromEntries(
      Object.keys(OVERVIEW_STATUSES).map((status) => [
        status,
        row.groups[status as keyof typeof row.groups].length,
      ]),
    ),
  }));
  return { metadata, rows: records };
}

export function placementComparisonCsv(
  report: ReturnType<typeof placementComparisonExport>,
): string {
  const records = report.rows.map((row) => ({ ...report.metadata, ...row }));
  if (!records.length) return "";
  const fields = Object.keys(records[0]);
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    return `"${(/^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
  };
  return [
    fields,
    ...records.map((row) =>
      fields.map((field) => row[field as keyof typeof row]),
    ),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
