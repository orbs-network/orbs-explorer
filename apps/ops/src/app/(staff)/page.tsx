"use client";

import { useMemo } from "react";
import { useOrderScope } from "@/hooks/use-order-scope";
import { OrderFilters } from "@/components/order-filters";
import { Page } from "@/components/page";
import { Button } from "@orbs/ui/controls/button";
import { useSpotOverview } from "@/hooks/use-spot-overview";
import { TradingAppsTable } from "@/components/orders-overview/trading-apps-table";
import { OrdersOverview } from "@/components/orders-overview/orders-overview";
import { useSearchParams } from "next/navigation";
import { OperationsDataProvider } from "@/components/operations/operations-view";
import { SnapshotFreshness } from "@/components/operations/snapshot-freshness";
import { SavedOverviewViews } from "@/components/orders-overview/saved-overview-views";
import { AttentionQueue } from "@/components/orders-overview/attention-queue";
import { buildPlacementReport } from "@/lib/placement-report";

export default function TwapOverviewPage() {
  const scope = useOrderScope();
  const { key: scopeKey } = scope;
  const searchParams = useSearchParams();
  const overview = useSpotOverview({ ...scope, loadTokenMetadata: false });
  const showInactivePartners =
    searchParams.get("show_inactive_partners") === "1";
  const { isLoading, isError, partnerCards, orders, warnings } = overview;
  const report = useMemo(
    () =>
      buildPlacementReport({
        allOrders: overview.allOrders,
        config: overview.config,
        updatedAt: overview.updatedAt,
        days: scope.days,
        chainIds: scope.chainIds,
        partnerIds: scope.partnerIds,
        currentCards: partnerCards,
      }),
    [
      overview.allOrders,
      overview.config,
      overview.updatedAt,
      scope.days,
      scope.chainIds,
      scope.partnerIds,
      partnerCards,
    ],
  );
  const visiblePartnerCards = showInactivePartners
    ? partnerCards
    : partnerCards.filter((card) =>
        card.chains.some((chain) => chain.orders.length > 0),
      );
  const hiddenPartnerCount = partnerCards.length - visiblePartnerCards.length;
  return (
    <Page>
      <OperationsDataProvider data={overview} scope={scope}>
        <div className="space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Overview
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <SavedOverviewViews />
              {overview.updatedAt > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <SnapshotFreshness
                    updatedAt={overview.updatedAt}
                    refreshing={overview.isRefreshing}
                    failed={overview.isRefreshError}
                  />
                </div>
              )}
            </div>
          </header>
          <OrderFilters
            scope={scope}
            networkOptions={overview.networkOptions}
            partnerOptions={overview.partnerOptions}
          />
          <AttentionQueue />
          {isLoading && (
            <p
              role="status"
              className="py-8 text-center text-sm text-muted-foreground"
            >
              Loading placement activity…
            </p>
          )}
          {isError && (
            <section role="alert" className="rounded-xl bg-destructive/10 p-5">
              <h2 className="font-semibold">
                Placement activity is unavailable
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Order history could not be loaded.
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={overview.retry}
              >
                Try again
              </Button>
            </section>
          )}
          {!isLoading && !isError && (
            <OrdersOverview
              key={`summary:${scopeKey}`}
              allOrders={orders}
              navigationScope={scope}
              report={report}
            />
          )}
          {warnings.map((warning) => (
            <p
              key={warning}
              role="status"
              className="rounded-lg bg-amber-500/10 p-3 text-sm text-foreground"
            >
              {warning}
            </p>
          ))}
          {!isLoading && !isError && (
            <section aria-label="Trading app activity" className="space-y-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
                <h2 className="text-lg font-semibold">
                  Trading apps{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({visiblePartnerCards.length})
                  </span>
                </h2>
              </div>
              <TradingAppsTable
                key={`apps:${scopeKey}`}
                partnerCards={visiblePartnerCards}
                snapshot={overview.updatedAt}
                navigationScope={scope}
                hiddenPartnerCount={hiddenPartnerCount}
                previousPartnerCards={report.previousCards}
              />
            </section>
          )}
        </div>
      </OperationsDataProvider>
    </Page>
  );
}
