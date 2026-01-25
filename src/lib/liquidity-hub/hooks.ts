import { Field, LiquidityHubSwap, SwapQueryResponse } from "./types";
import { useCallback, useMemo } from "react";
import BN from "bignumber.js";
import { useQuery } from "@tanstack/react-query";
import { getPublicClient } from "../lib";
import {
  getERC20Transfers,
} from "./helpers";
import { toAmountUI } from "../utils/utils";
import { useToken } from "../hooks/use-token";
import { usePriceUsd } from "../hooks/use-price-usd";

export const useOutTokenUsdCallback = (swap?: LiquidityHubSwap) => {
  const token = useToken(swap?.tokenOutAddress, swap?.chainId).data;

  return useCallback(
    (amountWei?: string | number) => {
      if (!swap || !token) return "0";
      const amount = toAmountUI(amountWei, token.decimals);
      const getUsdValue = (amount?: string | number, usd?: number | string) => {
        if (!amount || !usd) return "0";
        const res = BN(usd).dividedBy(toAmountUI(amount, token.decimals));
        return res.gt(0) ? res.toString() : undefined;
      };

      const usdSingleToken =
        getUsdValue(swap.amountOut, swap.dollarValue2) || "0";

      return BN(amount).times(usdSingleToken).toString();
    },
    [swap, token]
  );
};

export const useOutTokenUsd = (
  swap?: LiquidityHubSwap,
  amountWei?: string | number
) => {
  const getUsd = useOutTokenUsdCallback(swap);
  return useMemo(() => getUsd(amountWei), [getUsd, amountWei]);
};

export const useGasCostUsd = (swap?: LiquidityHubSwap) => {
  const { data: usd } = usePriceUsd(swap?.tokenOutAddress, swap?.chainId);
  const gasPrice = useMemo(() => {
    if (!swap) return "0";
    const gasUsedNativeToken = BN(swap.gasUsed || 0)
      .times(swap.gasPriceGwei || 0)
      .toFixed();

    return BN(gasUsedNativeToken || 0)
      .dividedBy(1e9)
      .toString();
  }, [swap]);



  return useMemo(() => {
    return BN(gasPrice)
      .times(usd || 0).toFixed()
      .toString();
  }, [gasPrice, usd]);
};

export const useTransfers = (swap?: LiquidityHubSwap) => {
  return useQuery({
    queryKey: ["useTransfers", swap?.txHash],
    queryFn: async () => {
      if (!swap) {
        throw new Error("Swap is required");
      }
      const publicClient = getPublicClient(swap.chainId);

      const receipt = await publicClient?.getTransactionReceipt({
        hash: swap.txHash! as `0x${string}`,
      });

      if (!receipt) return null;
      return getERC20Transfers(receipt);
    },
    staleTime: Infinity,
    enabled: !!swap?.txHash && !!swap?.chainId,
  });
};




