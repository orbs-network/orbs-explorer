import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { REACT_QUERY_KEYS } from "../../consts";
import { useQueryFilterParams } from "../../hooks/use-query-filter-params";
import { getSpotOrder, getSpotOrders } from "../api";
import { useMemo } from "react";
import { uniqBy } from "lodash";
import { useSpotPartner } from "./use-spot-partner";
import { useTwapSinkApiUrl } from "../../hooks/use-twap-sink-url";
import { Status } from "../types";
import { zeroAddress } from "viem";

export function useSpotOrdersPaginated() {
  const { query: queryParams } = useQueryFilterParams();
  const partnerId = queryParams.partner_id?.[0];
  const partner = useSpotPartner(partnerId);
  const sinkApiUrl = useTwapSinkApiUrl();

  const query = useInfiniteQuery({
    queryKey: [
      REACT_QUERY_KEYS.spotPaginatedOrders,
      queryParams.hash,
      queryParams.user,
      queryParams.chain_id?.map(Number),
      partner?.config?.adapter,
      sinkApiUrl,
      partnerId,
      queryParams.order_status,
    ],
    queryFn: async ({ signal, pageParam = 0 }) => {
      const exchange = !partnerId
        ? ""
        : partner?.config?.adapter || zeroAddress;

      const orders = await getSpotOrders({
        signal,
        page: pageParam,
        limit: 400,
        filters: {
          account: queryParams.user,
          chainIds: queryParams.chain_id?.map(Number),
          hash: queryParams.hash,
          exchange,
        },
        sinkApiUrl,
      });
      return orders;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      return lastPage.length > 0 ? pages.length : undefined;
    },
    getPreviousPageParam: () => undefined,
    refetchInterval: 60_000,
  });

  return useMemo(() => {
    const allOrders = uniqBy(query.data?.pages.flat() || [], "hash");
    const statuses = queryParams.order_status;
    const orders = statuses?.length
      ? allOrders.filter((o) =>
          statuses.includes(o.metadata?.displayOnlyStatus ?? "")
        )
      : allOrders;
    return { ...query, orders };
  }, [query, queryParams.order_status]);
}

export function useSpotOrderQuery(hash?: string) {
  const sinkApiUrl = useTwapSinkApiUrl();
  const queryKey = useMemo(
    () => [REACT_QUERY_KEYS.spotOrder, hash, sinkApiUrl],
    [hash, sinkApiUrl]
  );
  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const res = await getSpotOrder({
        signal,
        hash: hash as string,
        sinkApiUrl,
      });
      return res;
    },
    enabled: !!hash && !!sinkApiUrl,
    staleTime: Infinity,
    refetchInterval: (order) => {
      return order?.state.data?.metadata.status === Status.PENDING
        ? 5_000
        : false;
    },
  });
}
