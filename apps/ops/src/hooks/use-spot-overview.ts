"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSpotConfig } from "@orbs/domain/twap/hooks/use-spot-config";
import { buildSpotOverview } from "@/lib/overview-data";
import {
  spotOverviewOrdersQueryOptions,
  spotOverviewTokensQueryOptions,
} from "@/lib/spot-overview-queries";
import { useOverviewErrorToasts } from "./use-overview-error-toasts";

const EMPTY_SELECTION: string[] = [];
export function useSpotOverview({
  days,
  chainIds = EMPTY_SELECTION,
  partnerIds = EMPTY_SELECTION,
  loadTokenMetadata = true,
}: {
  days?: number;
  chainIds?: string[];
  partnerIds?: string[];
  loadTokenMetadata?: boolean;
} = {}) {
  const queryClient = useQueryClient();
  const configQuery = useSpotConfig();
  const ordersQuery = useQuery(spotOverviewOrdersQueryOptions());
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
        loadTokenMetadata && !configQuery.isPending,
      ),
    [queryClient, overview.orders, loadTokenMetadata, configQuery.isPending],
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
      ordersQuery.refetch(),
      ...(tokenOptions.enabled ? [tokensQuery.refetch()] : []),
    ]);
  };
  return {
    ...overview,
    orders,
    allOrders: ordersQuery.data ?? [],
    config: configQuery.data ?? null,
    configUpdatedAt: configQuery.dataUpdatedAt,
    isConfigError: configQuery.isError,
    isLoading: configQuery.isPending || ordersQuery.isPending,
    isHistoryLoading: ordersQuery.isPending,
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
