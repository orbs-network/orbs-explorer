"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { useSpotOverview } from "./use-spot-overview";
import type { useOrderScope } from "./use-order-scope";
import { useSelectionFilter } from "./use-selection-filter";
import { buildSpotOverview } from "../lib/overview-data";
import { spotOverviewOrdersQueryOptions } from "../lib/spot-overview-queries";
import { historyExchangeForPartners } from "../lib/spot-history-scope";
import {
  countOperationalActiveOrders,
  operationalNavigationScope,
  type OperationalPlacementScope,
} from "../lib/operational-scope";

/** Follow the selected period by default; all-date exposure loads only on request. */
export function useOperationalScope(
  data: ReturnType<typeof useSpotOverview>,
  scope: ReturnType<typeof useOrderScope>,
  enabled = true,
) {
  const [placement, setPlacement] = useSelectionFilter(
    "active_scope",
    "placement",
    ["all", "placement"] as const,
  );
  const mode = placement as OperationalPlacementScope;
  const client = useQueryClient();
  const historyOptions = spotOverviewOrdersQueryOptions({
    chainIds: scope.chainIds,
    exchange: historyExchangeForPartners(
      data.config,
      scope.partnerIds,
      scope.chainIds,
    ),
  });
  const loadAllDates = enabled && mode === "all" && !data.isCatalogLoading;
  const historyQuery = useQuery({
    ...historyOptions,
    // A disabled observer must not keep an abandoned full-history request alive.
    queryKey: loadAllDates
      ? historyOptions.queryKey
      : ["ops-idle-all-date-history"],
    enabled: loadAllDates,
  });
  const allDateOrders = loadAllDates
    ? historyQuery.data
    : client.getQueryData(historyOptions.queryKey);
  const allDateUpdatedAt = loadAllDates
    ? historyQuery.dataUpdatedAt
    : (client.getQueryState(historyOptions.queryKey)?.dataUpdatedAt ?? 0);
  const allHistory = useMemo(
    () =>
      enabled && allDateOrders
        ? buildSpotOverview({
            allOrders: allDateOrders,
            config: data.config,
            updatedAt: allDateUpdatedAt,
            chainIds: scope.chainIds,
            partnerIds: scope.partnerIds,
          })
        : null,
    [
      allDateOrders,
      allDateUpdatedAt,
      data.config,
      scope.chainIds,
      scope.partnerIds,
      enabled,
    ],
  );
  const fullHistory = {
    ...data,
    ...allHistory,
    orders: allHistory?.orders ?? [],
    allOrders: allDateOrders ?? [],
    updatedAt: allDateUpdatedAt,
    isLoading: historyQuery.isPending,
    isHistoryLoading: historyQuery.isPending,
    isError: historyQuery.isError && !historyQuery.data,
    isRefreshError: historyQuery.isError,
    isRefreshing: historyQuery.isFetching,
    retry: () => {
      void historyQuery.refetch();
    },
    refresh: () => {
      data.refresh();
      void historyQuery.refetch();
    },
  };
  const overview = mode === "placement" ? data : fullHistory;
  const navigation = useMemo(
    () =>
      operationalNavigationScope(
        {
          period: scope.period,
          chainIds: scope.chainIds,
          partnerIds: scope.partnerIds,
        },
        mode,
      ),
    [scope.period, scope.chainIds, scope.partnerIds, mode],
  );
  return {
    placement: mode,
    setPlacement,
    allHistory: fullHistory,
    data: overview,
    hasAllDatesCount: Boolean(allHistory) || scope.days === undefined,
    navigation,
    scope: {
      ...scope,
      ...navigation,
      days: placement === "placement" ? scope.days : undefined,
      key: `${scope.key}:active-${placement}`,
    } as ReturnType<typeof useOrderScope>,
    counts: countOperationalActiveOrders(
      allHistory?.orders ?? data.orders,
      overview.orders,
    ),
  };
}
