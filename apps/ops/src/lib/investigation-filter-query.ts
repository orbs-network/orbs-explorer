import { StringParam } from "use-query-params";
import {
  DEFAULT_INVESTIGATION_FILTERS,
  type InvestigationFilters,
} from "./order-investigation";

export const INVESTIGATION_QUERY_PARAMS = {
  order_search: StringParam,
  order_adapter: StringParam,
  order_token: StringParam,
  order_status: StringParam,
  order_type: StringParam,
  order_source: StringParam,
  order_errors: StringParam,
  order_active_age: StringParam,
  order_review: StringParam,
  order_deadline: StringParam,
  order_since: StringParam,
  order_until: StringParam,
  min_usd: StringParam,
  max_usd: StringParam,
  order_sort: StringParam,
};
export function readInvestigationFilters(
  query: Record<string, string | null | undefined>,
): InvestigationFilters {
  const valid = (
    value: string | null | undefined,
    options: readonly string[],
    fallback: string,
  ) => (value && options.includes(value) ? value : fallback);
  return {
    query: query.order_search ?? "",
    adapter: query.order_adapter ?? "",
    token: query.order_token ?? "",
    status: valid(
      query.order_status,
      [
        "all",
        "completed",
        "partial",
        "active",
        "cancelled",
        "expired",
        "failed",
        "unknown",
      ],
      "all",
    ) as InvestigationFilters["status"],
    type: query.order_type || "all",
    source: valid(
      query.order_source,
      ["all", "v1", "v2", "unreported"],
      "all",
    ) as InvestigationFilters["source"],
    errors: valid(
      query.order_errors,
      ["all", "any", "latest", "recovered", "none", "unreported"],
      "all",
    ) as InvestigationFilters["errors"],
    activeAge: query.order_active_age === "24h" ? "24h" : "all",
    review: query.order_review === "attention" ? "attention" : "all",
    deadline: valid(
      query.order_deadline,
      ["all", "past", "soon", "unreported"],
      "all",
    ) as InvestigationFilters["deadline"],
    placedSince: query.order_since ?? "",
    placedUntil: query.order_until ?? "",
    minUsd: query.min_usd ?? "",
    maxUsd: query.max_usd ?? "",
    sort: valid(
      query.order_sort,
      [
        "newest",
        "oldest",
        "value-desc",
        "value-asc",
        "errors-desc",
        "errors-asc",
      ],
      "newest",
    ) as InvestigationFilters["sort"],
  };
}
export function investigationFilterQuery(
  value: InvestigationFilters,
): Record<keyof typeof INVESTIGATION_QUERY_PARAMS, string | undefined> {
  return {
    order_search: value.query || undefined,
    order_adapter: value.adapter.trim() || undefined,
    order_token: value.token.trim() || undefined,
    order_status: value.status === "all" ? undefined : value.status,
    order_type: value.type === "all" ? undefined : value.type,
    order_source: value.source === "all" ? undefined : value.source,
    order_errors: value.errors === "all" ? undefined : value.errors,
    order_active_age: value.activeAge === "24h" ? "24h" : undefined,
    order_review: value.review === "attention" ? "attention" : undefined,
    order_deadline: value.deadline === "all" ? undefined : value.deadline,
    order_since: value.placedSince || undefined,
    order_until: value.placedUntil || undefined,
    min_usd: value.minUsd || undefined,
    max_usd: value.maxUsd || undefined,
    order_sort:
      value.sort === DEFAULT_INVESTIGATION_FILTERS.sort
        ? undefined
        : value.sort,
  };
}
