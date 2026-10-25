"use client";

import { useMemo } from "react";
import { ArrayParam, StringParam, useQueryParams } from "use-query-params";
import { useSearchParams } from "next/navigation";
import { INVESTIGATION_QUERY_PARAMS } from "../lib/investigation-filter-query";

export type OrderScopeSelection = {
  period: string;
  chainIds: string[];
  partnerIds: string[];
};

export const ORDER_PERIODS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "All available history", value: "all" },
];

export function useOrderScope() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useQueryParams(
    {
      period: StringParam,
      table_page_order_investigation_results: StringParam,
      chain_id: ArrayParam,
      partner_id: ArrayParam,
      ...INVESTIGATION_QUERY_PARAMS,
    },
    { updateType: "pushIn" },
  );
  const period = ORDER_PERIODS.some((option) => option.value === query.period)
    ? query.period!
    : "7";
  const chainIds = useMemo(
    () =>
      (query.chain_id ?? []).filter((value): value is string => value !== null),
    [query.chain_id],
  );
  const partnerIds = useMemo(
    () =>
      (query.partner_id ?? []).filter(
        (value): value is string => value !== null,
      ),
    [query.partner_id],
  );
  return {
    query: searchParams?.toString() ?? "",
    period,
    days: period === "all" ? undefined : Number(period),
    chainIds,
    partnerIds,
    key: `${period}:${chainIds.join(",")}:${partnerIds.join(",")}`,
    setPeriod: (value: string | undefined) => setQuery({ period: value }),
    setChains: (values: string[]) =>
      setQuery({ chain_id: values.length ? values : undefined }),
    setPartners: (values: string[]) =>
      setQuery({ partner_id: values.length ? values : undefined }),
    applyFilters: (
      values: OrderScopeSelection,
      extra: Record<string, string | undefined> = {},
    ) =>
      setQuery({
        ...extra,
        table_page_order_investigation_results: undefined,
        period: values.period,
        chain_id: values.chainIds.length ? values.chainIds : undefined,
        partner_id: values.partnerIds.length ? values.partnerIds : undefined,
      }),
    reset: () =>
      setQuery({
        period: undefined,
        chain_id: undefined,
        partner_id: undefined,
      }),
  };
}
