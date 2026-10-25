import type { ListOrder } from "@orbs/domain/twap/types";
import {
  getOverviewOrderStatus,
  type OverviewOrderStatus,
} from "@orbs/domain/twap/utils/orders-overview";
import { hasExecutionErrors, hasLastExecutionError } from "./order-diagnostics";
import {
  DEFAULT_INVESTIGATION_FILTERS,
  investigateOrders,
  isOrderHash,
  orderDetailHref,
  type OrderNavigationScope,
  type InvestigationFilters,
} from "./order-investigation";

/** A direct hash lookup must not leave a hash search that redirects again on return. */
export function orderHashSearchHref(
  value: string,
  scope: OrderNavigationScope,
): string | undefined {
  if (!isOrderHash(value)) return undefined;
  const query = new URLSearchParams(scope.query);
  query.delete("order_search");
  if (query.get("orders_view") === "lookup") query.delete("orders_view");
  const source = query.get("order_source");
  return orderDetailHref(
    value.trim(),
    source === "v1" || source === "v2" ? source : undefined,
    { ...scope, query: query.toString() },
  );
}

export const ORDER_QUICK_VIEWS = [
  { value: "all", label: "All matching activity", filters: {} },
  {
    value: "review",
    label: "Active · needs review",
    filters: { status: "active", review: "attention" },
  },
  {
    value: "erroring",
    label: "Latest attempt failed · any status",
    filters: { errors: "latest" },
  },
  {
    value: "active-errors",
    label: "Active · latest attempt failed",
    filters: { status: "active", errors: "latest" },
  },
  {
    value: "overdue",
    label: "Active past deadline",
    filters: { status: "active", deadline: "past", sort: "oldest" },
  },
  { value: "failed", label: "Failed orders", filters: { status: "failed" } },
  {
    value: "aged",
    label: "Active 24h+",
    filters: { status: "active", activeAge: "24h", sort: "oldest" },
  },
  {
    value: "large",
    label: "Placed value ≥ $1K",
    filters: { minUsd: "1000", sort: "value-desc" },
  },
] as const;
export type OrderQuickView = (typeof ORDER_QUICK_VIEWS)[number]["value"];

/** Presets replace list facets while the page's global period/networks/apps stay intact. */
export function orderQuickViewFilters(
  value: OrderQuickView,
): InvestigationFilters {
  const preset =
    ORDER_QUICK_VIEWS.find((view) => view.value === value) ??
    ORDER_QUICK_VIEWS[0];
  return { ...DEFAULT_INVESTIGATION_FILTERS, ...preset.filters };
}

export function matchingOrderQuickView(
  filters: InvestigationFilters,
): OrderQuickView | "custom" {
  return (
    ORDER_QUICK_VIEWS.find((view) => {
      const preset = orderQuickViewFilters(view.value);
      return (Object.keys(preset) as (keyof InvestigationFilters)[]).every(
        (key) => preset[key] === filters[key],
      );
    })?.value ?? "custom"
  );
}

/** Status facets ignore only their own selection; the error facet ignores only errors. */
export function buildOrderFacets(
  orders: ListOrder[],
  filters: InvestigationFilters,
  labels: Map<ListOrder, string>,
  snapshot: number,
) {
  const statusOrders = investigateOrders(
    orders,
    { ...filters, status: "all" },
    labels,
    snapshot,
  );
  const counts: Record<OverviewOrderStatus, number> = {
    completed: 0,
    partial: 0,
    active: 0,
    failed: 0,
    cancelled: 0,
    expired: 0,
    unknown: 0,
  };
  let activeErroring = 0;
  for (const order of statusOrders) {
    const status = getOverviewOrderStatus(order);
    counts[status]++;
    if (status === "active" && hasLastExecutionError(order)) activeErroring++;
  }
  const errorOrders = investigateOrders(
    orders,
    { ...filters, errors: "all" },
    labels,
    snapshot,
  );
  return {
    counts,
    all: statusOrders.length,
    activeErroring,
    withErrors: errorOrders.filter(hasExecutionErrors).length,
  };
}
