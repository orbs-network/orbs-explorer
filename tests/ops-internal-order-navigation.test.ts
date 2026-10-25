import assert from "node:assert/strict";
import { test } from "node:test";
import {
  orderDetailHref,
  ordersScopeHref,
  type OrderNavigationScope,
} from "../apps/ops/src/lib/order-investigation";

const origin = "https://ops.example";
const hash = `0x${"ab".repeat(32)}`;
const adapter = `0x${"c".repeat(40)}`;
const token = `0x${"d".repeat(40)}`;
const url = (href: string) => new URL(href, origin);
const scope: OrderNavigationScope = {
  period: "all",
  chainIds: ["137", "8453", "0"],
  partnerIds: ["quickswap", "Custom / Dex"],
  query: new URLSearchParams([
    ["period", "all"],
    ["chain_id", "137"],
    ["chain_id", "8453"],
    ["chain_id", "0"],
    ["partner_id", "quickswap"],
    ["partner_id", "Custom / Dex"],
    ["orders_view", "technical"],
    ["order_search", "execution reverted & allowance"],
    ["order_status", "active"],
    ["order_type", "twap"],
    ["order_source", "v1"],
    ["order_errors", "latest"],
    ["order_adapter", adapter],
    ["order_token", token],
    ["min_usd", "0"],
    ["max_usd", "123.45"],
    ["order_sort", "errors-desc"],
    ["source", "v1"],
    ["order_view", "execution"],
    ["view", "failures"],
    ["security_view", "findings"],
    ["tag", "one"],
    ["tag", "two"],
  ]).toString(),
};

function assertRetainedFilters(search: URLSearchParams) {
  assert.equal(search.get("period"), "all");
  assert.deepEqual(search.getAll("chain_id"), ["137", "8453", "0"]);
  assert.deepEqual(search.getAll("partner_id"), ["quickswap", "Custom / Dex"]);
  assert.equal(search.get("orders_view"), "technical");
  assert.equal(search.get("order_search"), "execution reverted & allowance");
  assert.equal(search.get("order_status"), "active");
  assert.equal(search.get("order_type"), "twap");
  assert.equal(search.get("order_source"), "v1");
  assert.equal(search.get("order_errors"), "latest");
  assert.equal(search.get("order_adapter"), adapter);
  assert.equal(search.get("order_token"), token);
  assert.equal(search.get("min_usd"), "0");
  assert.equal(search.get("max_usd"), "123.45");
  assert.equal(search.get("order_sort"), "errors-desc");
  for (const key of ["order_view", "view", "security_view", "tag"])
    assert.equal(search.has(key), false, `${key} belongs to another view`);
}

test("internal order links preserve every supported investigation bookmark and repeated global selection", () => {
  const detail = url(orderDetailHref(hash, "v2", scope));
  assert.equal(detail.origin, origin);
  assert.equal(detail.pathname, `/orders/${hash}`);
  assertRetainedFilters(detail.searchParams);
  assert.deepEqual(detail.searchParams.getAll("source"), ["v2"]);

  const orders = url(ordersScopeHref(scope));
  assert.equal(orders.pathname, "/orders");
  assertRetainedFilters(orders.searchParams);
  assert.equal(orders.searchParams.has("source"), false);
});

test("effective route scope replaces conflicting bookmarked apps and networks", () => {
  const fixedPartnerScope: OrderNavigationScope = {
    ...scope,
    period: "30",
    partnerIds: ["sushiswap"],
    chainIds: ["0", "42161"],
  };
  for (const href of [
    orderDetailHref(hash, "v1", fixedPartnerScope),
    ordersScopeHref(fixedPartnerScope),
  ]) {
    const search = url(href).searchParams;
    assert.equal(search.get("period"), "30");
    assert.deepEqual(search.getAll("partner_id"), ["sushiswap"]);
    assert.deepEqual(search.getAll("chain_id"), ["0", "42161"]);
    assert.equal(search.get("order_search"), "execution reverted & allowance");
  }
});

test("cleared effective selections remove old query selections rather than reviving them", () => {
  const cleared: OrderNavigationScope = {
    ...scope,
    chainIds: [],
    partnerIds: [],
  };
  for (const href of [
    orderDetailHref(hash, undefined, cleared),
    ordersScopeHref(cleared),
  ]) {
    const search = url(href).searchParams;
    assert.equal(search.has("chain_id"), false);
    assert.equal(search.has("partner_id"), false);
    assert.equal(search.get("order_source"), "v1");
  }
});

test("changing detail service replaces only detail source while retaining its independent source filter", () => {
  const current = url(orderDetailHref(hash, "v2", scope));
  const changedScope = { ...scope, query: current.searchParams.toString() };
  const original = url(orderDetailHref(hash, "v1", changedScope));
  assert.deepEqual(original.searchParams.getAll("source"), ["v1"]);
  assertRetainedFilters(original.searchParams);

  const both = url(orderDetailHref(hash, undefined, changedScope));
  assert.equal(both.searchParams.has("source"), false);
  assertRetainedFilters(both.searchParams);

  const returned = url(
    ordersScopeHref({ ...scope, query: original.searchParams.toString() }),
  );
  assert.equal(returned.searchParams.has("source"), false);
  assert.equal(
    returned.searchParams.get("order_source"),
    "v1",
    "an explicit investigation filter is distinct from detail service selection",
  );
});

test("unrecognized or missing row sources never default to the original service or add legacy filter parameters", () => {
  const unknownScope = {
    period: "7",
    chainIds: ["137"],
    partnerIds: ["sushiswap"],
    query: "source=v1&order_view=payload",
  };
  for (const source of [undefined, null, "", "future-service"]) {
    const search = url(
      orderDetailHref(hash, source as "v1" | "v2" | undefined, unknownScope),
    ).searchParams;
    assert.equal(search.has("source"), false);
    assert.equal(search.has("order_source"), false);
    assert.equal(search.has("order_view"), false);
    assert.equal(search.get("chain_id"), "137");
  }
});

test("order hashes are encoded as a local path segment and cannot alter query scope or origin", () => {
  const unsafeHash = "a/b?source=v1#https://outside.example";
  const detail = url(orderDetailHref(unsafeHash, "v2", scope));
  assert.equal(detail.origin, origin);
  assert.equal(
    decodeURIComponent(detail.pathname.slice("/orders/".length)),
    unsafeHash,
  );
  assert.equal(detail.hash, "");
  assert.deepEqual(detail.searchParams.getAll("source"), ["v2"]);
  assertRetainedFilters(detail.searchParams);
});
