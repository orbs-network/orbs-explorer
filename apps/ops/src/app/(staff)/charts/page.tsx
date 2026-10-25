"use client";

import dynamic from "next/dynamic";
import { RefreshCw } from "lucide-react";
import { Page } from "@/components/page";
import { OrderFilters } from "@/components/order-filters";
import { useOrderScope } from "@/hooks/use-order-scope";
import { useSpotOverview } from "@/hooks/use-spot-overview";
import { Button } from "@orbs/ui/controls/button";
import { Spinner } from "@orbs/ui/controls/spinner";
import { ExportOrders } from "@/components/orders-overview/export-orders";
import { SnapshotFreshness } from "@/components/operations/snapshot-freshness";
import { OperationsDataProvider } from "@/components/operations/operations-view";
import { InfoHint } from "@/components/info-hint";

const OrderCharts = dynamic(() => import("@/components/charts/order-charts"), {
  ssr: false,
  loading: () => (
    <p
      role="status"
      className="py-16 text-center text-sm text-muted-foreground"
    >
      Preparing charts…
    </p>
  ),
});

export default function ChartsPage() {
  const scope = useOrderScope();
  const overview = useSpotOverview({ ...scope, loadTokenMetadata: false });
  return (
    <Page>
      <div className="space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Activity
            </h1>
            <InfoHint>
              Track orders placed over time. Chart dates use UTC.
            </InfoHint>
          </div>
          <div className="flex items-center gap-2">
            {overview.updatedAt > 0 && (
              <SnapshotFreshness
                updatedAt={overview.updatedAt}
                refreshing={overview.isRefreshing}
                failed={overview.isRefreshError}
              />
            )}
            <ExportOrders orders={overview.orders} />
            <Button
              variant="outline"
              size="icon"
              aria-label="Refresh activity"
              title="Refresh activity"
              onClick={overview.refresh}
              disabled={overview.isRefreshing}
            >
              <RefreshCw
                aria-hidden
                className={`size-4 ${overview.isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
              />
            </Button>
          </div>
        </header>
        <OrderFilters
          scope={scope}
          networkOptions={overview.networkOptions}
          partnerOptions={overview.partnerOptions}
        />
        {overview.warnings.map((warning) => (
          <p
            key={warning}
            role="status"
            className="rounded-lg bg-amber-500/10 p-3 text-sm"
          >
            {warning}
          </p>
        ))}
        {overview.isLoading ? (
          <div
            role="status"
            className="flex min-h-64 flex-col items-center justify-center gap-3"
          >
            <Spinner className="size-8 text-primary" />
            <p className="text-sm text-muted-foreground">
              Loading order activity…
            </p>
          </div>
        ) : overview.isError ? (
          <div role="alert" className="rounded-xl bg-destructive/10 p-6">
            <h2 className="font-semibold">Activity is unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Order activity could not be loaded. Try again to load complete
              totals.
            </p>
            <Button variant="outline" className="mt-4" onClick={overview.retry}>
              Try again
            </Button>
          </div>
        ) : overview.orders.length ? (
          <OperationsDataProvider data={overview} scope={scope}>
            <OrderCharts key={scope.key} />
          </OperationsDataProvider>
        ) : (
          <div className="rounded-xl bg-card p-10 text-center">
            <h2 className="font-medium">No orders to chart</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Try a different period, network, or trading app.
            </p>
            <Button variant="outline" className="mt-4" onClick={scope.reset}>
              Reset chart filters
            </Button>
          </div>
        )}
      </div>
    </Page>
  );
}
