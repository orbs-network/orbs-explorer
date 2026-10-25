"use client";

import { useDeferredValue, useId, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Settings2 } from "lucide-react";
import { Button } from "@orbs/ui/controls/button";
import { Input } from "@orbs/ui/controls/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@orbs/ui/controls/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@orbs/ui/controls/select";
import { OrderFilters } from "@/components/order-filters";
import { useOperationsData } from "@/components/operations/operations-view";
import { EmptyState } from "@/components/operations/primitives";
import { ExportOrders } from "@/components/orders-overview/export-orders";
import { formatOrderUsd } from "@/components/orders-overview/overview-display";
import { useOrderSearchLabels } from "@/hooks/use-order-search-labels";
import { useInvestigationFilters } from "@/hooks/use-investigation-filters";
import {
  investigateOrders,
  getUsdRangeError,
  getPlacementRangeError,
  type InvestigationSort,
} from "@/lib/order-investigation";
import { reportedNumber } from "@/lib/order-diagnostics";
import {
  buildOrderFacets,
  matchingOrderQuickView,
  orderHashSearchHref,
  orderQuickViewFilters,
  ORDER_QUICK_VIEWS,
  type OrderQuickView,
} from "@/lib/order-quick-views";
import { OrdersTable } from "./orders-table";
import { OrderStatusFilters } from "./order-status-filters";

function RowsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading order history"
      className="overflow-hidden rounded-xl bg-card"
    >
      <span className="sr-only">Loading order history…</span>
      <div className="h-10 border-b border-border bg-muted/30" />
      {Array.from({ length: 8 }, (_, index) => (
        <div
          key={index}
          className="flex h-14 items-center gap-4 border-b border-border px-4 last:border-0 motion-safe:animate-pulse"
        >
          <span className="h-3 w-1/4 rounded bg-muted" />
          <span className="h-3 w-1/3 rounded bg-muted" />
          <span className="ml-auto h-3 w-16 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function OrdersList({ showRawFields }: { showRawFields: boolean }) {
  const {
    orders,
    partnerCards,
    updatedAt,
    isHistoryLoading,
    isCatalogLoading,
    isMetadataLoading,
    isError,
    retry,
    scope,
    networkOptions,
    partnerOptions,
  } = useOperationsData();
  const { filters, setFilters, applyFilters } = useInvestigationFilters();
  const waitingForScope =
    !isError &&
    (isHistoryLoading || (isCatalogLoading && scope.partnerIds.length > 0));
  const router = useRouter(),
    pathname = usePathname(),
    search = useSearchParams();
  const id = useId();
  const query = useDeferredValue(filters.query);
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
  const labels = useOrderSearchLabels(orders, names);
  const effective = useMemo(() => ({ ...filters, query }), [filters, query]);
  const results = useMemo(
    () => investigateOrders(orders, effective, labels, updatedAt),
    [orders, effective, labels, updatedAt],
  );
  const facets = useMemo(
    () => buildOrderFacets(orders, effective, labels, updatedAt),
    [orders, effective, labels, updatedAt],
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
  const rangeError =
    getUsdRangeError(filters.minUsd, filters.maxUsd) ||
    getPlacementRangeError(filters.placedSince, filters.placedUntil);
  const quickView = matchingOrderQuickView(filters);
  return (
    <div className="min-w-0 space-y-3">
      <div className="space-y-3 border-b border-border bg-background py-3 shadow-[0_1px_0_var(--border)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <OrderFilters
            applicationMode="immediate"
            omitStatus
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
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor={`${id}-view`} className="text-muted-foreground">
              View
            </label>
            <Select
              value={quickView}
              onValueChange={(next) => {
                if (next !== "custom")
                  applyFilters(orderQuickViewFilters(next as OrderQuickView));
              }}
            >
              <SelectTrigger id={`${id}-view`} className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {quickView === "custom" && (
                  <SelectItem value="custom">Custom filters</SelectItem>
                )}
                {ORDER_QUICK_VIEWS.map((view) => (
                  <SelectItem key={view.value} value={view.value}>
                    {view.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <label htmlFor={`${id}-search`} className="sr-only">
              Search orders
            </label>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={`${id}-search`}
              name="order_search"
              type="search"
              autoComplete="off"
              spellCheck={false}
              value={filters.query}
              onChange={(event) => {
                const href = orderHashSearchHref(event.target.value, scope);
                if (href) router.push(href);
                else
                  setFilters((previous) => ({
                    ...previous,
                    query: event.target.value,
                  }));
              }}
              placeholder="Order ID, app, token, address, or error…"
              className="h-9 pl-9"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Order display options"
              >
                <Settings2 aria-hidden className="size-3.5" />
                Display
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={showRawFields}
                onCheckedChange={(checked) => {
                  const next = new URLSearchParams(search.toString());
                  next.delete("orders_view");
                  if (checked) next.set("order_raw", "1");
                  else next.delete("order_raw");
                  router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
                    scroll: false,
                  });
                }}
              >
                Show raw fields
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className={showRawFields ? undefined : "lg:hidden"}>
            <Select
              value={filters.sort}
              onValueChange={(sort) =>
                setFilters((previous) => ({
                  ...previous,
                  sort: sort as InvestigationSort,
                }))
              }
            >
              <SelectTrigger
                aria-label="Sort orders"
                className="h-9 w-40 text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  ["newest", "Newest placed first"],
                  ["oldest", "Oldest placed first"],
                  ["value-desc", "Largest placed value"],
                  ["value-asc", "Smallest placed value"],
                  ["errors-desc", "Most failed chunks"],
                  ["errors-asc", "Fewest failed chunks"],
                ].map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ExportOrders orders={results} context="matching" />
        </div>
        {!waitingForScope && !isError && (
          <OrderStatusFilters
            facets={facets}
            filters={filters}
            onChange={applyFilters}
          />
        )}
        <div
          role="status"
          aria-live="polite"
          aria-busy={
            waitingForScope || query !== filters.query || resolvingSearchLabels
          }
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums"
        >
          {waitingForScope ? (
            <span>
              {isHistoryLoading
                ? "Loading matching orders…"
                : "Resolving the trading app selection…"}
            </span>
          ) : isError ? (
            <span>Matching totals unavailable</span>
          ) : (
            <>
              <strong className="font-medium text-foreground">
                {results.length.toLocaleString()} matching{" "}
                {results.length === 1 ? "order" : "orders"}
                {query !== filters.query ? " · Searching…" : ""}
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
              {resolvingSearchLabels && <span>Resolving token names…</span>}
            </>
          )}
        </div>
      </div>
      {isCatalogLoading && !waitingForScope && (
        <p role="status" className="text-xs text-muted-foreground">
          Trading app names are loading. Order records and totals are already
          available.
        </p>
      )}
      {rangeError && (
        <p role="alert" className="text-xs text-destructive">
          {rangeError} Open Filters to correct the range.
        </p>
      )}
      {waitingForScope ? (
        <RowsSkeleton />
      ) : isError ? (
        <div role="alert" className="rounded-lg bg-destructive/10 p-5">
          <h2 className="font-medium">Order history is unavailable</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Order history must finish loading before complete results can be
            shown.
          </p>
          <Button variant="outline" className="mt-3" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : results.length ? (
        <OrdersTable
          orders={results}
          partners={names}
          showRawFields={showRawFields}
          sort={filters.sort}
          onSort={(sort) => setFilters((previous) => ({ ...previous, sort }))}
        />
      ) : (
        <EmptyState
          title={
            rangeError
              ? "Check the USD range"
              : resolvingSearchLabels
                ? "Resolving token names…"
                : "No matching orders"
          }
          description={
            rangeError ??
            (resolvingSearchLabels
              ? "Address and raw-field results are available; token-name results may update as metadata loads."
              : "Change the status chips, search, quick view, or page filters.")
          }
        />
      )}
    </div>
  );
}
