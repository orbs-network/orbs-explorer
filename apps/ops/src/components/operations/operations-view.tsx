"use client";

import { createContext, use, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Page } from "@/components/page";
import { OrderFilters } from "@/components/order-filters";
import { ExportOrders } from "@/components/orders-overview/export-orders";
import { useOrderDrilldown } from "@/hooks/use-order-drilldown";
import { useOrderScope } from "@/hooks/use-order-scope";
import { useSpotOverview } from "@/hooks/use-spot-overview";
import { Button } from "@orbs/ui/controls/button";
import {
  AnalyticsSkeleton,
  InlineSkeleton,
} from "@/components/loading-skeletons";
import type { ListOrder } from "@orbs/domain/twap/types";
import { SnapshotFreshness } from "./snapshot-freshness";
import { useOperationalScope } from "@/hooks/use-operational-scope";
import { OperationalScopeControl } from "./operational-scope-control";
import { InfoHint } from "@/components/info-hint";

export type OperationsData = ReturnType<typeof useSpotOverview> & {
  scope: ReturnType<typeof useOrderScope>;
  inspectOrders: (
    title: string,
    orders: ListOrder[],
    description?: string,
  ) => void;
};
const OperationsContext = createContext<OperationsData | null>(null);

export function useOperationsData() {
  const value = use(OperationsContext);
  if (!value)
    throw new Error("Operations content must be inside OperationsView");
  return value;
}

export function OperationsDataProvider({
  data,
  scope,
  scopeLabel: _scopeLabel,
  children,
}: {
  data: ReturnType<typeof useSpotOverview>;
  scope: ReturnType<typeof useOrderScope>;
  scopeLabel?: string;
  children: ReactNode;
}) {
  const inspectOrders = useOrderDrilldown(scope, data.updatedAt);
  return (
    <OperationsContext value={{ ...data, scope, inspectOrders }}>
      {children}
    </OperationsContext>
  );
}

export function OperationsView({
  title,
  description,
  children,
  filterFields,
  loadTokenMetadata = false,
  renderContent,
  showContentDuringHistoryLoad = false,
  timeBasis = "placement",
  dataContext = "orders",
  exportAction,
}: {
  title: string;
  description: string;
  children: ReactNode;
  filterFields?: "orders";
  loadTokenMetadata?: boolean;
  renderContent?: (content: ReactNode) => ReactNode;
  showContentDuringHistoryLoad?: boolean;
  timeBasis?: "placement" | "current";
  dataContext?: "orders" | "services";
  exportAction?: ReactNode;
}) {
  const scope = useOrderScope();
  const data = useSpotOverview({ ...scope, loadTokenMetadata });
  const operational = useOperationalScope(data, scope, timeBasis === "current");
  const viewData = timeBasis === "current" ? operational.data : data;
  const viewScope = timeBasis === "current" ? operational.scope : scope;
  const scopeLabel =
    timeBasis === "current"
      ? operational.placement === "all"
        ? "All placement dates · selected networks and trading apps"
        : "Selected placement period, networks, and trading apps"
      : undefined;
  const content = showContentDuringHistoryLoad ? (
    <OperationsDataProvider
      key={viewScope.key}
      data={viewData}
      scope={viewScope}
      scopeLabel={scopeLabel}
    >
      {children}
    </OperationsDataProvider>
  ) : viewData.isLoading ? (
    <AnalyticsSkeleton label={`Loading ${title.toLowerCase()}`} />
  ) : viewData.isError ? (
    <div role="alert" className="rounded-xl bg-destructive/10 p-6">
      <h2 className="font-semibold">{title} is unavailable</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Complete order history could not be loaded. Try again to retrieve the
        data.
      </p>
      <Button variant="outline" className="mt-4" onClick={viewData.retry}>
        Try again
      </Button>
    </div>
  ) : (
    <OperationsDataProvider
      key={viewScope.key}
      data={viewData}
      scope={viewScope}
      scopeLabel={scopeLabel}
    >
      {children}
    </OperationsDataProvider>
  );
  return (
    <Page>
      <div className="space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {title}
            </h1>
            <InfoHint>{description}</InfoHint>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dataContext === "orders" && data.updatedAt > 0 && (
              <SnapshotFreshness
                updatedAt={data.updatedAt}
                refreshing={viewData.isRefreshing}
                failed={viewData.isRefreshError}
              />
            )}
            {dataContext === "orders" &&
              filterFields !== "orders" &&
              (exportAction === undefined ? (
                viewData.isLoading ? (
                  <InlineSkeleton
                    label="Preparing order export"
                    className="h-8 w-24"
                  />
                ) : (
                  <ExportOrders
                    orders={viewData.orders}
                    snapshotAt={viewData.updatedAt}
                  />
                )
              ) : (
                exportAction
              ))}
            {dataContext === "orders" && (
              <Button
                variant="outline"
                size="icon"
                aria-label={`Refresh ${title.toLowerCase()}`}
                title="Refresh data"
                disabled={viewData.isRefreshing}
                onClick={viewData.refresh}
              >
                <RefreshCw
                  aria-hidden
                  className={`size-4 ${viewData.isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
                />
              </Button>
            )}
          </div>
        </header>
        {dataContext === "orders" && (
          <OrderFilters
            isLoading={data.isLoading}
            periodLabel={
              timeBasis === "current" && operational.placement === "all"
                ? null
                : "Order period"
            }
            scope={scope}
            networkOptions={data.networkOptions}
            partnerOptions={data.partnerOptions}
            orderTypes={
              filterFields === "orders"
                ? [
                    ...new Set(
                      data.orders.map(
                        (order) =>
                          order.metadata.orderType?.trim() || "unreported",
                      ),
                    ),
                  ].sort()
                : undefined
            }
          />
        )}
        {timeBasis === "current" && (
          <OperationalScopeControl
            {...operational}
            period={scope.period}
            isLoading={viewData.isLoading}
            isUnavailable={viewData.isError}
          />
        )}
        {dataContext === "orders" &&
          data.warnings.map((warning) => (
            <p
              role="status"
              key={warning}
              className="rounded-lg bg-warning-surface p-3 text-sm"
            >
              {warning}
            </p>
          ))}
        {renderContent ? renderContent(content) : content}
      </div>
    </Page>
  );
}
