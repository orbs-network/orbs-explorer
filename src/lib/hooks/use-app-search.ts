import { useMutation } from "@tanstack/react-query";
import { getSpotOrder } from "../api";
import { useRouter } from "next/navigation";
import { isHash } from "viem";
import { toast } from "sonner";
import { getLiquidityHubTx } from "../liquidity-hub";
import { ROUTES } from "../routes";

export function useAppSearch() {
  const router = useRouter();
  return useMutation({
    mutationFn: async (value: string) => {
      const identifier = value.trim();

      if (!isHash(identifier)) {
        toast.error("Invalid order identifier");
        return;
      }

      const [twapOrderResult, liquidityHubTxResult] = await Promise.allSettled([
        getSpotOrder({ hash: identifier }),
        getLiquidityHubTx(identifier),
      ]);

      const twapOrder =
        twapOrderResult.status === "fulfilled"
          ? twapOrderResult.value
          : undefined;
      const liquidityHubTx =
        liquidityHubTxResult.status === "fulfilled"
          ? liquidityHubTxResult.value
          : undefined;

      if (twapOrder) {
        router.push(ROUTES.TWAP.ORDER(twapOrder.hash));
      } else if (liquidityHubTx) {
        router.push(ROUTES.LIQUIDITY_HUB.TX(liquidityHubTx.swap.txHash));
      } else {
        toast.error("Transaction not found");
      }
    },
    onError: (error) => {
      console.log(error);
    },
  });
}
