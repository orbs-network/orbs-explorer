import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchElastic } from "../api";
import { LIQUIDITY_HUB_ELASTIC_SERVER_URL } from "../consts";
import { elasticQueries } from "../liquidity-hub/elastic-queries";
import type { LiquidityHubSwap } from "../liquidity-hub/types";
import {
  getLast7DaysDate,
  getLHPartners,
  swapsToPartnerStats,
  swapBelongsToPartner,
  LHPartnerStats,
} from "../liquidity-hub/dashboard";

const LIMIT = 1000;

export function useLiquidityHubDashboard() {
  const partners = useMemo(() => getLHPartners(), []);

  const query = useQuery({
    queryKey: ["liquidityHubOverview", "last7days"],
    queryFn: async ({ signal }) => {
      const endDate = Date.now();
      const startDate = getLast7DaysDate().getTime();

      const allSwaps: LiquidityHubSwap[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const data = elasticQueries.getSwaps({
          page,
          limit: LIMIT,
          startDate,
          endDate,
        });
        const result = await fetchElastic<LiquidityHubSwap>(
          LIQUIDITY_HUB_ELASTIC_SERVER_URL,
          data,
          signal
        );
        if (result.length === 0) hasMore = false;
        else {
          allSwaps.push(...result);
          page++;
          if (result.length < LIMIT) hasMore = false;
        }
      }

      return allSwaps;
    },
    staleTime: 1000 * 60 * 5, // 5 min
  });

  const { data: allSwaps = [], isLoading, isError, error } = query;

  const stats: LHPartnerStats[] = useMemo(() => {
    if (!partners.length) return [];
    return partners
      .map((p) => {
        const swaps = allSwaps.filter((s) => swapBelongsToPartner(s, p.partnerId));
        return swapsToPartnerStats(swaps, p.partnerId, p.partnerName);
      })
      .sort((a, b) => b.totalSwaps - a.totalSwaps);
  }, [partners, allSwaps]);

  const swapsByPartnerId = useMemo(() => {
    const map: Record<string, LiquidityHubSwap[]> = {};
    partners.forEach((p) => {
      map[p.partnerId] = allSwaps.filter((s) => swapBelongsToPartner(s, p.partnerId));
    });
    return map;
  }, [partners, allSwaps]);

  return {
    isLoading,
    isError,
    error,
    stats,
    swapsByPartnerId,
    allSwaps,
  };
}
