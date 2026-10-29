import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { REACT_QUERY_KEYS } from "@orbs/domain/consts";
import {
  getAllOrdersForSwapper,
  getSpotOrdersForScope,
} from "@orbs/domain/twap/api";
import { isAddress } from "viem";
import type { ListOrder } from "@orbs/domain/twap/types";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import {
  hasTokenSymbol,
  isValidTokenReference,
  preloadTokenMetadata,
} from "@orbs/domain/token-metadata";
import { overviewRefetchInterval } from "./overview-freshness";

const SNAPSHOT_FRESH_TIME = 60_000;
const SNAPSHOT_CACHE_TIME = 30 * 60_000;

export type SpotHistoryQueryScope = {
  days?: number;
  chainIds?: string[];
  exchange?: string;
  swapper?: string;
  source?: "all" | "v1" | "v2" | "unreported";
  placedSince?: string;
  placedUntil?: string;
};

export function normalizeSpotHistoryScope(scope: SpotHistoryQueryScope = {}) {
  const date = (value?: string) =>
    value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : undefined;
  return {
    days:
      scope.days && Number.isFinite(scope.days) && scope.days > 0
        ? scope.days
        : undefined,
    chainIds: [
      ...new Set(
        (scope.chainIds ?? [])
          .map(Number)
          .filter((id) => Number.isSafeInteger(id) && id > 0),
      ),
    ].sort((a, b) => a - b),
    exchange: [
      ...new Set(
        (scope.exchange ?? "")
          .split(",")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
      ),
    ]
      .sort()
      .join(","),
    swapper: scope.swapper?.trim().toLowerCase() || undefined,
    source:
      scope.source === "v1" || scope.source === "v2" ? scope.source : undefined,
    fromTimestamp: date(scope.placedSince),
    untilTimestamp: date(scope.placedUntil),
  };
}

// Reuse matching scopes across routes without downloading unrelated history.
// Token enrichment remains separate from order counts and pagination.
export function spotOverviewOrdersQueryOptions(
  scope: SpotHistoryQueryScope = {},
) {
  const normalized = normalizeSpotHistoryScope(scope);
  return queryOptions({
    queryKey: [REACT_QUERY_KEYS.spotOrders, "overview", normalized],
    queryFn: ({ signal }) => {
      const start = normalized.days
        ? Date.now() - normalized.days * 86_400_000
        : undefined;
      const fromTimestamp =
        start === undefined
          ? normalized.fromTimestamp
          : Math.max(start, normalized.fromTimestamp ?? -Infinity);
      return getSpotOrdersForScope({ ...normalized, fromTimestamp, signal });
    },
    staleTime: SNAPSHOT_FRESH_TIME,
    gcTime: SNAPSHOT_CACHE_TIME,
    refetchInterval: (query) => overviewRefetchInterval(query.state),
    refetchIntervalInBackground: false,
  });
}

/** Cache membership separately for each address and complete history snapshot. */
export function spotSwapperOrdersQueryOptions(
  swapper: string,
  snapshot: number,
) {
  const address = swapper.trim().toLowerCase();
  return queryOptions({
    queryKey: [REACT_QUERY_KEYS.spotOrders, "swapper", address, snapshot],
    queryFn: ({ signal }) =>
      getAllOrdersForSwapper({ swapper: address, signal }),
    enabled: isAddress(address, { strict: false }) && snapshot > 0,
    staleTime: SNAPSHOT_FRESH_TIME,
    gcTime: SNAPSHOT_CACHE_TIME,
  });
}

export function spotOverviewTokensQueryOptions(
  queryClient: QueryClient,
  orders: ListOrder[],
  enabled = true,
) {
  const missingReferences = (enabled ? orders : []).flatMap((order) => {
    const chainId = getTwapOrderChainId(order);
    return [
      { address: order.inputToken, token: order.metadata?.srcToken },
      { address: order.outputToken, token: order.metadata?.dstToken },
    ]
      .filter(
        ({ address, token }) =>
          !hasTokenSymbol(token) ||
          token?.address?.toLowerCase() !== address?.toLowerCase(),
      )
      .map(({ address }) => ({ address, chainId }));
  });
  const references = [
    ...new Map(
      missingReferences
        .filter(isValidTokenReference)
        .map(
          ({ address, chainId }) =>
            [
              `${chainId}:${address.toLowerCase()}`,
              { address: address.toLowerCase(), chainId },
            ] as const,
        ),
    ).values(),
  ].sort((a, b) => a.chainId - b.chainId || a.address.localeCompare(b.address));
  return queryOptions({
    queryKey: ["ops-overview-token-metadata", references],
    queryFn: async ({ signal }) => {
      await preloadTokenMetadata(queryClient, references, signal);
      return true;
    },
    enabled: enabled && references.length > 0,
    staleTime: SNAPSHOT_FRESH_TIME,
    gcTime: SNAPSHOT_CACHE_TIME,
  });
}
