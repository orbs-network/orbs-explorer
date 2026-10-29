"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSpotConfig } from "@orbs/domain/twap/hooks/use-spot-config";
import { buildSpotOverview } from "@/lib/overview-data";
import {
  spotOverviewOrdersQueryOptions,
  spotOverviewTokensQueryOptions,
  normalizeSpotHistoryScope,
  type SpotHistoryQueryScope,
} from "@/lib/spot-overview-queries";
import { historyExchangeForPartners } from "@/lib/spot-history-scope";
import { useOverviewErrorToasts } from "./use-overview-error-toasts";

const EMPTY_SELECTION: string[] = [];
export function useSpotOverview({
  days,
  chainIds = EMPTY_SELECTION,
  partnerIds = EMPTY_SELECTION,
  loadTokenMetadata = true,
  enabled = true,
  includePreviousPeriod = false,
  filters,
}: {
  days?: number;
  chainIds?: string[];
  partnerIds?: string[];
  loadTokenMetadata?: boolean;
  enabled?: boolean;
  includePreviousPeriod?: boolean;
  filters?: Pick<
    SpotHistoryQueryScope,
    "swapper" | "source" | "placedSince" | "placedUntil"
  >;
} = {}) {
  const queryClient = useQueryClient();
  const configQuery = useSpotConfig();
  const historyScope = {
    days: days && includePreviousPeriod ? days * 2 : days,
    chainIds,
    exchange: historyExchangeForPartners(
      configQuery.data ?? null,
      partnerIds,
      chainIds,
    ),
    ...filters,
  };
  const queryEnabled =
    enabled && (!partnerIds.length || !configQuery.isPending);
  const ordersQuery = useQuery({
    ...spotOverviewOrdersQueryOptions(historyScope),
    enabled: queryEnabled,
  });
  useOverviewErrorToasts({ orders: ordersQuery, config: configQuery });
  const overview = useMemo(
    () =>
      buildSpotOverview({
        allOrders: ordersQuery.data ?? [],
        config: configQuery.data ?? null,
        updatedAt: ordersQuery.dataUpdatedAt,
        days,
        chainIds,
        partnerIds,
      }),
    [
      configQuery.data,
      ordersQuery.data,
      ordersQuery.dataUpdatedAt,
      days,
      chainIds,
      partnerIds,
    ],
  );
  const tokenOptions = useMemo(
    () =>
      spotOverviewTokensQueryOptions(
        queryClient,
        overview.orders,
        enabled && loadTokenMetadata && !configQuery.isPending,
      ),
    [
      queryClient,
      overview.orders,
      loadTokenMetadata,
      configQuery.isPending,
      enabled,
    ],
  );
  const tokensQuery = useQuery(tokenOptions);
  // Search and market builders read token data from the shared cache. Update
  // their scoped input after enrichment settles without rebuilding the catalog.
  const orders = useMemo(
    () => (tokensQuery.dataUpdatedAt ? [...overview.orders] : overview.orders),
    [overview.orders, tokensQuery.dataUpdatedAt],
  );
  const refresh = () => {
    void Promise.allSettled([
      configQuery.refetch(),
      ...(enabled ? [ordersQuery.refetch()] : []),
      ...(tokenOptions.enabled ? [tokensQuery.refetch()] : []),
    ]);
  };
  return {
    ...overview,
    orders,
    allOrders: ordersQuery.data ?? [],
    historyScope: normalizeSpotHistoryScope(historyScope),
    config: configQuery.data ?? null,
    configUpdatedAt: configQuery.dataUpdatedAt,
    isConfigError: configQuery.isError,
    isLoading: enabled && (configQuery.isPending || ordersQuery.isPending),
    isHistoryLoading: enabled && ordersQuery.isPending,
    isCatalogLoading: configQuery.isPending,
    isError: ordersQuery.isError && !ordersQuery.data,
    isRefreshError: ordersQuery.isError,
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
    isMetadataLoading: tokensQuery.isFetching,
    refresh,
    retry: refresh,
  };
}
