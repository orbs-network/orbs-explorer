import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  PANCAKESWAP_V1_CHAIN_IDS,
  PANCAKESWAP_V1_EXCHANGE_ADDRESSES,
} from "../../consts";
import { getV1Orders } from "../v1-api";
import type { TwapV1OrderDisplay } from "../v1-types";

/** Only fetch v1 orders for chains that have at least one exchange address. */
const CHAIN_IDS_WITH_EXCHANGES = PANCAKESWAP_V1_CHAIN_IDS.filter(
  (chainId) => (PANCAKESWAP_V1_EXCHANGE_ADDRESSES[chainId]?.length ?? 0) > 0
);

export function useTwapV1Orders() {
  const queries = useQueries({
    queries: CHAIN_IDS_WITH_EXCHANGES.map((chainId) => {
      const exchanges = PANCAKESWAP_V1_EXCHANGE_ADDRESSES[chainId]!;
      return {
        queryKey: ["twapV1Orders", "pancakeswap", chainId],
        queryFn: ({ signal }: { signal?: AbortSignal }) =>
          getV1Orders({
            chainId,
            signal,
            filters: { exchanges },
          }),
        staleTime: 1000 * 60 * 5,
      };
    }),
  });

  const v1Orders = useMemo(() => {
    const list: TwapV1OrderDisplay[] = [];
    for (const q of queries) {
      if (q.data) list.push(...q.data);
    }
    return list.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [queries]);

  const isLoading = queries.some((q) => q.isLoading && q.fetchStatus !== "idle");
  const isError = queries.some((q) => q.isError);
  const error = queries.find((q) => q.isError)?.error;

  return {
    v1Orders,
    isLoading,
    isError,
    error,
  };
}
