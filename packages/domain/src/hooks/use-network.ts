import { useMemo } from "react";
import { getChain } from "@orbs/domain/utils/utils";

export const useNetwork = (chainId?: number) => {
  return useMemo(() => {
    const config = getChain(chainId);
    return config;
  }, [chainId]);
};
