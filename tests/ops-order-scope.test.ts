import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  createElement,
  Fragment,
  type ComponentType,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useOrderScope } from "../apps/ops/src/hooks/use-order-scope";
import { investigationFilterQuery } from "../apps/ops/src/lib/investigation-filter-query";
import { orderQuickViewFilters } from "../apps/ops/src/lib/order-quick-views";

// Resolve the provider from the app's dependencies, matching the hook's React context.
const requireOps = createRequire(resolve("apps/ops/package.json"));

function captureScope(search: string) {
  const updates: string[] = [];
  const adapter = {
    location: { search },
    push: (location: { search?: string }) =>
      updates.push(location.search ?? ""),
    replace: (location: { search?: string }) =>
      updates.push(location.search ?? ""),
  };
  function Adapter({
    children,
  }: {
    children: (value: typeof adapter) => ReactNode;
  }) {
    return createElement(Fragment, null, children(adapter));
  }
  const { QueryParamProvider } = requireOps("use-query-params") as {
    QueryParamProvider: ComponentType<{
      adapter: typeof Adapter;
      children?: ReactNode;
    }>;
  };
  let scope: ReturnType<typeof useOrderScope> | undefined;
  function Capture() {
    scope = useOrderScope();
    return null;
  }
  renderToStaticMarkup(
    createElement(
      QueryParamProvider,
      { adapter: Adapter },
      createElement(Capture),
    ),
  );
  assert.ok(scope);
  return { scope, updates };
}

test("24-hour scope resolves to one rolling day and survives filter updates", () => {
  const { scope, updates } = captureScope("?period=1&partner_id=sushiswap");
  assert.equal(scope.period, "1");
  assert.equal(scope.days, 1);
  scope.setChains(["137"]);
  const params = new URLSearchParams(updates[0]);
  assert.equal(params.get("period"), "1");
  assert.equal(params.get("partner_id"), "sushiswap");
});

test("scope reset clears all global filters with one navigation and preserves unrelated repeated params", () => {
  const { scope, updates } = captureScope(
    "?period=all&chain_id=137&chain_id=42161&partner_id=quickswap&tag=one&tag=two",
  );
  assert.equal(scope.period, "all");
  assert.deepEqual(scope.chainIds, ["137", "42161"]);
  scope.reset();
  assert.equal(updates.length, 1);
  const params = new URLSearchParams(updates[0]);
  assert.equal(params.has("period"), false);
  assert.equal(params.has("chain_id"), false);
  assert.equal(params.has("partner_id"), false);
  assert.deepEqual(params.getAll("tag"), ["one", "two"]);
});

test("scope changes preserve other filters and repeated network values", () => {
  const { scope, updates } = captureScope(
    "?period=30&partner_id=pancakeswap&extra=keep",
  );
  scope.setChains(["137", "42161"]);
  const params = new URLSearchParams(updates[0]);
  assert.deepEqual(params.getAll("chain_id"), ["137", "42161"]);
  assert.equal(params.get("partner_id"), "pancakeswap");
  assert.equal(params.get("period"), "30");
  assert.equal(params.get("extra"), "keep");
  const invalid = captureScope("?period=invalid&chain_id&partner_id").scope;
  assert.equal(invalid.period, "7");
  assert.deepEqual(invalid.chainIds, []);
  assert.deepEqual(invalid.partnerIds, []);
});

test("drawer applies scope and order facets in one URL update without losing unrelated state", () => {
  const { scope, updates } = captureScope(
    "?period=7&chain_id=1&partner_id=thena&view=orders&tag=one&tag=two",
  );
  scope.applyFilters(
    { period: "30", chainIds: ["137", "42161"], partnerIds: ["sushiswap"] },
    { order_status: "active", min_usd: "0", max_usd: "100" },
  );
  assert.equal(updates.length, 1);
  const params = new URLSearchParams(updates[0]);
  assert.equal(params.get("period"), "30");
  assert.deepEqual(params.getAll("chain_id"), ["137", "42161"]);
  assert.deepEqual(params.getAll("partner_id"), ["sushiswap"]);
  assert.equal(params.get("order_status"), "active");
  assert.equal(params.get("min_usd"), "0");
  assert.equal(params.get("max_usd"), "100");
  assert.equal(params.get("view"), "orders");
  assert.deepEqual(params.getAll("tag"), ["one", "two"]);
});

test("unrestricted drawer scope uses all history and removes network and app selections", () => {
  const { scope, updates } = captureScope(
    "?period=30&chain_id=137&partner_id=sushiswap",
  );
  scope.applyFilters({ period: "all", chainIds: [], partnerIds: [] });
  const params = new URLSearchParams(updates[0]);
  assert.equal(params.get("period"), "all");
  assert.equal(params.has("chain_id"), false);
  assert.equal(params.has("partner_id"), false);
});

test("quick-view replacement clears old list facets in one update while retaining global scope and raw-column preference", () => {
  const { scope, updates } = captureScope(
    "?period=30&chain_id=137&chain_id=8453&partner_id=sushiswap&order_search=gas&order_adapter=old-adapter&order_token=old-token&order_swapper=old-wallet&order_status=failed&order_type=Market&order_source=v1&order_errors=any&min_usd=10&max_usd=50&order_sort=value-asc&order_raw=1&tag=one&tag=two",
  );
  scope.applyFilters(
    {
      period: scope.period,
      chainIds: scope.chainIds,
      partnerIds: scope.partnerIds,
    },
    investigationFilterQuery(orderQuickViewFilters("aged")),
  );
  assert.equal(updates.length, 1);
  const params = new URLSearchParams(updates[0]);
  assert.equal(params.get("period"), "30");
  assert.deepEqual(params.getAll("chain_id"), ["137", "8453"]);
  assert.deepEqual(params.getAll("partner_id"), ["sushiswap"]);
  assert.equal(params.get("order_status"), "active");
  assert.equal(params.get("order_active_age"), "24h");
  assert.equal(params.get("order_sort"), "oldest");
  assert.equal(params.get("order_raw"), "1");
  assert.deepEqual(params.getAll("tag"), ["one", "two"]);
  for (const key of [
    "order_search",
    "order_adapter",
    "order_token",
    "order_swapper",
    "order_type",
    "order_source",
    "order_errors",
    "min_usd",
    "max_usd",
  ])
    assert.equal(
      params.has(key),
      false,
      `${key} from the previous view was cleared`,
    );
});
