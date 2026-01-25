import BN from "bignumber.js";
import { useMemo } from "react";
import { parseUnits } from "viem";

export const useToWeiAmount = (
  decimals?: number,
  value?: string | BN | number
) => {
  return useMemo(() => {
    const safeValue = value?.toString() || "0";
    return parseUnits(safeValue, decimals || 0).toString();
  }, [decimals, value]);
};
