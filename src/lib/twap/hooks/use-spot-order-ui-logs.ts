import { getOrderLogsUI } from "../api";
import { REACT_QUERY_KEYS } from "../../consts";
import { useQuery } from "@tanstack/react-query";

export function useSpotOrderUiLogs(hash?: string) {
  return useQuery({
    queryKey: [REACT_QUERY_KEYS.orderClientLogs, hash],
    queryFn: async () => {
      return getOrderLogsUI(hash as string);
    },
    enabled: !!hash,
  });
}
