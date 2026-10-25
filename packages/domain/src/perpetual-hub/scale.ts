/**
 * Scaling helpers for raw values returned by the Perpetual Hub backend.
 *
 * The hub serializes numeric fields as fixed-scale integer strings:
 *   - prices       — scaled by 1e18
 *   - quantities   — scaled by 1e8
 *   - USD amounts  — scaled by 1e6   (balances, fees, PnL, notional, etc.)
 *
 * Values that have already been converted to human-readable form arrive as
 * non-integer strings ("12.34") or plain numbers — the `isIntegerString`
 * guard skips them so we never double-scale.
 *
 * Apply these at the API boundary (Next.js route handlers) so display
 * components stay dumb and there's a single source of truth.
 */

import type {
  PerpetualHubOperation,
  PerpetualHubTrade,
  PerpetualHubUserCurrent,
  PerpetualHubUserDetail,
  PerpetualHubUserOrder,
  PerpetualHubUserPosition,
} from "./types";

export function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isIntegerString(value: unknown): boolean {
  return typeof value === "string" && /^-?\d+$/.test(value);
}

export function amountToUsd(value: unknown): number {
  const amount = toNumber(value);
  if (!amount) return 0;
  return isIntegerString(value) ? amount / 1e6 : amount;
}

export function quantityToUnits(value: unknown): number {
  const quantity = toNumber(value);
  if (!quantity) return 0;
  return isIntegerString(value) ? quantity / 1e8 : quantity;
}

export function priceToUsd(value: unknown): number {
  const price = toNumber(value);
  if (!price) return 0;
  return isIntegerString(value) ? price / 1e18 : price;
}

/**
 * Same as the *ToUsd / *ToUnits helpers, but preserves undefined for
 * fields that the backend omitted. Display code uses undefined to mean
 * "no value — render —" and 0 to mean "zero — render $0.00".
 */
export function scaleAmount(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  return amountToUsd(value);
}

export function scaleQuantity(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  return quantityToUnits(value);
}

export function scalePrice(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  return priceToUsd(value);
}

// ---------- Entity transformers ----------

/**
 * For most operations `amount` is a micro-USD value, but two operation types
 * overload the field with non-monetary integers we MUST NOT divide:
 *   - CHANGE_LEVERAGE → new leverage (e.g. "10")
 *   - CANCEL_ORDER    → cancelled order id
 * Preserve the raw value in those cases.
 */
const META_OP_TYPES = new Set(["CHANGE_LEVERAGE", "CANCEL_ORDER"]);

export function scaleOperation(op: PerpetualHubOperation): PerpetualHubOperation {
  const isMetaOp = META_OP_TYPES.has(op.operationType);
  return {
    ...op,
    quantity: scaleQuantity(op.quantity),
    price: scalePrice(op.price),
    amount: isMetaOp ? op.amount : scaleAmount(op.amount),
    fee: scaleAmount(op.fee),
    realizedPnl: scaleAmount(op.realizedPnl),
  };
}

export function scaleTrade(t: PerpetualHubTrade): PerpetualHubTrade {
  return {
    ...t,
    quantity: scaleQuantity(t.quantity),
    price: scalePrice(t.price),
    fee: scaleAmount(t.fee),
    realizedPnl: scaleAmount(t.realizedPnl),
  };
}

export function scalePosition(
  p: PerpetualHubUserPosition
): PerpetualHubUserPosition {
  return {
    ...p,
    quantity: scaleQuantity(p.quantity),
    positionAmt: scaleQuantity(p.positionAmt),
    entryPrice: scalePrice(p.entryPrice),
    markPrice: scalePrice(p.markPrice),
    notional: scaleAmount(p.notional),
    unrealizedPnl: scaleAmount(p.unrealizedPnl),
    liquidationPrice: scalePrice(p.liquidationPrice),
    maintenanceMargin: scaleAmount(p.maintenanceMargin),
    // leverage stays as-is — already a small integer/float.
  };
}

export function scaleOrder(o: PerpetualHubUserOrder): PerpetualHubUserOrder {
  return {
    ...o,
    quantity: scaleQuantity(o.quantity),
    price: scalePrice(o.price),
    stopPrice: scalePrice(o.stopPrice),
  };
}

export function scaleUserCurrent(
  c: PerpetualHubUserCurrent | undefined
): PerpetualHubUserCurrent | undefined {
  if (!c) return c;
  return {
    ...c,
    user: c.user
      ? { ...c.user, balance: scaleAmount(c.user.balance) }
      : c.user,
    positions: c.positions.map(scalePosition),
    pendingOrders: c.pendingOrders.map(scaleOrder),
    availableBalance: scaleAmount(c.availableBalance),
    marginUsed: scaleAmount(c.marginUsed),
    maintenanceMargin: scaleAmount(c.maintenanceMargin),
    marginBalance: scaleAmount(c.marginBalance),
    unrealizedPnl: scaleAmount(c.unrealizedPnl),
  };
}

export function scaleAccounting(
  a: PerpetualHubUserDetail["accounting"]
): PerpetualHubUserDetail["accounting"] {
  if (!a) return a;
  return {
    totalDeposits: scaleAmount(a.totalDeposits),
    totalWithdrawals: scaleAmount(a.totalWithdrawals),
    totalCommissionPaid: scaleAmount(a.totalCommissionPaid),
    totalFundingPaid: scaleAmount(a.totalFundingPaid),
    realizedPnl: scaleAmount(a.realizedPnl),
  };
}
