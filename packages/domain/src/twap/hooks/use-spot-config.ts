import { useQuery, useQueryClient } from "@tanstack/react-query";
import { REACT_QUERY_KEYS } from "../../consts";
import { getSpotConfig } from "../api";
import type { SpotConfig } from "../types";
import { serviceStatusQueryOptions } from "../service-status";

export function useSpotConfig() {
  const queryClient = useQueryClient();
  return useQuery<SpotConfig>({
    queryKey: [REACT_QUERY_KEYS.spotConfig, "partner-catalog"],
    queryFn: ({ signal }) =>
      getSpotConfig(
        signal,
        async (endpoint) =>
          (await queryClient.fetchQuery(serviceStatusQueryOptions(endpoint)))
            .payload,
      ),
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
