import { parseChunkDescription } from "@orbs/domain/twap/utils";
import BN from "bignumber.js";
import { SpotOrderType } from "@orbs/domain/twap/types";
import type { Order, ListOrder } from "@orbs/domain/twap/types";

export type ActivityTone = "success" | "pending" | "warning" | "error";
export type ActivityStep = {
  label: string;
  detail: string;
  state: "done" | "current" | "waiting";
};
export function latestOrderChunk(order: Order) {
  return [...(order.metadata.chunks ?? [])].sort(
    (a, b) =>
      Date.parse(b.timestamp || b.createdAt) -
      Date.parse(a.timestamp || a.createdAt),
  )[0];
}

export function getOrderStory(order: Order, now = Date.now()) {
  const chunks = order.metadata.chunks ?? [];
  const filled = chunks.filter(
    (chunk) => chunk.status.toLowerCase() === "success",
  );
  const filledRaw = filled.reduce(
    (sum, chunk) => sum.plus(chunk.inAmount || 0),
    new BN(0),
  );
  const totalRaw = new BN(order.order.witness.input.maxAmount || 0);
  const remainingRaw = BN.maximum(0, totalRaw.minus(filledRaw)).toFixed(0);
  const expected = order.metadata.expectedChunks || 0;
  const progress = totalRaw.gt(0)
    ? BN.minimum(100, filledRaw.div(totalRaw).times(100)).toNumber()
    : expected
      ? Math.min(100, (filled.length / expected) * 100)
      : 0;
  const status = order.metadata.status.toLowerCase();
  const displayStatus = order.metadata.displayOnlyStatus?.toUpperCase();
  const deadline =
    Number(order.order.witness.deadline || order.order.deadline) * 1000;
  const latest = latestOrderChunk(order);
  const reason =
    latest?.description?.trim() ||
    order.metadata.description?.trim() ||
    order.metadata.displayOnlyStatusDescription?.trim();
  const cancelled =
    /cancel/.test(status) ||
    displayStatus === "CANCELLED" ||
    /cancel(?:l)?ed/i.test(order.metadata.description ?? "");
  const completed =
    status === "completed" ||
    displayStatus === "SUCCEEDED" ||
    (expected > 0 && filled.length >= expected) ||
    (totalRaw.gt(0) && filledRaw.gte(totalRaw));
  const amountsKnown =
    filled.every((chunk) => chunk.inAmount !== undefined) &&
    !(completed && filled.length === 0);
  const expired =
    !completed &&
    (status === "expired" ||
      displayStatus === "EXPIRED" ||
      (deadline > 0 && deadline <= now));
  const failed = /fail|error/.test(status);
  const ended =
    cancelled ||
    completed ||
    expired ||
    failed ||
    status === "partially_completed";
  const waitingForPrice =
    !ended &&
    (/price|trigger|limit/i.test(latest?.status || "") ||
      /price.*(?:not|can.t)|trigger.*not/i.test(reason || ""));
  const retrying = !ended && /error|fail/i.test(latest?.status || "");
  let title = filled.length
    ? "Part of the order has traded"
    : "Order is active";
  let explanation =
    "The order is being checked automatically. Completed trades will appear below.";
  let tone: ActivityTone = "pending";
  if (completed) {
    title = "Order completed";
    tone = "success";
    explanation =
      "All planned trades are reported complete. Open a trade below to check its blockchain record.";
  } else if (cancelled) {
    title = filled.length
      ? "Order cancelled after partial execution"
      : "Order cancelled";
    tone = "warning";
    explanation =
      "The order was cancelled. Any trades completed before cancellation remain in the history below.";
  } else if (expired) {
    title = filled.length
      ? "Order expired after partial execution"
      : "Order expired";
    tone = "warning";
    explanation =
      "The expiry time has passed. The remaining amount was not traded.";
  } else if (failed || status === "partially_completed") {
    title = filled.length ? "Order ended with partial fills" : "Order failed";
    tone = "error";
    explanation =
      "The order has stopped. Check the latest update and any completed trades below.";
  } else if (waitingForPrice) {
    title = filled.length
      ? "Partly traded · Waiting for price"
      : "Waiting for the order’s price condition";
    explanation =
      "The price has not reached your target. Your order is still active and will be checked again.";
  } else if (retrying) {
    title = "Execution attempt did not succeed";
    tone = "warning";
    explanation =
      "The latest trade attempt had a problem. Your order is still active; this does not mean it was cancelled.";
  }
  const steps: ActivityStep[] = [
    {
      label: "Order created",
      detail: "Your order was received",
      state: "done",
    },
    {
      label: "Execution",
      detail: `${filled.length} of ${expected || "unknown"} fills recorded`,
      state: completed ? "done" : ended ? "waiting" : "current",
    },
    {
      label: completed
        ? "Completed"
        : ended
          ? "Order ended"
          : "Remaining fills",
      detail: ended
        ? "Review execution history below"
        : "Waiting for the price or scheduled time",
      state: completed || ended ? "done" : "waiting",
    },
  ];
  return {
    title,
    tone,
    explanation,
    reason,
    progress,
    filled: filled.length,
    expected,
    amountsKnown,
    filledRaw: filledRaw.toFixed(0),
    remainingRaw,
    deadline,
    ended,
    steps,
    latest,
    waitingForPrice,
    nextCheck:
      order.metadata.displayOnlyPriceCheckNextTime ||
      order.metadata.nextEligibleTime,
    nextStep: ended
      ? "Open completed trades to check their blockchain records. To manage the order, return to the app where you placed it."
      : "Check the latest update below. To change or cancel the order, return to the app where you placed it.",
  };
}

