import type { ListOrder, Order } from "@orbs/domain/twap/types";
import type { Token } from "@orbs/domain/types";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import {
  getOverviewOrderStatus,
  type OverviewOrderStatus,
} from "@orbs/domain/twap/utils/orders-overview";
import { getChain } from "@orbs/domain/utils/utils";
import {
  hasExecutionErrors,
  hasLastExecutionError,
  reportedNumber,
} from "./order-diagnostics";
import { activeOrderReviewState, deadlineTime } from "./execution-analytics";
import { chunkReason, parseReportedTime } from "./order-evidence";

export type OrderErrorFilter =
  | "all"
  | "any"
  | "latest"
  | "recovered"
  | "none"
  | "unreported";

export type InvestigationSort =
  | "newest"
  | "oldest"
  | "value-desc"
  | "value-asc"
  | "errors-desc"
  | "errors-asc";

export type InvestigationFilters = {
  query: string;
  adapter: string;
  token: string;
  status: "all" | OverviewOrderStatus;
  type: string;
  source: "all" | "v1" | "v2" | "unreported";
  errors: OrderErrorFilter;
  activeAge: "all" | "24h";
  review: "all" | "attention";
  deadline: "all" | "past" | "soon" | "unreported";
  placedSince: string;
  placedUntil: string;
  minUsd: string;
  maxUsd: string;
  sort: InvestigationSort;
};

export const DEFAULT_INVESTIGATION_FILTERS: InvestigationFilters = {
  query: "",
  adapter: "",
  token: "",
  status: "all",
  type: "all",
  source: "all",
  errors: "all",
  activeAge: "all",
  review: "all",
  deadline: "all",
  placedSince: "",
  placedUntil: "",
  minUsd: "",
  maxUsd: "",
  sort: "newest",
};

/** Adds preloaded token labels without changing the raw order payload. */
export function buildOrderSearchLabels(
  orders: ListOrder[],
  resolveToken: (
    address: string,
    chainId: number,
  ) => Pick<Token, "symbol" | "name"> | null | undefined,
  partnerLabels?: Map<ListOrder, string>,
): Map<ListOrder, string> {
  const cached = new Map<
    string,
    Pick<Token, "symbol" | "name"> | null | undefined
  >();
  return new Map(
    orders.map((order) => {
      const labels = [partnerLabels?.get(order) ?? ""];
      const chainId = getTwapOrderChainId(order);
      if (chainId !== undefined) {
        for (const tokenAddress of [order.inputToken, order.outputToken]) {
          const address = tokenAddress?.trim().toLowerCase();
          if (!address) continue;
          const key = `${chainId}:${address}`;
          if (!cached.has(key)) cached.set(key, resolveToken(address, chainId));
          const token = cached.get(key);
          labels.push(token?.symbol ?? "", token?.name ?? "");
        }
      }
      return [order, labels.join(" ")] as const;
    }),
  );
}

export function getOrderSearchText(order: ListOrder): string {
  const metadata = order.metadata;
  const chainId = getTwapOrderChainId(order);
  return [
    order.hash,
    order.exchangeAdapter,
    order.inputToken,
    order.outputToken,
    order.source,
    order.timestamp,
    order.totalUSDAmount,
    chainId,
    getChain(chainId)?.name,
    metadata.srcToken?.symbol,
    metadata.srcToken?.name,
    metadata.dstToken?.symbol,
    metadata.dstToken?.name,
    metadata.orderType,
    metadata.status,
    metadata.displayOnlyStatus,
    metadata.description,
    metadata.displayOnlyStatusDescription,
    metadata.chunkSummary?.lastChunkDescription,
    metadata.chunkSummary?.lastChunkStatus,
    getOverviewOrderStatus(order),
  ]
    .filter((value) => value !== undefined && value !== null)
    .join(" ")
    .toLowerCase();
}

function matchesErrorFilter(
  order: ListOrder,
  filter: OrderErrorFilter,
): boolean {
  const errorCount = reportedNumber(order.metadata.chunkSummary?.error);
  switch (filter) {
    case "any":
      return hasExecutionErrors(order);
    case "latest":
      return hasLastExecutionError(order);
    case "recovered":
      return (
        hasExecutionErrors(order) &&
        getOverviewOrderStatus(order) === "completed"
      );
    case "none":
      return errorCount === 0 && !hasLastExecutionError(order);
    case "unreported":
      return errorCount === undefined;
    default:
      return true;
  }
}

function compareReportedNumbers(
  a: number | undefined,
  b: number | undefined,
  descending: boolean,
): number {
  if (a === undefined) return b === undefined ? 0 : 1;
  if (b === undefined) return -1;
  return descending ? b - a : a - b;
}

