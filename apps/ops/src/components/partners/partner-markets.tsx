"use client";

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Token } from "@orbs/domain/types";
import { tokenQueryKey } from "@orbs/domain/token-metadata";
import { getOverviewOrderStatus } from "@orbs/domain/twap/utils/orders-overview";
import {
  RouteRankings,
  TokenRankings,
} from "@/components/analytics/market-rankings";
import { useOperationsData } from "@/components/operations/operations-view";
import { buildMarketAnalytics } from "@/lib/market-analytics";
import { SelectionFilter } from "@/components/selection-filter";
import { useSelectionFilter } from "@/hooks/use-selection-filter";

function usePartnerMarkets(cohort = "all") {
  const { orders, inspectOrders } = useOperationsData();
  const queryClient = useQueryClient();
  const data = useMemo(
    () =>
      buildMarketAnalytics(
        cohort === "failed"
          ? orders.filter((order) => getOverviewOrderStatus(order) === "failed")
          : orders,
        (address, chainId) =>
          queryClient.getQueryData<Token | null>(
            tokenQueryKey(address, chainId),
          ) ?? undefined,
      ),
    [orders, queryClient, cohort],
  );
  return { data, inspectOrders };
}

export function PartnerRoutes() {
  const { orders } = useOperationsData();
  const [cohort, setCohort] = useSelectionFilter("pair_cohort", "all", [
    "all",
    "failed",
  ]);
  const { data, inspectOrders } = usePartnerMarkets(cohort);
  const failed = orders.filter(
    (order) => getOverviewOrderStatus(order) === "failed",
  ).length;
  return (
    <div className="space-y-3">
      <SelectionFilter
        label="Pair filters"
        fieldLabel="Order cohort"
        value={cohort}
        onChange={setCohort}
        options={[
          {
            value: "all",
            label: `All orders (${orders.length.toLocaleString()})`,
          },
          {
            value: "failed",
            label: `Failed orders (${failed.toLocaleString()})`,
          },
        ]}
      />
      {cohort === "failed" && (
        <p className="text-xs text-muted-foreground">
          Only currently failed orders are counted below. Pair order counts are
          failure counts for this cohort.
        </p>
      )}
      <RouteRankings routes={data.routes} inspect={inspectOrders} />
    </div>
  );
}

export function PartnerTokens() {
  const { data, inspectOrders } = usePartnerMarkets();
  return <TokenRankings tokens={data.tokens} inspect={inspectOrders} />;
}
