"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { getAllOrdersForExchange } from "../api";
import { REACT_QUERY_KEYS } from "../../consts";
import { useSpotConfig } from "./use-spot-config";
import {
  filterOverviewOrders,
  getPartnerChainPairs,
  getTopPairsByVolume,
  ordersToPartnerStats,
  partnerChainKey,
  type PartnerCard,
} from "../utils/orders-overview";
import type { ListOrder } from "../types";
import { getChains } from "../../utils/utils";
import { getTwapOrderChainId } from "../utils";
import { preloadTokenMetadata } from "../../token-metadata";
import { getTwapTokenReferences } from "../token-metadata";

const EMPTY_SELECTION: string[] = [];
export function useSpotOverview({
  days,
  chainIds = EMPTY_SELECTION,
  partnerIds = EMPTY_SELECTION,
}: { days?: number; chainIds?: string[]; partnerIds?: string[] } = {}) {
  const queryClient = useQueryClient();
  const configQuery = useSpotConfig();
  // Fetch once per source; filters and summaries share the same snapshot.
  const ordersQuery = useQuery({
    queryKey: [REACT_QUERY_KEYS.spotOrders, "overview"],
    queryFn: async ({ signal }) => {
      const orders = await getAllOrdersForExchange({ exchange: "", signal });
      await preloadTokenMetadata(
        queryClient,
        getTwapTokenReferences(orders),
        signal,
      );
      return orders;
    },
    staleTime: 60_000,
  });
  const overview = useMemo(() => {
    const byAdapter = new Map(
      getPartnerChainPairs(configQuery.data ?? null).map((pair) => [
        `${pair.chainId}:${pair.adapter.toLowerCase()}`,
        pair,
      ]),
    );
    const chains = new Map<number, ReturnType<typeof getChains>[number]>(
      getChains().map((chain) => [chain.id, chain]),
    );
    const resolvePartner = (order: ListOrder) =>
      byAdapter.get(
        `${getTwapOrderChainId(order)}:${order.exchangeAdapter.toLowerCase()}`,
      );
    const partnerId = (order: ListOrder) =>
      resolvePartner(order)?.partnerId ??
      `adapter-${order.exchangeAdapter.toLowerCase()}`;
    const allOrders = ordersQuery.data ?? [];
    const networkOptions = [
      ...new Set(allOrders.map((order) => getTwapOrderChainId(order) ?? 0)),
    ]
      .map((id) => ({
        value: String(id),
        label:
          chains.get(id)?.name ??
          (id ? `Network ${id}` : "Network not provided"),
        logo: chains.get(id)?.logoUrl,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const tradingApps = new Map(
      allOrders.map((order) => [
        partnerId(order),
        {
          value: partnerId(order),
          label:
            resolvePartner(order)?.partnerName ??
            `Unidentified app (${order.exchangeAdapter.slice(0, 6)}…${order.exchangeAdapter.slice(-4)})`,
        },
      ]),
    );
    const orders = filterOverviewOrders(allOrders, {
      days,
      updatedAt: ordersQuery.dataUpdatedAt,
      chainIds,
      partnerIds,
      resolvePartner: partnerId,
    });
    const groups = new Map<
      string,
      {
        partnerId: string;
        partnerName: string;
        chainId: number;
        orders: ListOrder[];
      }
    >();
    for (const order of orders) {
      const id = partnerId(order);
      const chainId = getTwapOrderChainId(order) ?? 0;
      const key = partnerChainKey(id, chainId);
      const group = groups.get(key) ?? {
        partnerId: id,
        partnerName: tradingApps.get(id)!.label,
        chainId,
        orders: [],
      };
      group.orders.push(order);
      groups.set(key, group);
    }
    const cards = new Map<string, PartnerCard>();
    const stats = [...groups.values()].map((group) => {
      const chainName =
        chains.get(group.chainId)?.name ??
        (group.chainId ? `Network ${group.chainId}` : "Network not provided");
      const stat = ordersToPartnerStats(
        group.orders,
        group.partnerId,
        group.partnerName,
        { chainId: group.chainId, chainName },
      );
      const card = cards.get(group.partnerId) ?? {
        partnerId: group.partnerId,
        partnerName: group.partnerName,
        chains: [],
      };
      card.chains.push({
        chainId: group.chainId,
        chainName,
        stats: stat,
        orders: group.orders,
        topPairs: getTopPairsByVolume(group.orders, 3),
      });
      cards.set(group.partnerId, card);
      return stat;
    });
    const partnerCards = [...cards.values()].sort(
      (a, b) =>
        b.chains.reduce((sum, c) => sum + c.stats.totalOrders, 0) -
        a.chains.reduce((sum, c) => sum + c.stats.totalOrders, 0),
    );
    for (const card of partnerCards)
      card.chains.sort((a, b) => b.stats.totalOrders - a.stats.totalOrders);
    return {
      stats,
      orders,
      partnerCards,
      networkOptions,
      partnerOptions: [...tradingApps.values()].sort((a, b) =>
        a.label.localeCompare(b.label),
      ),
    };
  }, [
    configQuery.data,
    ordersQuery.data,
    ordersQuery.dataUpdatedAt,
    days,
    chainIds,
    partnerIds,
  ]);
  const refresh = () => {
    void Promise.allSettled([configQuery.refetch(), ordersQuery.refetch()]);
  };
  return {
    ...overview,
    isLoading: configQuery.isPending || ordersQuery.isPending,
    isError: ordersQuery.isError && !ordersQuery.data,
    error: ordersQuery.error,
    warnings: [
      ...(configQuery.isError
        ? [
            "Trading app names could not be loaded. Orders and totals are still available; some apps are unidentified.",
          ]
        : []),
      ...(ordersQuery.isError && ordersQuery.data
        ? [
            "The overview could not refresh. These totals are from the last successful update.",
          ]
        : []),
    ],
    updatedAt: ordersQuery.dataUpdatedAt,
    isRefreshing: ordersQuery.isFetching || configQuery.isFetching,
    refresh,
    retry: refresh,
  };
}
