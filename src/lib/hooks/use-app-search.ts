import { useMutation } from "@tanstack/react-query";
import { getSpotOrder } from "../api";
import { useRouter } from "next/navigation";
import { isHash } from "viem";
import { toast } from "sonner";
import { getLiquidityHubTx } from "../api/get-liquidity-hub-tx";
import { ROUTES } from "../routes";

export function useAppSearch() {
  const router = useRouter();
  return useMutation({
    mutationFn: async (value: string) => {
      if (!isHash(value)) {
        toast.error("Invalid order identifier");
        return;
      }

      const [twapOrder, liquidityHubTx] = await Promise.all([
        getSpotOrder({ hash: value }),
        getLiquidityHubTx(value),
      ]);
      console.log({ twapOrder, liquidityHubTx });
      if (twapOrder) {
        router.push(ROUTES.TWAP.ORDER(twapOrder.hash));
      } else if (liquidityHubTx) {
        router.push(ROUTES.LIQUIDITY_HUB.TX(liquidityHubTx.swap.txHash));
      }
    },
    onSuccess: () => {
      toast.success("Transaction found");
    },
    onError: (error) => {
      console.error(error);
    },
  });
}
