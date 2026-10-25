import { useMemo } from "react";
import { getChain } from "../utils/utils";

export const useChain = (chainId?: number) => {
  return useMemo(() => {
    return getChain(chainId);
  }, [chainId]);
};
