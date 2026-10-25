import BN from "bignumber.js";
import { parseChunkDescription } from "@orbs/domain/twap/utils";
import { SpotOrderType } from "@orbs/domain/twap/types";

export type OrderConditionComparison = {
  kind: "limit" | "trigger";
  current: string;
  target: string;
  direction: "at-least" | "at-most";
  difference: string;
};

/** The service describes receive amounts for the next trade, not a live market quote. */
export function getOrderConditionComparison(
  reason: string | undefined,
  type: SpotOrderType,
): OrderConditionComparison | undefined {
  const parsed = parseChunkDescription(reason);
  if (parsed.type !== "limit_price" && parsed.type !== "trigger")
    return undefined;
  const current = new BN(
    parsed.type === "limit_price" ? parsed.got : parsed.current,
  );
  const target = new BN(
    parsed.type === "limit_price" ? parsed.expected : parsed.trigger,
  );
  if (
    !current.isFinite() ||
    current.isNegative() ||
    !target.isFinite() ||
    !target.gt(0)
  )
    return undefined;
  const direction =
    parsed.type === "limit_price" || type === SpotOrderType.TAKE_PROFIT
      ? "at-least"
      : "at-most";
  const difference = BN.maximum(
    0,
    direction === "at-least" ? target.minus(current) : current.minus(target),
  );
  return {
    kind: parsed.type === "limit_price" ? "limit" : "trigger",
    current: current.toFixed(),
    target: target.toFixed(),
    direction,
    difference: difference.toFixed(),
  };
}

export function getOrderCheckTiming(
  value: string | number | undefined,
  updatedAt: number,
): { state: "scheduled"; time: number } | { state: "awaiting" | "unknown" } {
  if (!value) return { state: "unknown" };
  const numeric =
    typeof value === "number"
      ? value
      : /^\d+(\.\d+)?$/.test(value)
        ? Number(value)
        : undefined;
  const time =
    numeric === undefined
      ? Date.parse(String(value))
      : numeric < 1e12
        ? numeric * 1000
        : numeric;
  if (!Number.isFinite(time) || time <= 0) return { state: "unknown" };
  return time > updatedAt
    ? { state: "scheduled", time }
    : { state: "awaiting" };
}
