import {
  ordersScopeHref,
  type OrderNavigationScope,
} from "./order-investigation";

export function isOrderListAddress(value: string): boolean {
  return /^0x[0-9a-f]{40}$/i.test(value.trim());
}

/** Order lists expose token/adapter addresses; wallet/transaction indexes are not implied. */
export function orderAddressSearchHref(
  address: string,
  scope?: OrderNavigationScope,
): string | undefined {
  if (!isOrderListAddress(address)) return;
  const search = new URLSearchParams(ordersScopeHref(scope).split("?")[1]);
  search.set("orders_view", "technical");
  search.set("order_search", address.trim());
  return `/orders?${search}`;
}
