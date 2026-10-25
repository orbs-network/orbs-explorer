import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListOrder } from "../packages/domain/src/twap/types";
import {
  buildCategoricalCohorts,
  buildMarketAnalytics,
  buildOrderSizeDistribution,
  buildPlacementHeatmap,
  percentile,
  summarizeCohort,
} from "../apps/ops/src/lib/market-analytics";

const snapshot = Date.parse("2026-10-20T12:00:00Z");
const a = `0x${"a".repeat(40)}`;
const b = `0x${"b".repeat(40)}`;
function order(value: string, extra: Partial<ListOrder> = {}): ListOrder {
  return {
    hash: value,
    source: "v2",
    inputToken: a,
    outputToken: b,
    timestamp: "2026-10-20T10:00:00Z",
    totalUSDAmount: value,
    metadata: { status: "completed", orderType: "Market Order" },
    order: { witness: { chainId: 137, deadline: "1800000000" } },
    ...extra,
  } as ListOrder;
}

test("market routes are directional, case insensitive, and isolated by network", () => {
  const one = order("20");
  const same = order("30", {
    inputToken: a.toUpperCase(),
    outputToken: b.toUpperCase(),
  });
  const reversed = order("40", { inputToken: b, outputToken: a });
  const otherNetwork = order("60", {
    order: { witness: { chainId: 1 } },
  } as Partial<ListOrder>);
  const data = buildMarketAnalytics([one, same, reversed, otherNetwork]);
  assert.equal(data.routes.length, 3);
  assert.equal(data.routes[0].chainId, 1);
  const route = data.routes.find(
    (route) => route.chainId === 137 && route.input.address === a,
  )!;
  assert.equal(route.summary.value, 50);
  assert.deepEqual(route.summary.orders, [one, same]);
  assert.equal(data.tokens.length, 4);
  assert.equal(
    data.routes.reduce((sum, route) => sum + route.summary.orders.length, 0),
    4,
  );
  assert.equal(
    data.routes.reduce((sum, route) => sum + route.summary.value, 0),
    150,
  );
});

test("token involvement deduplicates same-token order sides while preserving input and output demand", () => {
  const self = order("10", { outputToken: a.toUpperCase() });
  const outgoing = order("20");
  const incoming = order("30", { inputToken: b, outputToken: a });
  const data = buildMarketAnalytics([self, outgoing, incoming]);
  const token = data.tokens.find((token) => token.address === a)!;
  assert.equal(token.summary.orders.length, 3);
  assert.equal(token.summary.value, 60);
  assert.deepEqual(token.input.orders, [self, outgoing]);
  assert.deepEqual(token.output.orders, [self, incoming]);
  assert.equal(token.input.value, 30);
  assert.equal(token.output.value, 40);
  // Cross-token exposure intentionally overlaps: this is not additive trading volume.
  assert.equal(
    data.tokens.reduce((sum, token) => sum + token.summary.value, 0),
    110,
  );
});

test("cohort statistics reject unreported values, include reported zeroes, and interpolate percentiles", () => {
  const values = ["0", "10", "30", "100", "", " ", "NaN", "Infinity", "-1"];
  const data = summarizeCohort(values.map((value) => order(value)));
  assert.equal(data.pricedCount, 4);
  assert.equal(data.unpriced.length, 5);
  assert.equal(data.value, 140);
  assert.equal(data.mean, 35);
  assert.equal(data.median, 20);
  assert.ok(Math.abs(data.p90! - 79) < 1e-10);
  assert.equal(data.maximum, 100);
  assert.equal(percentile([], 0.9), undefined);
  assert.equal(percentile([12], 0.5), 12);
  assert.equal(summarizeCohort([]).mean, undefined);
});

