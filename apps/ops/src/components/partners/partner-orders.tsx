"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@orbs/ui/controls/button";
import { Input } from "@orbs/ui/controls/input";
import { useOperationsData } from "@/components/operations/operations-view";
import { EmptyState, Panel } from "@/components/operations/primitives";
import { ExportOrders } from "@/components/orders-overview/export-orders";
import {
  InvestigationSelect,
  InvestigationSelectItem,
} from "@/components/investigation/investigation-controls";
import { OrderLookup } from "@/components/investigation/order-lookup";
import { OrdersTable } from "@/components/investigation/orders-table";
import { useOrderSearchLabels } from "@/hooks/use-order-search-labels";
import { useInvestigationFilters } from "@/hooks/use-investigation-filters";
import {
  getUsdRangeError,
  investigateOrders,
  type InvestigationFilters,
  type InvestigationSort,
} from "@/lib/order-investigation";

export function PartnerOrders() {
  const { orders, partnerCards } = useOperationsData();
  const { filters, setFilters } = useInvestigationFilters();
  const filterKey = JSON.stringify(filters);
  const [pagination, setPagination] = useState({ key: filterKey, page: 0 });
  const page = pagination.key === filterKey ? pagination.page : 0;
  const setPage = (page: number) => setPagination({ key: filterKey, page });
  const [pageSize, setPageSize] = useState(10);
  const id = useId();
  const deferredQuery = useDeferredValue(filters.query);
  const partnerNames = useMemo(
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
  const searchLabels = useOrderSearchLabels(orders, partnerNames);
  const results = useMemo(
    () =>
      investigateOrders(
        orders,
        { ...filters, query: deferredQuery },
        searchLabels,
      ),
    [orders, filters, deferredQuery, searchLabels],
  );
  const pageCount = Math.max(1, Math.ceil(results.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = results.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  const rangeError = getUsdRangeError(filters.minUsd, filters.maxUsd);
  const update = <Key extends keyof InvestigationFilters>(
    key: Key,
    value: InvestigationFilters[Key],
  ) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(0);
  };

  return (
    <Panel
      title="Partner orders"
      description="Search every order in this partner’s scope before pagination. Use Filters at the top of the page for status, errors, and placed value. Open a hash for its diagnostic page."
      action={<ExportOrders orders={results} />}
    >
      <div className="space-y-4">
        <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0 space-y-1.5">
            <label
              htmlFor={`${id}-search`}
              className="text-xs text-muted-foreground"
            >
              Search orders
            </label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id={`${id}-search`}
                name="partner_order_search"
                type="search"
                autoComplete="off"
                spellCheck={false}
                value={filters.query}
                onChange={(event) => update("query", event.target.value)}
                placeholder="Hash, token, adapter, error, network, date…"
                className="pl-9"
              />
            </div>
          </div>
          <InvestigationSelect
            label="Sort orders"
            hideLabel
            value={filters.sort}
            onChange={(value) => update("sort", value as InvestigationSort)}
          >
            <InvestigationSelectItem value="newest">
              Newest placed first
            </InvestigationSelectItem>
            <InvestigationSelectItem value="oldest">
              Oldest placed first
            </InvestigationSelectItem>
            <InvestigationSelectItem value="value-desc">
              Largest placed value
            </InvestigationSelectItem>
            <InvestigationSelectItem value="value-asc">
              Smallest placed value
            </InvestigationSelectItem>
            <InvestigationSelectItem value="errors-desc">
              Most failed chunks
            </InvestigationSelectItem>
          </InvestigationSelect>
        </div>
        {rangeError && (
          <p
            id={`${id}-range-error`}
            role="alert"
            className="text-xs text-destructive"
          >
            {rangeError}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
            role="status"
            aria-live="polite"
            aria-busy={deferredQuery !== filters.query}
            className="text-xs text-muted-foreground"
          >
            {results.length
              ? `${(currentPage * pageSize + 1).toLocaleString()}–${Math.min((currentPage + 1) * pageSize, results.length).toLocaleString()} of ${results.length.toLocaleString()} matching orders`
              : "No matching orders"}
            {deferredQuery !== filters.query ? " · Updating search…" : ""}
          </p>
        </div>
        {results.length ? (
          <OrdersTable
            orders={visible}
            partners={partnerNames}
            showApp={false}
          />
        ) : (
          <EmptyState
            title={rangeError ? "Check the USD range" : "No matching orders"}
            description={
              rangeError ??
              "Change the search, order filters, or the selected period and networks."
            }
          />
        )}
        {results.length > 0 && (
          <nav
            aria-label="Partner order result pages"
            className="flex flex-wrap items-end justify-between gap-3"
          >
            <div className="flex flex-wrap items-end gap-4">
              <p className="pb-2 text-xs text-muted-foreground">
                Page {(currentPage + 1).toLocaleString()} of{" "}
                {pageCount.toLocaleString()}
              </p>
              <div className="w-36">
                <InvestigationSelect
                  label="Rows per page"
                  value={String(pageSize)}
                  onChange={(value) => {
                    setPageSize(Number(value));
                    setPage(0);
                  }}
                >
                  <InvestigationSelectItem value="10">
                    10 orders
                  </InvestigationSelectItem>
                  <InvestigationSelectItem value="25">
                    25 orders
                  </InvestigationSelectItem>
                  <InvestigationSelectItem value="50">
                    50 orders
                  </InvestigationSelectItem>
                </InvestigationSelect>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!currentPage}
                onClick={() => setPage(0)}
              >
                First
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!currentPage}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft aria-hidden className="size-4" />
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
                <ChevronRight aria-hidden className="size-4" />
              </Button>
            </div>
          </nav>
        )}
      </div>
    </Panel>
  );
}

export function PartnerOrderLookup() {
  const { scope } = useOperationsData();
  return (
    <Panel
      title="Order lookup"
      description="Open an order by its full ID. Direct lookup can open orders outside this partner or the selected period and networks; these filters are retained for navigation."
    >
      <OrderLookup navigationScope={scope} />
    </Panel>
  );
}
