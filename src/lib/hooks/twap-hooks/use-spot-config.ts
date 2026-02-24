import { useQuery } from "@tanstack/react-query";
import { REACT_QUERY_KEYS } from "../../consts";
import { getSpotConfig } from "../../api";
import { SpotConfig } from "../../types";


export const useSpotConfig = () => {
  return useQuery<SpotConfig>({
    queryKey: [REACT_QUERY_KEYS.spotConfig],
    queryFn: () => getSpotConfig(),
    staleTime: Infinity,
  });
};

