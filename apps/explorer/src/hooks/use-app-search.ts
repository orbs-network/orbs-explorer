import { useMutation } from "@tanstack/react-query";
import { getSpotOrder } from "@orbs/domain/twap/api";
import { useRouter } from "next/navigation";
import { isHash } from "viem";
import { toast } from "sonner";
import { ROUTES } from "@/routes";

export function useAppSearch() {
  const router = useRouter();
  return useMutation({
    mutationFn: async (value: string) => {
      const identifier = value.trim();
      if (/^0x[a-fA-F0-9]{40}$/.test(identifier)) {
        router.push(
          `${ROUTES.TWAP.ROOT}?user=${encodeURIComponent(identifier)}`,
        );
        return;
      }
      if (!isHash(identifier)) {
        toast.error(
          "Enter an order ID (64 hex characters) or wallet address (40 hex characters), starting with 0x.",
        );
        return;
      }
      const order = await getSpotOrder({ hash: identifier });
      if (order) {
        router.push(
          `${ROUTES.TWAP.ORDER(order.hash)}?order_source=${order.source ?? "v1"}`,
        );
      } else {
        toast.error(
          "No advanced order found for this ID. Check the order ID in your trading app, or search by wallet address.",
        );
      }
    },
    onError: () => {
      toast.error("Order search is unavailable. Please try again.");
    },
  });
}
