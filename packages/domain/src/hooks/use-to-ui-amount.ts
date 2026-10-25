import BN from "bignumber.js";
import { useMemo } from "react";
import { formatUnits } from "viem";

export const useToUiAmount = (
  decimals?: number,
  value?: string | BN | number
) => {
  return useMemo(() => {
    if (isNaN(Number(value))) return "0";

    const safeValue = BN(value || 0)
      .decimalPlaces(0)
      .toFixed();
    return formatUnits(BigInt(safeValue), decimals || 0);
  }, [decimals, value]);
};
