import type {
  PerpetualHubOperation,
  PerpetualHubRollup,
} from "@/lib/perpetual-hub/types";
import { isSettlementConfirmed } from "./settlement-story";
import type { ActivityTone, ActivityStep } from "./order-story";

export function getPerpetualStory(
  event: PerpetualHubOperation,
  rollup?: PerpetualHubRollup,
) {
  const accepted = event.status.toUpperCase() === "SUCCESS";
  const rejected = /reject|fail|error/i.test(event.status);
  const confirmed = isSettlementConfirmed(rollup);
  const descriptions: Record<string, string> = {
    CREATE_LIMIT_ORDER:
      "Your limit order was placed. This record does not show a completed trade. Open your account to check whether the order is still waiting.",
    CREATE_STOP_ORDER:
      "Your stop order was placed. It waits for the stop price before it can trade.",
    FILL_ORDER:
      "The order is reported as traded. Open your account to see the resulting position and trade history.",
    OPEN_POSITION:
      "A position was opened. Your account page shows whether it is still open now.",
    CLOSE_POSITION:
      "A position was closed or reduced. Open your account to see whether any part is still open.",
    CHANGE_LEVERAGE:
      "The position’s leverage was changed. This record does not show a new trade.",
    CANCEL_ORDER:
      "An order cancellation was accepted. Open your account to check the orders that are still waiting.",
    DEPOSIT:
      "The deposit was added to the account. Check your current balance and blockchain confirmation below.",
    WITHDRAW:
      "The withdrawal was recorded on the account. Check blockchain confirmation to verify the transfer.",
    REGISTER_SESSION_KEY:
      "A trading permission was added to the account. This is an account setting change, not a trade.",
    FUNDING_RATE:
      "A funding adjustment was recorded. Open your account history to see its effect on the balance.",
    LIQUIDATION:
      "A position was liquidated. Open your account to check any remaining positions and balance.",
  };
  const title = rejected
    ? "Action rejected"
    : accepted
      ? confirmed
        ? "Account updated · Blockchain confirmed"
        : "Account updated"
      : "Action status not yet confirmed";
  const explanation = rejected
    ? "The request was rejected. The requested account change was not reported as successful. Check the reason below."
    : accepted
      ? (descriptions[event.operationType.toUpperCase()] ??
        "This change was recorded on the account. Open your account to see its current balance and positions.")
      : "The result is not available yet. Refresh this page or check your account activity.";
  const steps: ActivityStep[] = [
    {
      label: "Request received",
      detail: "Your request was received",
      state: "done",
    },
    {
      label: rejected ? "Request rejected" : "Account updated",
      detail: rejected
        ? "Check the reason below"
        : event.teeSequence !== undefined
          ? `Change #${event.teeSequence}`
          : "Change number not available",
      state: accepted || rejected ? "done" : "current",
    },
    {
      label: "Blockchain confirmation",
      detail: confirmed
        ? "Confirmation reported"
        : event.rollupId !== undefined
          ? `Included in batch #${event.rollupId}; confirmation is not reported here`
          : rejected
            ? "No successful account change reported"
            : "Waiting for a confirmation batch",
      state: confirmed ? "done" : rejected ? "waiting" : "current",
    },
  ];
  return {
    title,
    explanation,
    tone: (rejected
      ? "error"
      : accepted
        ? "success"
        : "pending") as ActivityTone,
    reason: event.rejectReason,
    steps,
  };
}
