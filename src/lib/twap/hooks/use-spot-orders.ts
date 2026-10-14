"use client";

import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { REACT_QUERY_KEYS } from "../../consts";
import { useQueryFilterParams } from "../../hooks/use-query-filter-params";
import { getSpotOrder, getSpotOrdersPage } from "../api";
import { useMemo } from "react";

import { useTwapSinkApiUrl } from "../../hooks/use-twap-sink-url";
import { useSearchParams } from "next/navigation";
import { preloadTokenMetadata } from "../../token-metadata";
import { getTwapTokenReferences } from "../token-metadata";

export function useSpotOrdersPaginated() {
  const queryClient = useQueryClient();
  const { query: queryParams } = useQueryFilterParams();
  const partnerId = queryParams.partner_id?.[0];
  const sinkApiUrl = useTwapSinkApiUrl();

  const query = useInfiniteQuery({
    queryKey: [
      REACT_QUERY_KEYS.spotPaginatedOrders,
      queryParams.hash,
      queryParams.user,
      queryParams.chain_id?.map(Number),
      partnerId,
      sinkApiUrl,
      queryParams.order_status,
    ],
    queryFn: async ({ signal, pageParam = 0 }) => {
      const result = await getSpotOrdersPage({
        signal,
        page: pageParam,
        limit: 400,
        filters: {
          account: queryParams.user,
          chainIds: queryParams.chain_id?.map(Number),
          hash: queryParams.hash,
          exchange: partnerId,
        },
        sinkApiUrl,
      });
      await preloadTokenMetadata(
        queryClient,
        getTwapTokenReferences(result.orders),
        signal,
      );
      return result;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      return lastPage.hasMore ? pages.length : undefined;
    },
    getPreviousPageParam: () => undefined,
    refetchInterval: 60_000,
  });

  return useMemo(() => {
    const allOrders = [
      ...new Map(
        (query.data?.pages.flatMap((page) => page.orders) ?? []).map(
          (order) => [
            `${order.order.witness.chainId ?? order.order.witness.chainid}:${order.hash.toLowerCase()}`,
            order,
          ],
        ),
      ).values(),
    ].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    const statuses = queryParams.order_status;
    const orders = statuses?.length
      ? allOrders.filter((o) =>
          statuses.includes(o.metadata?.displayOnlyStatus ?? ""),
        )
      : allOrders;
    return { ...query, orders, warnings: query.data?.pages[0]?.warnings ?? [] };
  }, [query, queryParams.order_status]);
}

export function useSpotOrderQuery(hash?: string) {
  const queryClient = useQueryClient();
  const sinkApiUrl = useTwapSinkApiUrl();
  const source = useSearchParams().get("order_source") ?? undefined;
  const queryKey = useMemo(
    () => [REACT_QUERY_KEYS.spotOrder, hash, sinkApiUrl, source],
    [hash, sinkApiUrl, source],
  );
  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const res = await getSpotOrder({
        signal,
        hash: hash as string,
        source,
        sinkApiUrl,
      });
      if (res)
        await preloadTokenMetadata(
          queryClient,
          getTwapTokenReferences([res]),
          signal,
        );
      return res ?? null;
    },
    enabled: /^0x[a-fA-F0-9]{64}$/.test(hash ?? ""),
    staleTime: 10_000,
    refetchInterval: (order) => {
      return ["pending", "eligible"].includes(
        order.state.data?.metadata.status ?? "",
      )
        ? 5_000
        : false;
    },
  });
}
