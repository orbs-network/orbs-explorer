"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  readOrderSelection,
  selectionOrders,
  orderIdentity,
} from "@/lib/order-selection";
import { Button } from "@orbs/ui/controls/button";
import { OrderFilters } from "@/components/order-filters";
import { useOperationsData } from "@/components/operations/operations-view";
import { EmptyState } from "@/components/operations/primitives";
import { ExportOrders } from "@/components/orders-overview/export-orders";
import {
  formatOrderUsd,
  formatOrderDate,
} from "@/components/orders-overview/overview-display";
import { useOrderSearchLabels } from "@/hooks/use-order-search-labels";
import { useInvestigationFilters } from "@/hooks/use-investigation-filters";
import {
  investigateOrders,
  getUsdRangeError,
  getPlacementRangeError,
  getSwapperAddressError,
  type InvestigationSort,
} from "@/lib/order-investigation";
import { reportedNumber } from "@/lib/order-diagnostics";
import { OrdersTable } from "./orders-table";
import { InlineSkeleton, TableSkeleton } from "@/components/loading-skeletons";

const subscribeSelection = () => () => {};

export function OrdersList({
  embedded = false,
  header,
}: {
  embedded?: boolean;
  header?: (exportAction: ReactNode) => ReactNode;
} = {}) {
  const {
    orders,
    partnerCards,
    updatedAt,
    isHistoryLoading,
    isCatalogLoading,
    isMetadataLoading,
    isError: isHistoryError,
    retry: retryHistory,
    scope,
    historyScope,
    networkOptions,
    partnerOptions,
  } = useOperationsData();
  const { filters, setFilters, applyFilters } = useInvestigationFilters();
  const hasSwapper = Boolean(filters.swapper.trim());
  const waitingForSwapper =
    hasSwapper && !getSwapperAddressError(filters.swapper) && isHistoryLoading;
  const swapperFailed = hasSwapper && isHistoryError;
  const isError = isHistoryError || swapperFailed;
  const retry = () => {
    retryHistory();
  };
  const waitingForScope =
    !isError && (isHistoryLoading || isCatalogLoading || waitingForSwapper);
  const router = useRouter(),
    pathname = usePathname(),
    search = useSearchParams();
  const query = useDeferredValue(filters.query);
  useEffect(() => {
    const next = new URLSearchParams(search.toString());
    if (
      !next.has("table_page_order_investigation_results") &&
      !next.has("table_size_order_investigation_results")
    )
      return;
    next.delete("table_page_order_investigation_results");
    next.delete("table_size_order_investigation_results");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
      scroll: false,
    });
  }, [pathname, router, search]);
  const resolvingSearchLabels = Boolean(query.trim()) && isMetadataLoading;
  const names = useMemo(
    () =>
      new Map(
        partnerCards.flatMap((partner) =>
          partner.chains.flatMap((chain) =>
            chain.orders.map((order) => [order, partner.partnerName] as const),
          ),
        ),
      ),
    [partnerCards],
  );
  const selectionId = search.get("order_set");
  const selectionState = useSyncExternalStore(
    subscribeSelection,
    () => {
      if (!selectionId) return "none";
      try {
        return (
          sessionStorage.getItem(`orbs-ops-order-set:${selectionId}`) ??
          "missing"
        );
      } catch {
        return "missing";
      }
    },
    () => (selectionId ? "loading" : "none"),
  );
  const selection = useMemo(
    () =>
      selectionId && selectionState !== "loading"
        ? readOrderSelection(selectionId)
        : null,
    [selectionId, selectionState],
  );
  const selectedOrders = useMemo(
    () =>
      selectionId
        ? selection
          ? selectionOrders(orders, selection)
          : []
        : orders,
    [orders, selectionId, selection],
  );
  const clearSelection = () => {
    const next = new URLSearchParams(search.toString());
    next.delete("order_set");
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const labels = useOrderSearchLabels(orders, names);
  const effective = useMemo(() => ({ ...filters, query }), [filters, query]);
  const swapperMatches = useMemo(
    () =>
      historyScope.swapper === filters.swapper.trim().toLowerCase()
        ? new Set(orders.map(orderIdentity))
        : undefined,
    [historyScope.swapper, filters.swapper, orders],
  );
  const results = useMemo(
    () =>
      investigateOrders(
        selectedOrders,
        effective,
        labels,
        updatedAt,
        swapperMatches,
      ),
    [selectedOrders, effective, labels, updatedAt, swapperMatches],
  );
  const value = useMemo(
    () =>
      results.reduce(
        (total, order) => {
          const usd = reportedNumber(order.totalUSDAmount);
          return {
            sum: total.sum + (usd ?? 0),
            reported: total.reported + (usd === undefined ? 0 : 1),
          };
        },
        { sum: 0, reported: 0 },
      ),
    [results],
  );
  const filterError =
    getSwapperAddressError(filters.swapper) ||
    getUsdRangeError(filters.minUsd, filters.maxUsd) ||
    getPlacementRangeError(filters.placedSince, filters.placedUntil);
  const waitingForResults =
    waitingForScope ||
    query !== filters.query ||
    selectionState === "loading" ||
    (!isError && !filterError && resolvingSearchLabels);
  const exportAction = waitingForResults ? (
    <InlineSkeleton label="Preparing order export" className="h-8 w-24" />
  ) : (
    <ExportOrders orders={results} snapshotAt={updatedAt} />
  );
  return (
    <div className="min-w-0 space-y-3">
      {header?.(exportAction)}
      {selectionId && (
        <section
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary/5 p-4 text-sm"
          aria-label="Selected order set"
        >
          <div>
            <p className="font-medium">
              {selection?.label ??
                (selectionState === "loading" ? (
                  <InlineSkeleton
                    label="Opening selected orders"
                    className="w-52"
                  />
                ) : (
                  "Selection unavailable in this browser session"
                ))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selection
                ? `${selection.keys.length} selected orders · snapshot ${formatOrderDate(selection.snapshot)} · records reflect their latest reported state.`
                : "Return to the analysis and select the count again, or clear the selection."}
            </p>
            {selection && (
              <Link
                href={selection.origin}
                className="mt-2 inline-block rounded-sm text-xs text-link hover:underline"
              >
                Back to analysis
              </Link>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={clearSelection}>
            Clear selection
          </Button>
        </section>
      )}
      {selection &&
        !waitingForScope &&
        selectedOrders.length < selection.keys.length && (
          <p
            role="status"
            className="rounded-lg bg-warning-surface p-3 text-xs"
          >
            {selection.keys.length - selectedOrders.length} selected records are
            absent from the latest scoped history. The totals below include only
            available records.
          </p>
        )}
      <div className="space-y-3 bg-background py-1">
        {!embedded && (
          <div
            className={
              header
                ? "min-w-0"
                : "flex flex-wrap items-center justify-between gap-2"
            }
          >
            <OrderFilters
              isLoading={isHistoryLoading || isCatalogLoading}
              scope={scope}
              networkOptions={networkOptions}
              partnerOptions={partnerOptions}
              orderTypes={[
                ...new Set(
                  orders.map(
                    (order) => order.metadata.orderType?.trim() || "unreported",
                  ),
                ),
              ].sort()}
            />
            {!header && exportAction}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div
            role={
              waitingForResults || resolvingSearchLabels ? undefined : "status"
            }
            aria-live={
              waitingForResults || resolvingSearchLabels ? undefined : "polite"
            }
            aria-busy={
              waitingForResults ||
              query !== filters.query ||
              resolvingSearchLabels
            }
            className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums"
          >
            {waitingForResults ? (
              <InlineSkeleton
                label={
                  waitingForSwapper
                    ? "Loading orders for this swapper"
                    : isHistoryLoading
                      ? "Loading matching orders"
                      : resolvingSearchLabels
                        ? "Resolving token names"
                        : "Resolving the trading app selection"
                }
                className="w-72"
              />
            ) : isError ? (
              <span>Matching totals unavailable</span>
            ) : (
              <>
                <strong className="font-medium text-foreground">
                  {results.length.toLocaleString()} matching{" "}
                  {results.length === 1 ? "order" : "orders"}
                </strong>
                <span
                  title={`${value.reported}/${results.length} matching orders report valid USD`}
                >
                  Placed value{" "}
                  <strong className="font-medium text-foreground">
                    {value.reported || !results.length
                      ? formatOrderUsd(value.sum)
                      : "—"}
                  </strong>
                </span>
                {value.reported < results.length && (
                  <span>
                    {value.reported}/{results.length} report USD
                  </span>
                )}
                {resolvingSearchLabels && (
                  <InlineSkeleton label="Resolving token names" />
                )}
              </>
            )}
          </div>
          {embedded && !header && exportAction}
        </div>
      </div>
      {isCatalogLoading && !waitingForScope && (
        <InlineSkeleton label="Loading trading app names" className="w-52" />
      )}
      {filterError && (
        <p role="alert" className="text-xs text-destructive">
          {filterError} Open Filters to correct the value.
        </p>
      )}
      {waitingForResults ? (
        <TableSkeleton
          label={
            resolvingSearchLabels
              ? "Resolving token names"
              : "Loading order history"
          }
        />
      ) : isError ? (
        <div role="alert" className="rounded-lg bg-destructive/10 p-5">
          <h2 className="font-medium">
            {swapperFailed
              ? "Swapper orders could not be loaded"
              : "Order history is unavailable"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {swapperFailed
              ? "The swapper lookup must finish successfully before matching orders can be shown."
              : "Order history must finish loading before complete results can be shown."}
          </p>
          <Button variant="outline" className="mt-3" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : results.length ? (
        <OrdersTable
          orders={results}
          partners={names}
          sort={filters.sort}
          onSort={(sort) => setFilters((previous) => ({ ...previous, sort }))}
        />
      ) : (
        <div>
          <EmptyState
            title={
              filterError
                ? "Check filters"
                : resolvingSearchLabels
                  ? "Resolving token names…"
                  : "No matching orders"
            }
            description={
              filterError ??
              (resolvingSearchLabels
                ? "Address and raw-field results are available; token-name results may update as metadata loads."
                : "Change the search or open Filters to adjust the order criteria.")
            }
          />
          <div className="mt-3 flex justify-center gap-2">
            {filters.query && (
              <Button
                variant="outline"
                onClick={() =>
                  setFilters((previous) => ({ ...previous, query: "" }))
                }
              >
                Clear search
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                applyFilters({
                  ...filters,
                  query: "",
                  status: "all",
                  type: "all",
                  errors: "all",
                  token: "",
                  swapper: "",
                  adapter: "",
                  activeAge: "all",
                  deadline: "all",
                  source: "all",
                  minUsd: "",
                  maxUsd: "",
                  placedSince: "",
                  placedUntil: "",
                });
              }}
            >
              Reset order filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
