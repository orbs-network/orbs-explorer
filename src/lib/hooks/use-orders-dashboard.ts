import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { getAllOrdersForExchangeAndChain } from "../api";
import { REACT_QUERY_KEYS } from "../consts";
import { useSpotConfig } from "./use-twap-config";
import {
  getPartnerChainPairs,
  ordersToPartnerStats,
  partnerChainKey,
  PartnerCard,
  PartnerStats,
} from "../orders-dashboard";
import { ListOrder } from "../types";
import { getChains } from "../utils/utils";

export function useOrdersDashboard() {
  const { data: config, isLoading: configLoading } = useSpotConfig();

  const partnerChains = useMemo(
    () => getPartnerChainPairs(config ?? null),
    [config]
  );

  const chainNameById = useMemo(() => {
    const map: Record<number, string> = {};
    getChains().forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, []);

  const orderQueries = useQueries({
    queries: partnerChains.map((p) => ({
      queryKey: [
        REACT_QUERY_KEYS.spotOrders,
        "dashboard",
        p.adapter,
        p.chainId,
      ],
      queryFn: ({ signal }: { signal?: AbortSignal }) =>
        getAllOrdersForExchangeAndChain({
          exchange: p.adapter,
          chainId: p.chainId,
          signal,
        }),
      enabled: !!config && partnerChains.length > 0,
      staleTime: 1000 * 60 * 60 * 24, // 24 hours
    })),
  });

  const isLoading =
    configLoading ||
    orderQueries.some((q) => q.isLoading && q.fetchStatus !== "idle");
  const isError = orderQueries.some((q) => q.isError);
  const error = orderQueries.find((q) => q.isError)?.error;

  /** One entry per partner+chain for overview and backward compat. */
  const stats: PartnerStats[] = useMemo(() => {
    if (!partnerChains.length) return [];
    return partnerChains
      .map((p, i) => {
        const orders = orderQueries[i]?.data ?? [];
        const chainName = chainNameById[p.chainId] ?? `Chain ${p.chainId}`;
        return ordersToPartnerStats(orders, p.partnerId, p.partnerName, {
          chainId: p.chainId,
          chainName,
        });
      })
      .sort((a, b) => b.totalOrders - a.totalOrders);
  }, [partnerChains, orderQueries, chainNameById]);

  /** Grouped by partner for one card per partner with chain tabs. */
  const partnerCards: PartnerCard[] = useMemo(() => {
    if (!partnerChains.length) return [];
    const byPartner = new Map<
      string,
      { partnerName: string; chains: { chainId: number; chainName: string; adapter: string; queryIndex: number }[] }
    >();
    partnerChains.forEach((p, i) => {
      const existing = byPartner.get(p.partnerId);
      const chainName = chainNameById[p.chainId] ?? `Chain ${p.chainId}`;
      const entry = {
        chainId: p.chainId,
        chainName,
        adapter: p.adapter,
        queryIndex: i,
      };
      if (!existing) {
        byPartner.set(p.partnerId, {
          partnerName: p.partnerName,
          chains: [entry],
        });
      } else {
        existing.chains.push(entry);
      }
    });
    const cards: PartnerCard[] = [];
    byPartner.forEach((value, partnerId) => {
      const chains = value.chains.map((ch) => {
        const orders = orderQueries[ch.queryIndex]?.data ?? [];
        const chainStats = ordersToPartnerStats(
          orders,
          partnerId,
          value.partnerName,
          { chainId: ch.chainId, chainName: ch.chainName }
        );
        return {
          chainId: ch.chainId,
          chainName: ch.chainName,
          stats: chainStats,
          orders,
        };
      });
      cards.push({
        partnerId,
        partnerName: value.partnerName,
        chains,
      });
    });
    return cards.sort(
      (a, b) =>
        b.chains.reduce((s, c) => s + c.stats.totalOrders, 0) -
        a.chains.reduce((s, c) => s + c.stats.totalOrders, 0)
    );
  }, [partnerChains, orderQueries, chainNameById]);

  const ordersByPartnerChainKey = useMemo(() => {
    const map: Record<string, ListOrder[]> = {};
    partnerChains.forEach((p, i) => {
      map[partnerChainKey(p.partnerId, p.chainId)] = orderQueries[i]?.data ?? [];
    });
    return map;
  }, [partnerChains, orderQueries]);

  return {
    isLoading,
    isError,
    error,
    stats,
    partnerCards,
    ordersByPartnerChainKey,
  };
}
