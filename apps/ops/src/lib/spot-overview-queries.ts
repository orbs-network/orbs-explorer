import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { REACT_QUERY_KEYS } from "@orbs/domain/consts";
import { getAllOrdersForExchange } from "@orbs/domain/twap/api";
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

// All routes and local filters share one complete history snapshot. Metadata is
// a separate query so RPC lookups never delay order counts or hide good history.
export function spotOverviewOrdersQueryOptions() {
  return queryOptions({
    queryKey: [REACT_QUERY_KEYS.spotOrders, "overview"],
    queryFn: ({ signal }) => getAllOrdersForExchange({ exchange: "", signal }),
    staleTime: SNAPSHOT_FRESH_TIME,
    gcTime: SNAPSHOT_CACHE_TIME,
    refetchInterval: (query) => overviewRefetchInterval(query.state),
    refetchIntervalInBackground: false,
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