export function listOrderReason(order: ListOrder) {
  const status = order.metadata.status.toLowerCase();
  if (status === "completed") return "All trades completed";
  if (/cancel/.test(status))
    return "Cancelled; completed trades remain in history";
  return (
    explainOrderReason(
      order.metadata.displayOnlyStatusDescription ||
        order.metadata.chunkSummary?.lastChunkDescription ||
        order.metadata.description,
      order.metadata.dstToken?.symbol,
    ) || "Open the order to see its trade history"
  );
}

export function explainOrderReason(
  reason: string | undefined,
  outputSymbol?: string,
) {
  if (!reason) return undefined;
  const parsed = parseChunkDescription(reason, outputSymbol);
  const unit = outputSymbol ? ` ${outputSymbol}` : "";
  if (parsed.type === "trigger")
    return `The price target has not been reached. You would currently receive: ${parsed.current}${unit}; the trade starts at: ${parsed.trigger}${unit}.`;
  if (parsed.type === "limit_price")
    return `The minimum amount is not available yet. You would currently receive: ${parsed.got}${unit}; your minimum is: ${parsed.expected}${unit}.`;
  return parsed.text;
}

export function getOrderTypeExplanation(type: SpotOrderType) {
  const explanations: Record<SpotOrderType, string> = {
    [SpotOrderType.LIMIT]:
      "Trades when your minimum price can be met, before the expiry time.",
    [SpotOrderType.STOP_LOSS_LIMIT]:
      "Starts trading when the stop price is reached, while keeping your minimum received amount.",
    [SpotOrderType.STOP_LOSS_MARKET]:
      "Starts trading when the stop price is reached, using the available market price.",
    [SpotOrderType.TAKE_PROFIT]:
      "Starts trading when the take-profit price is reached. The price change limit still applies.",
    [SpotOrderType.TWAP_LIMIT]:
      "Splits the order into smaller scheduled trades, each subject to your minimum price.",
    [SpotOrderType.TWAP_MARKET]:
      "Splits the order into smaller scheduled trades at the available market price.",
  };
  return (
    explanations[type] ||
    "Trades follow the price conditions and expiry time below."
  );
}
