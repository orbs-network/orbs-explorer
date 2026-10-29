"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@orbs/ui/controls/button";
import { Page } from "@/components/page";
import { useOrderScope } from "@/hooks/use-order-scope";
import { useSpotOverview } from "@/hooks/use-spot-overview";
import { useInvestigationFilters } from "@/hooks/use-investigation-filters";
import { OperationsDataProvider } from "@/components/operations/operations-view";
import { SnapshotFreshness } from "@/components/operations/snapshot-freshness";
import { orderHashSearchHref } from "@/lib/order-quick-views";
import { OrderLookup } from "./order-lookup";
import { OrdersList } from "./orders-list";
import { OrderDetailSkeleton } from "@/components/loading-skeletons";

function HashSearchRedirect({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [href, router]);
  return (
    <Page>
      <OrderDetailSkeleton />
    </Page>
  );
}

/** Handle old lookup links and exact hashes before mounting any history queries. */
export function OrdersWorkspace() {
  const search = useSearchParams();
  const scope = useOrderScope();
  const href = orderHashSearchHref(search.get("order_search") ?? "", scope);
  const legacyScopeQuery = new URLSearchParams(scope.query);
  legacyScopeQuery.delete("orders_view");
  if (href) return <HashSearchRedirect href={href} />;
  if (search.get("orders_view") === "lookup")
    return (
      <Page>
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">All orders</h1>
          <OrderLookup
            navigationScope={{
              ...scope,
              query: legacyScopeQuery.toString(),
            }}
          />
        </div>
      </Page>
    );
  return <OrdersDataWorkspace />;
}

function OrdersDataWorkspace() {
  const scope = useOrderScope();
  const { filters } = useInvestigationFilters();
  const data = useSpotOverview({ ...scope, loadTokenMetadata: true, filters });
  return (
    <Page>
      <OperationsDataProvider data={data} scope={scope}>
        <OrdersList
          header={(exportAction) => (
            <>
              <header className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  All orders
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  {data.updatedAt > 0 && (
                    <SnapshotFreshness
                      updatedAt={data.updatedAt}
                      refreshing={data.isRefreshing}
                      failed={data.isRefreshError}
                    />
                  )}
                  {exportAction}
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={data.isRefreshing}
                    onClick={data.refresh}
                    aria-label="Refresh all orders"
                  >
                    <RefreshCw
                      aria-hidden
                      className={`size-3.5 ${data.isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
                    />
                  </Button>
                </div>
              </header>
              {data.warnings.map((warning) => (
                <p
                  key={warning}
                  role="status"
                  className="rounded-lg bg-warning-surface p-3 text-xs"
                >
                  {warning}
                </p>
              ))}
            </>
          )}
        />
      </OperationsDataProvider>
    </Page>
  );
}
