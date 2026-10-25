import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isOrderListAddress,
  orderAddressSearchHref,
} from "../apps/ops/src/lib/order-search-navigation";
import { orderDetailHref } from "../apps/ops/src/lib/order-investigation";

const address = `0x${"a".repeat(40)}`;
test("address search links to existing technical orders and retains effective filter scope", () => {
  const href = orderAddressSearchHref(` ${address.toUpperCase()} `, {
    query:
      "orders_view=summary&order_search=old&order_source=v1&order_errors=latest&order_token=token&partner_id=wrong&chain_id=1&arbitrary=drop",
    period: "all",
    chainIds: ["137", "8453"],
    partnerIds: ["sushiswap"],
  });
  const target = new URL(href!, "https://ops.example");
  assert.equal(target.pathname, "/orders");
  assert.equal(target.searchParams.get("orders_view"), "technical");
  assert.equal(target.searchParams.get("order_search"), address.toUpperCase());
  assert.equal(target.searchParams.get("period"), "all");
  assert.deepEqual(target.searchParams.getAll("chain_id"), ["137", "8453"]);
  assert.deepEqual(target.searchParams.getAll("partner_id"), ["sushiswap"]);
  assert.equal(target.searchParams.get("order_source"), "v1");
  assert.equal(target.searchParams.get("order_errors"), "latest");
  assert.equal(target.searchParams.get("order_token"), "token");
  assert.equal(target.searchParams.has("arbitrary"), false);
});
test("address mode validates a full address and does not confuse hashes or arbitrary paths with it", () => {
  assert.equal(isOrderListAddress(address), true);
  for (const input of [
    "",
    "0xabc",
    `0x${"g".repeat(40)}`,
    `0x${"a".repeat(64)}`,
    `${address}/extra`,
    "https://example.com",
  ]) {
    assert.equal(isOrderListAddress(input), false);
    assert.equal(orderAddressSearchHref(input), undefined);
  }
  const hash = `0x${"a".repeat(64)}`;
  assert.equal(
    orderDetailHref(hash),
    `/orders/${hash}`,
    "hash lookup keeps the direct route and never requires an order-list search",
  );
});