function placedTime(order: ListOrder): number | undefined {
  const value = Date.parse(order.timestamp);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function getUsdRangeError(min: string, max: string): string | undefined {
  const minimum = reportedNumber(min);
  const maximum = reportedNumber(max);
  if (
    (min.trim() && minimum === undefined) ||
    (max.trim() && maximum === undefined)
  )
    return "USD bounds must be valid, non-negative numbers.";
  if (minimum !== undefined && maximum !== undefined && minimum > maximum)
    return "Minimum USD must be less than or equal to maximum USD.";
}

export function getPlacementRangeError(
  since: string,
  until: string,
): string | undefined {
  const valid = (value: string) =>
    !value ||
    (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 19) === value.slice(0, 19));
  if (!valid(since) || !valid(until))
    return "Placement bounds must be valid UTC timestamps, such as 2026-10-22T12:00:00Z.";
  if (since && until && Date.parse(since) > Date.parse(until))
    return "Placement start must be at or before the end.";
}

/** Filters the entire scoped dataset; source arrays are never mutated. */
export function investigateOrders(
  orders: ListOrder[],
  filters: InvestigationFilters,
  searchLabels?: Map<ListOrder, string>,
  snapshot = Date.now(),
): ListOrder[] {
  if (getUsdRangeError(filters.minUsd, filters.maxUsd)) return [];
  if (getPlacementRangeError(filters.placedSince, filters.placedUntil))
    return [];
  const terms = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const adapter = filters.adapter.trim().toLowerCase();
  const token = filters.token.trim().toLowerCase();
  const address = (value: unknown) =>
    typeof value === "string" ? value.trim().toLowerCase() : "";
  const minUsd = reportedNumber(filters.minUsd);
  const maxUsd = reportedNumber(filters.maxUsd);
  const since = filters.placedSince
    ? Date.parse(filters.placedSince)
    : undefined;
  const until = filters.placedUntil
    ? Date.parse(filters.placedUntil)
    : undefined;
  const result = orders.filter((order) => {
    if (adapter && address(order.exchangeAdapter) !== adapter) return false;
    if (
      token &&
      address(order.inputToken) !== token &&
      address(order.outputToken) !== token
    )
      return false;
    if (
      filters.status !== "all" &&
      getOverviewOrderStatus(order) !== filters.status
    )
      return false;
    if (
      filters.type !== "all" &&
      (order.metadata.orderType?.trim() || "unreported") !== filters.type
    )
      return false;
    if (
      filters.source !== "all" &&
      (order.source === "v1" || order.source === "v2"
        ? order.source
        : "unreported") !== filters.source
    )
      return false;
    if (!matchesErrorFilter(order, filters.errors)) return false;
    if (filters.review === "attention") {
      const state = activeOrderReviewState(order, snapshot);
      if (
        !state ||
        !(
          state.pastDeadline ||
          state.latestAttemptFailed ||
          state.deadlineUnreported
        )
      )
        return false;
    }
    if (filters.deadline !== "all") {
      if (
        getOverviewOrderStatus(order) !== "active" ||
        !Number.isFinite(snapshot)
      )
        return false;
      const deadline = deadlineTime(order);
      if (
        filters.deadline === "unreported"
          ? deadline !== undefined
          : deadline === undefined ||
            (filters.deadline === "past"
              ? deadline > snapshot
              : deadline <= snapshot || deadline > snapshot + 3_600_000)
      )
        return false;
    }
    if (since !== undefined || until !== undefined) {
      const placed = placedTime(order);
      if (
        placed === undefined ||
        (since !== undefined && placed < since) ||
        (until !== undefined && placed > until)
      )
        return false;
    }
    if (filters.activeAge === "24h") {
      const placed = placedTime(order);
      if (
        getOverviewOrderStatus(order) !== "active" ||
        placed === undefined ||
        !Number.isFinite(snapshot) ||
        placed > snapshot - 86_400_000
      )
        return false;
    }
    if (minUsd !== undefined || maxUsd !== undefined) {
      const usd = reportedNumber(order.totalUSDAmount);
      if (
        usd === undefined ||
        (minUsd !== undefined && usd < minUsd) ||
        (maxUsd !== undefined && usd > maxUsd)
      )
        return false;
    }
    if (!terms.length) return true;
    const search = `${getOrderSearchText(order)} ${searchLabels?.get(order)?.toLowerCase() ?? ""}`;
    return terms.every((term) => search.includes(term));
  });
  return result.sort((a, b) => {
    let comparison = 0;
    if (filters.sort === "value-desc" || filters.sort === "value-asc") {
      comparison = compareReportedNumbers(
        reportedNumber(a.totalUSDAmount),
        reportedNumber(b.totalUSDAmount),
        filters.sort === "value-desc",
      );
    } else if (
      filters.sort === "errors-desc" ||
      filters.sort === "errors-asc"
    ) {
      comparison = compareReportedNumbers(
        reportedNumber(a.metadata.chunkSummary?.error),
        reportedNumber(b.metadata.chunkSummary?.error),
        filters.sort === "errors-desc",
      );
    }
    return (
      comparison ||
      compareReportedNumbers(
        placedTime(a),
        placedTime(b),
        filters.sort !== "oldest",
      ) ||
      a.hash.localeCompare(b.hash)
    );
  });
}

