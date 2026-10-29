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
    ["/markets", "market_view=coverage", "/", "period", "30"],
    ["/security", "security_view=orders", "/", "period", "30"],
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
    ["/charts", "chart_view=placement"],
  ])
    assert.equal(consolidatedViewHref(path, search), undefined);
});

test("retired failure bookmarks open All orders with the Failed status filter", () => {
  const url = urlFor(
    "/failures",
    "period=30&chain_id=137&chain_id=1&partner_id=quick&failure_view=reasons&failure_reason_search=gas",
  );
  assert.equal(url.pathname, "/orders");
  assert.equal(url.searchParams.get("period"), "30");
  assert.deepEqual(url.searchParams.getAll("chain_id"), ["137", "1"]);
  assert.equal(url.searchParams.get("partner_id"), "quickswap");
  assert.equal(url.searchParams.get("order_status"), "failed");
  assert.equal(url.searchParams.has("failure_view"), false);
  assert.equal(url.searchParams.has("failure_reason_search"), false);
  assert.equal(consolidatedViewHref(url.pathname, url.search), undefined);
});

test("retired Monitoring pages return to Overview without retaining their private view state", () => {
  for (const path of [
    "/security",
    "/adapters",
    "/data-quality",
    "/run-telegram-alerts",
  ]) {
    const url = urlFor(
      path,
      "period=30&chain_id=137&chain_id=1&partner_id=quick&security_view=health&adapter_view=address&data_view=fields&order_search=hidden",
    );
    assert.equal(url.pathname, "/");
    assert.equal(url.searchParams.get("period"), "30");
    assert.deepEqual(url.searchParams.getAll("chain_id"), ["137", "1"]);
    assert.deepEqual(url.searchParams.getAll("partner_id"), ["quickswap"]);
    assert.deepEqual(
      [...url.searchParams.keys()],
      ["period", "chain_id", "chain_id", "partner_id"],
    );
    assert.equal(consolidatedViewHref(url.pathname, url.search), undefined);
  }
  assert.equal(
    consolidatedViewHref("/partners/security", "view=orders"),
    undefined,
  );
});
