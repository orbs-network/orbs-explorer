import type { ListOrder } from "@orbs/domain/twap/types";
import {
  getOrderValueUsd,
  groupOverviewOrders,
  type OverviewOrderStatus,
  type PartnerCard,
  type PartnerChainEntry,
} from "@orbs/domain/twap/utils/orders-overview";
import { hasLastExecutionError, reportedNumber } from "./order-diagnostics";
import { deadlineTime, placementTime } from "./execution-analytics";
import { partnerHref, partnerScopeSearch } from "./partner-navigation";

export type TradingAppRow = {
  rowId: string;
  partnerId: string;
  partnerName: string;
  /** Present only when the row represents one app/network cohort. */
  chainId?: number;
  chainName?: string;
  chains: PartnerChainEntry[];
  orders: ListOrder[];
  groups: Record<OverviewOrderStatus, ListOrder[]>;
  totalOrders: number;
  totalUsd: number;
  pricedOrders: number;
  /** Terminal failed orders / all orders in this row, on a 0–1 scale. */
  failedRate?: number;
  activePastDeadline: number;
  activeLatestErrors: number;
  /** Latest placement time; the list API does not expose an update timestamp. */
  lastPlaced?: number;
  previousOrders?: number;
  orderChange?: number;
};

export type TradingAppSortKey =
  | "partnerName"
  | "chainName"
  | "totalOrders"
  | "totalUsd"
  | "failedRate"
  | "needsAttention"
  | "lastPlaced"
  | "orderChange"
  | OverviewOrderStatus;
export type TradingAppSortDirection = "asc" | "desc";
export type TradingAppGrouping = "apps" | "networks";
export type TradingAppColumns = "compact" | "detailed" | "business";
export const TRADING_APP_COLUMNS_STORAGE_KEY =
  "orbs-ops-trading-app-columns-v1";

export function parseTradingAppColumns(
  value: string | null,
): TradingAppColumns {
  return value === "detailed" || value === "business" ? value : "compact";
}

/** Unknown adapters must not resolve to a known app on a different network. */
export function tradingAppPartnerHref(
  row: Pick<TradingAppRow, "partnerId" | "chains" | "chainId">,
  query: string,
  chainIdOverride?: number,
): string {
  return partnerHref(
    row.partnerId,
    query,
    "overview",
    rowChainIds(row, chainIdOverride),
  );
}

/** Row counts must open exactly their cohort, without unrelated hidden facets. */
export function tradingAppOrdersHref(
  row: Pick<TradingAppRow, "partnerId" | "chains" | "chainId">,
  query: string,
  filters: {
    status?: OverviewOrderStatus;
    deadline?: "past";
    errors?: "latest";
    chainId?: number;
  } = {},
): string {
  const chainIds = rowChainIds(row, filters.chainId);
  const search = partnerScopeSearch(row.partnerId, query, chainIds);
  if (filters.status) search.set("order_status", filters.status);
  if (filters.deadline) {
    search.set("order_status", "active");
    search.set("order_deadline", filters.deadline);
  }
  if (filters.errors) {
    search.set("order_status", "active");
    search.set("order_errors", filters.errors);
  }
  return `/orders${search.size ? `?${search}` : ""}`;
}

function rowChainIds(
  row: Pick<TradingAppRow, "partnerId" | "chains" | "chainId">,
  chainIdOverride?: number,
): string[] | undefined {
  const chainId = chainIdOverride ?? row.chainId;
  if (chainId !== undefined) return [String(chainId)];
  return row.partnerId.toLowerCase().startsWith("adapter-")
    ? row.chains.map((chain) => String(chain.chainId))
    : undefined;
}

/**
 * The overview has already assigned each scoped order to one partner/network.
 * Keep that exact cohort, including known apps with no activity; chain.stats
 * and legacy card-local network selections never participate in table totals.
 */
export function buildTradingAppRows(
  partnerCards: readonly PartnerCard[],
  snapshot = Date.now(),
  grouping: TradingAppGrouping = "apps",
  includeInactive = false,
): TradingAppRow[] {
  return partnerCards.flatMap((card) => {
    if (grouping === "apps")
      return [buildTradingAppRow(card, card.chains, snapshot)];
    return card.chains
      .filter((chain) => includeInactive || chain.orders.length > 0)
      .map((chain) => buildTradingAppRow(card, [chain], snapshot, chain));
  });
}

