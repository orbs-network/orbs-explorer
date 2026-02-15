import { useMemo } from "react";
import { SINK_API_URLS } from "../api";
import { URL_QUERY_KEYS } from "../consts";
import { useQueryFilterParams } from "./use-query-filter-params";

/**
 * Returns the order-sink API base URL for TWAP based on the twap_sink_env URL param.
 * Only use within TWAP pages. Default is prod.
 */
export function useTwapSinkApiUrl(): string {
  const { query } = useQueryFilterParams();
  return useMemo(() => {
    const env = query[URL_QUERY_KEYS.TWAP_SINK_ENV] === "dev" ? "dev" : "prod";
    return SINK_API_URLS[env];
  }, [query[URL_QUERY_KEYS.TWAP_SINK_ENV]]);
}
