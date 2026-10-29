"use client";

import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
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
import { buildPlacementReport } from "@/lib/placement-report";
import { OverviewSkeleton } from "@/components/loading-skeletons";

export default function TwapOverviewPage() {
  const scope = useOrderScope();
  const { key: scopeKey } = scope;
  const searchParams = useSearchParams();
  const overview = useSpotOverview({
    ...scope,
    loadTokenMetadata: false,
    includePreviousPeriod: true,
  });
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
            <div className="flex flex-wrap items-center gap-2">
              {overview.updatedAt > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <SnapshotFreshness
                    updatedAt={overview.updatedAt}
                    refreshing={overview.isRefreshing}
                    failed={overview.isRefreshError}
                  />
                </div>
              )}
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={overview.isRefreshing}
                onClick={overview.refresh}
                aria-label="Refresh overview"
              >
                <RefreshCw
                  aria-hidden
                  className={`size-3.5 ${overview.isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
                />
              </Button>
            </div>
          </header>
          <OrderFilters
            isLoading={isLoading}
            scope={scope}
            networkOptions={overview.networkOptions}
            partnerOptions={overview.partnerOptions}
          />
          {isLoading && !isError && <OverviewSkeleton />}
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
              className="rounded-lg bg-warning-surface p-3 text-sm text-foreground"
            >
              {warning}
            </p>
          ))}
          {!isLoading && !isError && (
            <section aria-label="Trading app activity">
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
