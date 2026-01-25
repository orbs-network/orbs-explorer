import { useMemo } from "react";
import { getChain } from "@/lib/utils/utils";

export const useNetwork = (chainId?: number) => {
  return useMemo(() => {
    const config = getChain(chainId);
    return config;
  }, [chainId]);
};
