import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { REACT_QUERY_KEYS } from "../../consts";
import { useQueryFilterParams } from "../use-query-filter-params";
import { getSpotOrder, getSpotOrders } from "../../api";
import { useMemo } from "react";
import { uniqBy } from "lodash";
import { useSpotPartner } from "./use-spot-partner";
import { useTwapSinkApiUrl } from "../use-twap-sink-url";
import { Partners } from "../../types";

export const useSpotOrdersPaginated = () => {
  const { query: queryParams } = useQueryFilterParams();
  const partner = useSpotPartner(queryParams.partner_id?.[0]);
  const sinkApiUrl = useTwapSinkApiUrl();

  const query = useInfiniteQuery({
    queryKey: [
      REACT_QUERY_KEYS.spotPaginatedOrders,
      queryParams.hash,
      queryParams.user,
      queryParams.chain_id?.map(Number),
      partner?.config?.adapter,
      sinkApiUrl,
    ],
    queryFn: async ({ signal, pageParam = 0 }) => {
      
      return getSpotOrders({
        signal,
        page: pageParam,
        limit: 400,
        filters: {
          account: queryParams.user,
          chainIds: queryParams.chain_id?.map(Number),
          hash: queryParams.hash,
          exchange: partner?.config?.adapter,
        },
        sinkApiUrl,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      return lastPage.length > 0 ? pages.length : undefined; // Return next page number or undefined if no more pages
    },
    getPreviousPageParam: (firstPage) => {
      return firstPage ? undefined : 0; // Modify based on how you paginate backwards
    },
    refetchInterval: 60_000,
  });
  return useMemo(() => {
    return {
      ...query,
      orders: uniqBy(query.data?.pages.flat() || [], 'hash')
    };
  }, [query])
};

export const useSpotOrderQuery = (hash?: string) => {
  const sinkApiUrl = useTwapSinkApiUrl();
  return useQuery({
    queryKey: [REACT_QUERY_KEYS.spotOrder, hash, sinkApiUrl],
    queryFn: async ({ signal }) => {
      
      return getSpotOrder({
        signal,
        hash: hash as string,
        sinkApiUrl,
      });
    },
    enabled: !!hash && !!sinkApiUrl,
    staleTime: Infinity,
  });
};
