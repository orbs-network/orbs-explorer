"use client";

import {
  createContext,
  use,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { RefreshCw } from "lucide-react";
import { Page } from "@/components/page";
import { OrderFilters } from "@/components/order-filters";
import { ExportOrders } from "@/components/orders-overview/export-orders";
import { StatusOrdersModal } from "@/components/orders-overview/status-order-modal";
import { useOrderScope } from "@/hooks/use-order-scope";
import { useSpotOverview } from "@/hooks/use-spot-overview";
import { Button } from "@orbs/ui/controls/button";
import { Spinner } from "@orbs/ui/controls/spinner";
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
  scopeLabel = "Current period, networks, and trading apps",
  children,
}: {
  data: ReturnType<typeof useSpotOverview>;
  scope: ReturnType<typeof useOrderScope>;
  scopeLabel?: string;
  children: ReactNode;
}) {
  const [selection, setSelection] = useState<{
    title: string;
    orders: ListOrder[];
    description?: string;
  } | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const inspectOrders = useCallback(
    (title: string, orders: ListOrder[], description?: string) => {
      if (!orders.length) return;
      previousFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setSelection({ title, orders, description });
    },
    [],
  );
  return (
    <OperationsContext value={{ ...data, scope, inspectOrders }}>
      {children}
      {selection && (
        <StatusOrdersModal
          open
          onOpenChange={(open) => {
            if (!open) setSelection(null);
          }}
          title={selection.title}
          partnerName={scopeLabel}
          orders={selection.orders}
          navigationScope={scope}
          description={
            selection.description ??
            "Matching orders from this view. Each row shows its latest reported status."
          }
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            previousFocus.current?.focus();
          }}
        />
      )}
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
  ) : data.isLoading ? (
    <div
      role="status"
      className="flex min-h-40 items-center justify-center gap-3 rounded-xl bg-card p-5"
    >
      <Spinner className="size-6 text-primary" />
      <p className="text-sm text-muted-foreground">Loading order history…</p>
    </div>
  ) : data.isError ? (
    <div role="alert" className="rounded-xl bg-destructive/10 p-6">
      <h2 className="font-semibold">{title} is unavailable</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Complete order history could not be loaded. Try again to retrieve the
        data.
      </p>
      <Button variant="outline" className="mt-4" onClick={data.retry}>
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
                refreshing={data.isRefreshing}
                failed={data.isRefreshError}
              />
            )}
            {dataContext === "orders" && filterFields !== "orders" && (
              <ExportOrders orders={viewData.orders} />
            )}
            {dataContext === "orders" && (
              <Button
                variant="outline"
                size="icon"
                aria-label={`Refresh ${title.toLowerCase()}`}
                title="Refresh data"
                disabled={data.isRefreshing}
                onClick={data.refresh}
              >
                <RefreshCw
                  aria-hidden
                  className={`size-4 ${data.isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
                />
              </Button>
            )}
          </div>
        </header>
        {dataContext === "orders" && (
          <OrderFilters
            periodLabel={
              timeBasis === "current" && operational.placement === "all"
                ? null
                : "Placed in"
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
            isLoading={data.isLoading}
            isUnavailable={data.isError}
          />
        )}
        {dataContext === "orders" &&
          data.warnings.map((warning) => (
            <p
              role="status"
              key={warning}
              className="rounded-lg bg-amber-500/10 p-3 text-sm"
            >
              {warning}
            </p>
          ))}
        {renderContent ? renderContent(content) : content}
      </div>
    </Page>
  );
}
