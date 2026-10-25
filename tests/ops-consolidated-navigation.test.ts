import assert from "node:assert/strict";
import { test } from "node:test";
import { consolidatedViewHref } from "../apps/ops/src/lib/consolidated-navigation";

const urlFor = (path: string, search: string) =>
  new URL(consolidatedViewHref(path, search)!, "https://ops.example");

test("active-order bookmarks use the canonical Orders table without hiding older active orders", () => {
  for (const [review, key, value] of [
    ["past", "order_deadline", "past"],
    ["soon", "order_deadline", "soon"],
    ["latest", "order_errors", "latest"],
    ["older", "order_active_age", "24h"],
  ]) {
    const url = urlFor(
      "/health",
      `period=7&chain_id=137&chain_id=1&partner_id=quick&review_filter=${review}&order_search=unrelated`,
    );
    assert.equal(url.pathname, "/orders");
    assert.equal(url.searchParams.get("period"), "all");
    assert.equal(url.searchParams.get("order_status"), "active");
    assert.equal(url.searchParams.get(key), value);
    assert.deepEqual(url.searchParams.getAll("chain_id"), ["137", "1"]);
    assert.deepEqual(url.searchParams.getAll("partner_id"), ["quickswap"]);
    assert.equal(url.searchParams.has("order_search"), false);
  }
  assert.equal(
    urlFor("/health", "period=7").searchParams.get("order_review"),
    "attention",
  );
  assert.equal(
    urlFor("/health", "review_filter=all").searchParams.has("order_review"),
    false,
  );
  assert.equal(
    urlFor("/health", "period=30&active_scope=placement").searchParams.get(
      "period",
    ),
    "30",
  );
});

test("removed analysis views retain scope and open the corresponding analysis", () => {
  const cases = [
    [
      "/charts",
      "chart_view=breakdown&chart_group=networks&chart_measure=value",
      "/performance",
      "cohort_view",
      "sizes",
    ],
    [
      "/performance",
      "performance_view=placement",
      "/charts",
      "chart_view",
      "placement",
    ],
    ["/failures", "failure_view=apps", "/performance", "cohort_view", "errors"],
    ["/markets", "market_view=demand", "/markets", "market_view", "tokens"],
    [
      "/markets",
      "market_view=coverage",
      "/data-quality",
      "data_view",
      "fields",
    ],
    ["/security", "security_view=orders", "/charts", "period", "30"],
  ];
  for (const [path, search, destination, key, value] of cases) {
    const url = urlFor(
      path,
      `${search}&period=30&chain_id=137&partner_id=quick&order_status=failed`,
    );
    assert.equal(url.pathname, destination);
    assert.equal(url.searchParams.get(key), value);
    assert.equal(url.searchParams.get("period"), "30");
    assert.equal(url.searchParams.get("partner_id"), "quickswap");
    assert.equal(url.searchParams.get("chain_id"), "137");
    assert.equal(url.searchParams.has("order_status"), false);
    assert.equal(
      consolidatedViewHref(url.pathname, url.search),
      undefined,
      "destination must not redirect again",
    );
  }
});

test("distinct views and similarly named paths remain unchanged", () => {
  for (const [path, search] of [
    ["/orders", "order_status=active"],
    ["/partners/health", "view=orders"],
    ["/security", "security_view=health"],
    ["/charts", "chart_view=placement"],
    ["/adapters", "adapter_view=address"],
    ["/data-quality", "data_view=consistency"],
  ])
    assert.equal(consolidatedViewHref(path, search), undefined);
});
