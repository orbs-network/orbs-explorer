import type { TokenReference } from "../token-metadata";
import type { ListOrder, Order } from "./types";
import { getTwapOrderChainId } from "./utils";

export function getTwapTokenReferences(
  orders: (ListOrder | Order)[],
): TokenReference[] {
  return orders.flatMap((order) => {
    const chainId = getTwapOrderChainId(order);
    const addresses =
      "inputToken" in order
        ? [order.inputToken, order.outputToken]
        : [
            order.order.witness.input.token,
            order.order.witness.output.token,
            ...(order.metadata.chunks ?? []).flatMap((chunk) => [
              chunk.inToken,
              chunk.outToken,
            ]),
          ];
    return addresses.map((address) => ({ address, chainId }));
  });
}
