import { useQuery } from "@tanstack/react-query";
import { REACT_QUERY_KEYS } from "../consts";
import { getSpotConfig } from "../api";
import { ChainTwapConfig } from "../types";




export interface TwapConfig {
  [chainId: string]: ChainTwapConfig;
}


export const useSpotConfig = () => {
  return useQuery<TwapConfig>({
    queryKey: [REACT_QUERY_KEYS.spotConfig],
    queryFn: () => getSpotConfig(),
    staleTime: Infinity,
  });
};