function buildTradingAppRow(
  card: PartnerCard,
  chains: PartnerChainEntry[],
  snapshot: number,
  network?: PartnerChainEntry,
): TradingAppRow {
  const orders = chains.flatMap((chain) => chain.orders);
  const groups = groupOverviewOrders(orders);
  let totalUsd = 0;
  let pricedOrders = 0;
  let lastPlaced: number | undefined;
  for (const order of orders) {
    totalUsd += getOrderValueUsd(order);
    if (reportedNumber(order.totalUSDAmount) !== undefined) pricedOrders++;
    const placed = placementTime(order);
    if (
      placed !== undefined &&
      (lastPlaced === undefined || placed > lastPlaced)
    )
      lastPlaced = placed;
  }
  return {
    rowId: network
      ? `network:${network.chainId}:${card.partnerId}`
      : `app:${card.partnerId}`,
    partnerId: card.partnerId,
    partnerName: card.partnerName,
    chainId: network?.chainId,
    chainName: network?.chainName,
    chains,
    orders,
    groups,
    totalOrders: orders.length,
    totalUsd,
    pricedOrders,
    failedRate: orders.length
      ? groups.failed.length / orders.length
      : undefined,
    activePastDeadline: groups.active.filter((order) => {
      const deadline = deadlineTime(order);
      return (
        deadline !== undefined &&
        Number.isFinite(snapshot) &&
        deadline <= snapshot
      );
    }).length,
    activeLatestErrors: groups.active.filter(hasLastExecutionError).length,
    lastPlaced,
  };
}

function sortValue(
  row: TradingAppRow,
  key: Exclude<
    TradingAppSortKey,
    "partnerName" | "chainName" | "needsAttention"
  >,
): number | undefined {
  if (key === "totalUsd" && row.totalOrders > 0 && row.pricedOrders === 0)
    return undefined;
  if (
    key === "totalOrders" ||
    key === "totalUsd" ||
    key === "failedRate" ||
    key === "lastPlaced" ||
    key === "orderChange"
  )
    return row[key];
  return row.groups[key].length;
}

export function withTradingAppComparison(
  rows: TradingAppRow[],
  previousRows: TradingAppRow[] | undefined,
): TradingAppRow[] {
  if (!previousRows) return rows;
  const previous = new Map(
    previousRows.map((row) => [row.rowId, row.totalOrders]),
  );
  return rows.map((row) => {
    const previousOrders = previous.get(row.rowId) ?? 0;
    return {
      ...row,
      previousOrders,
      orderChange: previousOrders
        ? (row.totalOrders - previousOrders) / previousOrders
        : undefined,
    };
  });
}

/** Numeric values sort numerically; no-activity failure rates stay last either way. */
export function sortTradingAppRows(
  rows: readonly TradingAppRow[],
  key: TradingAppSortKey = "needsAttention",
  direction: TradingAppSortDirection = "desc",
): TradingAppRow[] {
  return [...rows].sort((a, b) => {
    const name = a.partnerName.localeCompare(b.partnerName);
    const identity = a.partnerId.localeCompare(b.partnerId);
    const network = (a.chainName ?? "").localeCompare(b.chainName ?? "");
    const rowIdentity = a.rowId.localeCompare(b.rowId);
    const tie = name || identity || network || rowIdentity;
    if (key === "partnerName")
      return (
        (direction === "asc" ? name : -name) ||
        identity ||
        network ||
        rowIdentity
      );
    if (key === "chainName")
      return (direction === "asc" ? network : -network) || tie;
    if (key === "needsAttention") {
      const comparison =
        b.activePastDeadline - a.activePastDeadline ||
        b.activeLatestErrors - a.activeLatestErrors ||
        b.groups.failed.length - a.groups.failed.length ||
        b.totalOrders - a.totalOrders;
      return (direction === "desc" ? comparison : -comparison) || tie;
    }
    const left = sortValue(a, key);
    const right = sortValue(b, key);
    if (left === undefined) return right === undefined ? tie : 1;
    if (right === undefined) return -1;
    return (direction === "asc" ? left - right : right - left) || tie;
  });
}
