import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { getAllOrdersForExchange } from "../api";
import { REACT_QUERY_KEYS } from "../consts";
import { useSpotConfig } from "./use-twap-config";
import {
  getLast7DaysDate,
  getPartnersWithAdapters,
  ordersToPartnerStats,
  PartnerStats,
} from "../orders-dashboard";
import { ListOrder } from "../types";

export function useOrdersDashboard() {
  const { data: config, isLoading: configLoading } = useSpotConfig();

  const partners = useMemo(
    () => getPartnersWithAdapters(config ?? null),
    [config]
  );

  const orderQueries = useQueries({
    queries: partners.map((p) => ({
      queryKey: [REACT_QUERY_KEYS.spotOrders, "dashboard", p.adapter],
      queryFn: ({ signal }: { signal?: AbortSignal }) =>
        getAllOrdersForExchange({
          exchange: p.adapter,
          signal,
        }),
      enabled: !!config && partners.length > 0,
      staleTime: 1000 * 60 * 60 * 24, // 24 hours
    })),
  });

  const isLoading =
    configLoading ||
    orderQueries.some((q) => q.isLoading && q.fetchStatus !== "idle");
  const isError = orderQueries.some((q) => q.isError);
  const error = orderQueries.find((q) => q.isError)?.error;

  const stats: PartnerStats[] = useMemo(() => {
    if (!partners.length) return [];
    return partners
      .map((p, i) => {
        const orders = orderQueries[i]?.data ?? [];
        return ordersToPartnerStats(
          orders,
          p.partnerId,
          p.partnerName
        );
      })
      .sort((a, b) => b.totalOrders - a.totalOrders);
  }, [partners, orderQueries]);

  const ordersByPartnerId = useMemo(() => {
    const map: Record<string, ListOrder[]> = {};
    partners.forEach((p, i) => {
      map[p.partnerId] = orderQueries[i]?.data ?? [];
    });
    return map;
  }, [partners, orderQueries]);

  return {
    isLoading,
    isError,
    error,
    stats,
    ordersByPartnerId,
  };
}
