import type { ListOrder } from "@orbs/domain/twap/types";
import type { OrderNavigationScope } from "./order-investigation";
import { ordersScopeHref } from "./order-investigation";
import { buildOverviewSignals } from "./overview-monitoring";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import {
  getOverviewOrderStatus,
  type PartnerCard,
} from "@orbs/domain/twap/utils/orders-overview";
import { activeOrderReviewState } from "./execution-analytics";

/** Match a visible overview cohort; never inherit unrelated list filters. */
export function attentionOrdersHref(
  scope: OrderNavigationScope,
  facets: Record<string, string> = {},
  partnerIds = scope.partnerIds,
  chainIds = scope.chainIds,
) {
  return ordersScopeHref({
    period: scope.period,
    partnerIds,
    chainIds,
    query: new URLSearchParams(facets).toString(),
  });
}

export type AttentionIssue = {
  id: string;
  title: string;
  detail: string;
  count: number;
  href: string;
  severity: "warning" | "unknown";
  orders: ListOrder[];
  unit?: "app";
};

/** Shared current-state checks for both global and trading-app summaries. */
export function buildActiveOrderAttention(
  orders: ListOrder[],
  snapshot: number,
  scope: OrderNavigationScope,
): AttentionIssue[] {
  const active = orders.filter(
    (order) => getOverviewOrderStatus(order) === "active",
  );
  const cohorts: Array<
    Omit<AttentionIssue, "count" | "href"> & { facets: Record<string, string> }
  > = [
    {
      id: "overdue",
      title: "Active past deadline",
      detail:
        "Reported deadline has passed; the service still reports these orders active. Review signal, not an SLA diagnosis.",
      orders: active.filter(
        (order) => activeOrderReviewState(order, snapshot)?.pastDeadline,
      ),
      facets: { order_status: "active", order_deadline: "past" },
      severity: "warning" as const,
    },
    {
      id: "active-errors",
      title: "Active · latest attempt failed",
      detail:
        "Unique active orders with a failed latest reported execution attempt. A retry may still succeed.",
      orders: active.filter(
        (order) => activeOrderReviewState(order, snapshot)?.latestAttemptFailed,
      ),
      facets: { order_status: "active", order_errors: "latest" },
      severity: "warning" as const,
    },
    {
      id: "deadline-coverage",
      title: "Active deadlines unreported",
      detail:
        "No usable deadline is available. These orders cannot be assessed for deadline overruns.",
      orders: active.filter(
        (order) => activeOrderReviewState(order, snapshot)?.deadlineUnreported,
      ),
      facets: { order_status: "active", order_deadline: "unreported" },
      severity: "unknown" as const,
    },
  ];
  return cohorts
    .filter((cohort) => cohort.orders.length > 0)
    .map(({ facets, ...cohort }) => ({
      ...cohort,
      count: cohort.orders.length,
      href: attentionOrdersHref(scope, facets),
    }));
}

export function buildOrderAttention(
  input: Parameters<typeof buildOverviewSignals>[0],
  scope: OrderNavigationScope,
) {
  const signals = buildOverviewSignals(input);
  const issues = buildActiveOrderAttention(input.orders, input.snapshot, scope);
  const add = (issue: AttentionIssue) => {
    if (issue.count) issues.push(issue);
  };
  for (const app of signals.elevatedApps)
    add({
      id: `rate-${app.partnerId}`,
      title: `${app.partnerName} · elevated failure rate`,
      detail: `${app.failed.length}/${app.recent.length} placed orders currently failed (${((app.rate ?? 0) * 100).toFixed(1)}%). Rule: ≥${input.rules.failureRatePercent}% with ≥${input.rules.minimumOrders} orders in ${input.rules.windowHours}h; not a confirmed infrastructure incident.`,
      count: app.failed.length,
      href: attentionOrdersHref(
        { ...scope, period: "all" },
        {
          order_status: "failed",
          order_since: new Date(
            input.snapshot - input.rules.windowHours * 3_600_000,
          ).toISOString(),
          order_until: new Date(input.snapshot).toISOString(),
        },
        [app.partnerId],
      ),
      severity: "warning",
      orders: app.failed,
    });
  for (const app of signals.expectedApps.filter((app) => app.idle))
    add({
      id: `idle-${app.partnerId}`,
      title: `${app.partnerName} · expected activity absent`,
      detail: `Browser rule expects an order every ${app.expectedHours}h. ${app.lastPlaced ? `Latest placement ${new Date(app.lastPlaced).toISOString()}.` : "No placement reported in available history."} Inactivity alone does not establish an execution fault.`,
      count: 1,
      unit: "app",
      href: attentionOrdersHref({ ...scope, period: "all" }, {}, [
        app.partnerId,
      ]),
      severity: "warning",
      orders: [],
    });
  return { issues, signals };
}

export function attentionOrderContext(
  orders: ListOrder[],
  partners: PartnerCard[] = [],
) {
  const selected = new Set(orders);
  const networks = new Set(
    orders.map(getTwapOrderChainId).filter((id) => id !== undefined && id > 0),
  );
  const placed = orders
    .map((order) => Date.parse(order.timestamp))
    .filter(Number.isFinite);
  return {
    networkCount: networks.size,
    partnerNames: partners
      .filter((partner) =>
        partner.chains.some((chain) =>
          chain.orders.some((order) => selected.has(order)),
        ),
      )
      .map((partner) => partner.partnerName),
    latestPlaced: placed.length ? Math.max(...placed) : undefined,
  };
}
