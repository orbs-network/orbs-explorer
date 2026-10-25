import type { LiquidityHubSwap } from "@orbs/domain/liquidity-hub/types";
import type { ActivityTone } from "./order-story";
export function getSwapStory(swap: LiquidityHubSwap) {
  const success = swap.swapStatus.toLowerCase() === "success";
  const failed = /fail|error|reject/i.test(swap.swapStatus);
  return {
    title: success
      ? "Swap execution reported successful"
      : failed
        ? "Swap execution did not succeed"
        : "Swap outcome is not yet confirmed",
    tone: (success ? "success" : failed ? "error" : "pending") as ActivityTone,
    explanation: success
      ? "The swap service reports success. Check the blockchain record to verify confirmation and the tokens received. Price estimates are not confirmation."
      : failed
        ? "The swap attempt did not succeed according to the service. Its attempt ID does not mean tokens were transferred."
        : "A successful swap has not been reported yet. Check the latest step and update below.",
    reason: swap.error,
    nextStep: swap.txHash
      ? "Open the blockchain record to check confirmation and the tokens transferred."
      : "No blockchain transaction ID is available. Refresh or check the app where you made the swap.",
  };
}
