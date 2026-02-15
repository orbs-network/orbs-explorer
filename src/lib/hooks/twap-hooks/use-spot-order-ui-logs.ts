import { getOrderLogsUI } from "@/lib/api";
import { REACT_QUERY_KEYS } from "@/lib/consts";
import { useQuery } from "@tanstack/react-query";

export const useSpotOrderUiLogs = (hash?: string) => {
    return useQuery({
      queryKey: [REACT_QUERY_KEYS.orderClientLogs, hash],
      queryFn: async () => {
        return getOrderLogsUI(hash as string);
      },
      enabled: !!hash,
    });
  };
  
  
  