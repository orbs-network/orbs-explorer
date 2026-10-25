"use client";

import type { SetStateAction } from "react";
import { StringParam, useQueryParams } from "use-query-params";
import type { InvestigationFilters } from "@/lib/order-investigation";
import {
  INVESTIGATION_QUERY_PARAMS,
  investigationFilterQuery,
  readInvestigationFilters,
} from "@/lib/investigation-filter-query";

export function useInvestigationFilters() {
  const [query, setQuery] = useQueryParams({
    ...INVESTIGATION_QUERY_PARAMS,
    table_page_order_investigation_results: StringParam,
  });
  const filters = readInvestigationFilters(query);
  return {
    filters,
    setFilters: (next: SetStateAction<InvestigationFilters>) =>
      setQuery(
        {
          ...investigationFilterQuery(
            typeof next === "function" ? next(filters) : next,
          ),
          table_page_order_investigation_results: undefined,
        },
        "replaceIn",
      ),
    applyFilters: (next: InvestigationFilters) =>
      setQuery(
        {
          ...investigationFilterQuery(next),
          table_page_order_investigation_results: undefined,
        },
        "pushIn",
      ),
  };
}
