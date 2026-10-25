import type { ListOrder } from "@orbs/domain/twap/types";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";

export type OrderSelection = {
  label: string;
  keys: string[];
  snapshot: number;
  origin: string;
};
export const orderIdentity = (order: ListOrder) =>
  `${order.source ?? "unreported"}:${getTwapOrderChainId(order) ?? "unreported"}:${String(order.hash ?? "unreported").toLowerCase()}`;

export function selectionOrders(
  orders: ListOrder[],
  selection: OrderSelection,
) {
  const keys = new Set(selection.keys);
  return orders.filter((order) => keys.has(orderIdentity(order)));
}

const prefix = "orbs-ops-order-set:";
export function saveOrderSelection(selection: OrderSelection) {
  const id = crypto.randomUUID();
  // Keep exact membership across refreshes and Back without putting hundreds
  // of hashes in a URL. The selection is local; the order records stay live.
  sessionStorage.setItem(prefix + id, JSON.stringify(selection));
  return id;
}
export function readOrderSelection(id: string): OrderSelection | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(prefix + id) ?? "null");
    return value &&
      typeof value.label === "string" &&
      Array.isArray(value.keys) &&
      value.keys.every((key: unknown) => typeof key === "string") &&
      typeof value.snapshot === "number" &&
      typeof value.origin === "string" &&
      value.origin.startsWith("/") &&
      !value.origin.startsWith("//") &&
      !value.origin.includes("\\")
      ? value
      : null;
  } catch {
    return null;
  }
}
