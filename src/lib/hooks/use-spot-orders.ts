import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { REACT_QUERY_KEYS } from "../consts";
import { useQueryFilterParams } from "./use-query-filter-params";
import { getSpotOrder, getSpotOrders } from "../api";
import { useMemo } from "react";
import { uniqBy } from "lodash";
import { useTwapPartnerById } from "./twap-hooks";
import { Partners } from "../types";

export const useSpotOrdersPaginated = () => {
  const { query: queryParams } = useQueryFilterParams();
  const partner = useTwapPartnerById(queryParams.partner_id?.[0]);

  

  const query =  useInfiniteQuery({
    queryKey: [
      REACT_QUERY_KEYS.spotPaginatedOrders,
      queryParams.hash,
      queryParams.user,
      queryParams.chain_id?.map(Number),
      partner?.config?.adapter,
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

  return useQuery({
    queryKey: [REACT_QUERY_KEYS.spotOrder, hash],
    queryFn: async ({ signal }) => {
      return getSpotOrder({
        signal,
        hash: hash as string,
      });
    },
    enabled: !!hash,
  });
};