test("outcome comparison keeps active retries and recovered error history separate from terminal failures", () => {
  const retry = order("10", {
    metadata: {
      status: "pending",
      chunkSummary: { error: 2, lastChunkStatus: "error" },
    },
  } as Partial<ListOrder>);
  const recovered = order("20", {
    metadata: {
      status: "completed",
      chunkSummary: { error: 1, lastChunkStatus: "success" },
    },
  } as Partial<ListOrder>);
  const failed = order("40", {
    metadata: { status: "failed" },
  } as Partial<ListOrder>);
  const cancelled = order("50", {
    metadata: { status: "failed", displayOnlyStatus: "CANCELLED" },
  } as Partial<ListOrder>);
  const unknown = order("", {
    metadata: { status: "unrecognized" },
  } as Partial<ListOrder>);
  const data = summarizeCohort([retry, recovered, failed, cancelled, unknown]);
  assert.deepEqual(data.outcomes.active, [retry]);
  assert.deepEqual(data.outcomes.completed, [recovered]);
  assert.deepEqual(data.outcomes.failed, [failed]);
  assert.deepEqual(data.outcomes.cancelled, [cancelled]);
  assert.deepEqual(data.withErrors, [retry, recovered]);
  assert.equal(
    Object.values(data.outcomes).reduce((sum, group) => sum + group.length, 0),
    5,
  );
  assert.equal(data.outcomes.completed.length / data.orders.length, 0.2);
});

test("USD size buckets are mutually exclusive and keep missing values separate", () => {
  const orders = [
    "0",
    "0.01",
    "9.99",
    "10",
    "99.99",
    "100",
    "999.99",
    "1000",
    "9999.99",
    "10000",
    "50000",
    "",
    "-2",
  ].map((value) => order(value));
  const sizes = buildOrderSizeDistribution(orders);
  assert.deepEqual(
    sizes.map((bucket) => bucket.orders.length),
    [1, 2, 2, 2, 2, 2, 2],
  );
  assert.equal(sizes.flatMap((bucket) => bucket.orders).length, orders.length);
  assert.equal(
    new Set(sizes.flatMap((bucket) => bucket.orders)).size,
    orders.length,
  );
  assert.equal(sizes.at(-1)?.summary.pricedCount, 0);
  assert.equal(sizes[0].summary.pricedCount, 1);
});

test("token labels can enrich from preloaded metadata without changing source orders", () => {
  const original = order("10");
  const token = {
    address: a,
    symbol: "AAA",
    decimals: 18,
    logoUrl: "https://example.com/a.png",
  };
  const data = buildMarketAnalytics([original], (address) =>
    address === a ? token : undefined,
  );
  assert.equal(data.routes[0].input.token?.symbol, "AAA");
  assert.equal(
    data.tokens.find((reference) => reference.address === a)?.token?.logoUrl,
    token.logoUrl,
  );
  assert.equal(original.metadata.srcToken, undefined);
});

test("UTC placement cells handle timezone offsets and exclude unusable or future times with coverage", () => {
  const monday = order("10", { timestamp: "2026-10-19T23:30:00Z" });
  const tuesday = order("20", { timestamp: "2026-10-19T23:30:00-03:00" });
  const missing = order("30", { timestamp: "invalid" });
  const future = order("40", { timestamp: "2026-10-21T12:00:00Z" });
  const data = buildPlacementHeatmap(
    [monday, tuesday, missing, future],
    snapshot,
  );
  assert.equal(data.cells.length, 168);
  assert.deepEqual(
    data.cells.find((cell) => cell.day === 0 && cell.hour === 23)?.orders,
    [monday],
  );
  assert.deepEqual(
    data.cells.find((cell) => cell.day === 1 && cell.hour === 2)?.orders,
    [tuesday],
  );
  assert.deepEqual(data.excluded, [missing, future]);
  assert.equal(data.included, 2);
  assert.equal(data.maximum, 1);
  assert.equal(
    data.cells.reduce((sum, cell) => sum + cell.value, 0),
    30,
  );
});

test("source and type cohorts retain every selected order and give missing reports a separate category", () => {
  const one = order("10");
  const two = order("20", {
    source: "v1",
    metadata: { orderType: " Limit " },
  } as Partial<ListOrder>);
  const three = order("30", {
    source: undefined,
    metadata: { orderType: "" },
  } as Partial<ListOrder>);
  const source = buildCategoricalCohorts([one, two, three], "source");
  const type = buildCategoricalCohorts([one, two, three], "type");
  assert.deepEqual(
    source.map((group) => group.label),
    ["v2", "v1", "Source not provided"],
  );
  assert.deepEqual(
    type.map((group) => group.label),
    ["Market Order", "Limit", "Type not provided"],
  );
  assert.equal(
    source.reduce((sum, group) => sum + group.orders.length, 0),
    3,
  );
  assert.equal(
    type.reduce((sum, group) => sum + group.orders.length, 0),
    3,
  );
  assert.deepEqual(buildMarketAnalytics([]).routes, []);
  assert.equal(buildPlacementHeatmap([], snapshot).maximum, 0);
});
