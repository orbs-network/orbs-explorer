"use client";

import type { SetStateAction } from "react";
import { useQueryParams } from "use-query-params";
import type { InvestigationFilters } from "@/lib/order-investigation";
import {
  INVESTIGATION_QUERY_PARAMS,
  investigationFilterQuery,
  readInvestigationFilters,
} from "@/lib/investigation-filter-query";

export function useInvestigationFilters() {
  const [query, setQuery] = useQueryParams(INVESTIGATION_QUERY_PARAMS);
  const filters = readInvestigationFilters(query);
  return {
    filters,
    setFilters: (next: SetStateAction<InvestigationFilters>) =>
      setQuery(
        investigationFilterQuery(
          typeof next === "function" ? next(filters) : next,
        ),
        "replaceIn",
      ),
    applyFilters: (next: InvestigationFilters) =>
      setQuery(investigationFilterQuery(next), "pushIn"),
  };
}
