"use client";

import { useMemo } from "react";
import type { useSpotOverview } from "./use-spot-overview";
import type { useOrderScope } from "./use-order-scope";
import { useSelectionFilter } from "./use-selection-filter";
import { buildSpotOverview } from "../lib/overview-data";
import {
  countOperationalActiveOrders,
  operationalNavigationScope,
  type OperationalPlacementScope,
} from "../lib/operational-scope";

/** Derives current exposure from the existing complete-history cache; no query. */
export function useOperationalScope(
  data: ReturnType<typeof useSpotOverview>,
  scope: ReturnType<typeof useOrderScope>,
  enabled = true,
) {
  const [placement, setPlacement] = useSelectionFilter("active_scope", "all", [
    "all",
    "placement",
  ] as const);
  const allHistory = useMemo(
    () =>
      enabled
        ? buildSpotOverview({
            allOrders: data.allOrders,
            config: data.config,
            updatedAt: data.updatedAt,
            chainIds: scope.chainIds,
            partnerIds: scope.partnerIds,
          })
        : null,
    [
      data.allOrders,
      data.config,
      data.updatedAt,
      scope.chainIds,
      scope.partnerIds,
      enabled,
    ],
  );
  const mode = placement as OperationalPlacementScope;
  const fullHistory = allHistory ?? data;
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
    data: { ...data, ...overview },
    navigation,
    scope: {
      ...scope,
      ...navigation,
      days: placement === "placement" ? scope.days : undefined,
      key: `${scope.key}:active-${placement}`,
    } as ReturnType<typeof useOrderScope>,
    counts: countOperationalActiveOrders(fullHistory.orders, overview.orders),
  };
}