export function isOrderHash(value: string): boolean {
  return /^0x[a-f0-9]{64}$/i.test(value.trim());
}

export type OrderNavigationScope = {
  query?: string;
  period?: string;
  chainIds?: string[];
  partnerIds?: string[];
};

function navigationSearch(scope?: OrderNavigationScope): URLSearchParams {
  const search = new URLSearchParams();
  const query = new URLSearchParams(scope?.query);
  for (const key of [
    "period",
    "chain_id",
    "partner_id",
    "orders_view",
    "order_search",
    "order_status",
    "order_type",
    "order_source",
    "order_errors",
    "order_active_age",
    "order_review",
    "order_deadline",
    "order_since",
    "order_until",
    "order_raw",
    "order_set",
    "table_page_order_investigation_results",
    "table_size_order_investigation_results",
    "min_usd",
    "max_usd",
    "order_sort",
    "order_adapter",
    "order_token",
  ]) {
    for (const value of query.getAll(key)) search.append(key, value);
  }
  if (scope?.period !== undefined) search.set("period", scope.period);
  if (scope?.chainIds !== undefined) {
    search.delete("chain_id");
    for (const chain of scope.chainIds) search.append("chain_id", chain);
  }
  if (scope?.partnerIds !== undefined) {
    search.delete("partner_id");
    for (const partner of scope.partnerIds)
      search.append("partner_id", partner);
  }
  return search;
}

export function ordersScopeHref(scope?: OrderNavigationScope): string {
  const search = navigationSearch(scope).toString();
  return `/orders${search ? `?${search}` : ""}`;
}

export function orderDetailHref(
  hash: string,
  source?: "v1" | "v2",
  scope?: OrderNavigationScope,
): string {
  const search = navigationSearch(scope);
  if (source === "v1" || source === "v2") search.set("source", source);
  const query = search.toString();
  return `/orders/${encodeURIComponent(hash)}${query ? `?${query}` : ""}`;
}

/** Adapts a direct detail response for the shared inspector without an overview lookup. */
export function fullOrderToInspectionOrder(
  order: Order,
  requestedSource?: "v1" | "v2",
): ListOrder {
  const chunks = [...(order.metadata.chunks ?? [])].sort((a, b) => {
    const aTime =
      parseReportedTime(a.timestamp) ?? parseReportedTime(a.createdAt);
    const bTime =
      parseReportedTime(b.timestamp) ?? parseReportedTime(b.createdAt);
    return (bTime ?? 0) - (aTime ?? 0) || b.index - a.index;
  });
  const latest = chunks[0];
  return {
    hash: order.hash,
    // Match the shared inspector's query identity, including a both-services lookup.
    source: requestedSource,
    exchangeAdapter: order.order.witness.exchange?.adapter ?? "",
    inputToken: order.order.witness.input?.token ?? "",
    outputToken: order.order.witness.output?.token ?? "",
    timestamp: order.timestamp,
    totalUSDAmount: "",
    order: {
      witness: {
        chainId: getTwapOrderChainId(order) ?? 0,
        deadline: order.order.witness.deadline,
        epoch: order.order.witness.epoch,
      },
    },
    metadata: {
      description: order.metadata.description,
      displayOnlyStatus: order.metadata.displayOnlyStatus,
      displayOnlyStatusDescription:
        order.metadata.displayOnlyStatusDescription ?? "",
      displayOnlyPriceCheckPercentage: null,
      expectedChunks: order.metadata.expectedChunks,
      orderType: order.metadata.orderType,
      status: order.metadata.status,
      chunkSummary: {
        success: chunks.filter((chunk) =>
          /^(success|completed|succeeded)$/i.test(chunk.status),
        ).length,
        error: chunks.filter((chunk) => /^(error|failed)$/i.test(chunk.status))
          .length,
        total: chunks.length,
        lastChunkDescription: chunkReason(latest) ?? "",
        lastChunkDueTime: latest?.displayOnlyDueTime ?? "",
        lastChunkStatus: latest?.status ?? "",
        lastChunkExtraError: false,
      },
    },
  };
}
