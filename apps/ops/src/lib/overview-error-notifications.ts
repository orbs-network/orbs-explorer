import type { QueryClient } from "@tanstack/react-query";
import { REACT_QUERY_KEYS } from "@orbs/domain/consts";

type QueryErrorState = {
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  errorUpdatedAt: number;
  dataUpdatedAt: number;
};

type ErrorSource = "orders" | "config";
export type OverviewErrorNotice = {
  id: string;
  title: string;
  description: string;
  queryKey: readonly string[];
};

const toastIds: Record<ErrorSource, string> = {
  orders: "ops-order-history-error",
  config: "ops-trading-app-config-error",
};
const notifiedErrors = new WeakMap<QueryClient, Map<ErrorSource, number>>();

function noticeFor(
  source: ErrorSource,
  state: QueryErrorState,
): OverviewErrorNotice {
  const hasSnapshot = state.dataUpdatedAt > 0;
  if (source === "orders")
    return {
      id: toastIds.orders,
      title: hasSnapshot ? "Order refresh failed" : "Order history unavailable",
      description: hasSnapshot
        ? "Showing the last successful snapshot. Retry to update order counts and activity."
        : "One or both order services could not be reached. Retry to load complete order counts and activity.",
      queryKey: [REACT_QUERY_KEYS.spotOrders, "overview"],
    };
  return {
    id: toastIds.config,
    title: hasSnapshot
      ? "Trading app configuration could not refresh"
      : "Trading app details unavailable",
    description: hasSnapshot
      ? "Using the last loaded app names and adapter configuration. Retry to check for updates."
      : "Orders and totals are available, but some app names and adapter checks may be incomplete. Retry to load trading app details.",
    queryKey: [REACT_QUERY_KEYS.spotConfig, "partner-catalog"],
  };
}

/** Notify once per settled query failure, even when routes share an observer. */
export function reportOverviewErrors(
  queryClient: QueryClient,
  states: { orders: QueryErrorState; config: QueryErrorState },
  notify: (notice: OverviewErrorNotice) => void,
  dismiss: (id: string) => void,
) {
  let notified = notifiedErrors.get(queryClient);
  if (!notified) {
    notified = new Map();
    notifiedErrors.set(queryClient, notified);
  }
  for (const source of ["orders", "config"] as const) {
    const state = states[source];
    if (!state.isError) {
      if (!state.isPending && notified.has(source)) dismiss(toastIds[source]);
      continue;
    }
    if (
      state.isFetching ||
      !state.errorUpdatedAt ||
      notified.get(source) === state.errorUpdatedAt ||
      // Show the history error first when the whole view is unavailable.
      (source === "config" &&
        (states.orders.isPending || states.orders.isError))
    )
      continue;
    notified.set(source, state.errorUpdatedAt);
    notify(noticeFor(source, state));
  }
}
