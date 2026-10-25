import type { ListOrder } from "@orbs/domain/twap/types";
import { getOverviewOrderStatus } from "@orbs/domain/twap/utils/orders-overview";
import type { OrderNavigationScope } from "./order-investigation";
import { ordersScopeHref } from "./order-investigation";

export type OperationalPlacementScope = "all" | "placement";

/** Current-state queues ignore the reporting placement period unless opted in. */
export function operationalNavigationScope(
  scope: OrderNavigationScope,
  placement: OperationalPlacementScope = "all",
): OrderNavigationScope {
  const period = placement === "placement" ? (scope.period ?? "7") : "all";
  // Only reproduce the shared app/network/date scope, never unrelated list facets.
  const query = ordersScopeHref({
    period,
    chainIds: scope.chainIds,
    partnerIds: scope.partnerIds,
  }).split("?")[1];
  return { ...scope, period, query };
}

export function countOperationalActiveOrders(
  allScopedOrders: ListOrder[],
  visibleOrders: ListOrder[],
) {
  const active = (order: ListOrder) =>
    getOverviewOrderStatus(order) === "active";
  const total = allScopedOrders.filter(active).length;
  const shown = visibleOrders.filter(active).length;
  return { total, shown, excluded: Math.max(0, total - shown) };
}
