import { useQuery } from "@tanstack/react-query";
import { REACT_QUERY_KEYS } from "../../consts";
import { getSpotConfig } from "../api";
import type { SpotConfig } from "../types";

export function useSpotConfig() {
  return useQuery<SpotConfig>({
    queryKey: [REACT_QUERY_KEYS.spotConfig],
    queryFn: () => getSpotConfig(),
    staleTime: Infinity,
  });
}
