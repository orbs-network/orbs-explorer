import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListOrder } from "../packages/domain/src/twap/types";
import { buildOrderCharts } from "../apps/ops/src/lib/order-charts";

const snapshot = Date.parse("2026-10-20T12:00:00Z");
function order(
  timestamp: string,
  status = "completed",
  extra: Partial<ListOrder> = {},
): ListOrder {
  return {
    timestamp,
    hash: timestamp,
    source: "v2",
    totalUSDAmount: "10",
    metadata: { status, orderType: "Market Order" },
    ...extra,
  } as ListOrder;
}

test("charts fill UTC days with zeroes and place offset timestamps into the correct day", () => {
  const a = order("2026-10-19T23:30:00-03:00");
  const b = order("2026-10-18T10:00:00Z");
  const data = buildOrderCharts([a, b], snapshot, 7);
  assert.equal(data.interval, "day");
  assert.equal(data.buckets.length, 8);
  assert.equal(data.buckets.at(-1)?.total, 1);
  assert.deepEqual(data.buckets.at(-1)?.orders, [a]);
  assert.equal(
    data.buckets.find((bucket) => bucket.label === "Oct 17")?.total,
    0,
  );
  assert.equal(
    data.buckets.reduce((sum, bucket) => sum + bucket.total, 0),
    2,
  );
  assert.equal(
    data.buckets.reduce((sum, bucket) => sum + bucket.value, 0),
    20,
  );
});

test("chart error history stays distinct from terminal failure and dollar totals reject invalid values", () => {
  const pending = order("2026-10-20T10:00:00Z", "pending");
  pending.metadata.chunkSummary = {
    error: 2,
    lastChunkStatus: "error",
  } as ListOrder["metadata"]["chunkSummary"];
  const failure = order("2026-10-20T11:00:00Z", "failed", {
    totalUSDAmount: "invalid",
  });
  const cancelled = order("2026-10-20T09:00:00Z", "failed");
  cancelled.metadata.displayOnlyStatus = "CANCELLED";
  const data = buildOrderCharts([pending, failure, cancelled], snapshot, 7);
  const last = data.buckets.at(-1)!;
  assert.equal(last.active, 1);
  assert.equal(last.failed, 1);
  assert.equal(last.cancelled, 1);
  assert.equal(last.withErrors, 1);
  assert.equal(last.value, 20);
  assert.equal(
    data.outcomes.reduce((sum, row) => sum + row.orders.length, 0),
    3,
  );
});

test("long histories use Monday UTC weeks or calendar months including empty periods", () => {
  const weekly = buildOrderCharts([order("2026-08-01T12:00:00Z")], snapshot);
  assert.equal(weekly.interval, "week");
  assert.ok(
    weekly.buckets.every(
      (bucket) => new Date(bucket.timestamp).getUTCDay() === 1,
    ),
  );
  const monthly = buildOrderCharts(
    [order("2024-01-31T23:59:00Z"), order("2024-02-29T12:00:00Z")],
    snapshot,
  );
  assert.equal(monthly.interval, "month");
  assert.ok(
    monthly.buckets.every(
      (bucket) => new Date(bucket.timestamp).getUTCDate() === 1,
    ),
  );
  assert.equal(monthly.buckets[0].total, 1);
  assert.equal(monthly.buckets[1].total, 1);
  assert.equal(monthly.buckets[2].total, 0);
});

test("invalid and future placement dates remain in categorical totals with timeline coverage reported", () => {
  const data = buildOrderCharts(
    [
      order("invalid"),
      order("2026-10-21T12:00:00Z"),
      order("2026-10-20T10:00:00Z"),
    ],
    snapshot,
  );
  assert.equal(data.undatedOrders, 2);
  assert.equal(
    data.buckets.reduce((sum, bucket) => sum + bucket.total, 0),
    1,
  );
  assert.equal(data.types[0].orders.length, 3);
  assert.equal(data.sources[0].orders.length, 3);
});

test("empty chart scopes produce finite zero values and no fabricated outcomes", () => {
  const data = buildOrderCharts([], snapshot, 7);
  assert.equal(data.buckets.length, 8);
  assert.ok(
    data.buckets.every((bucket) => bucket.total === 0 && bucket.value === 0),
  );
  assert.equal(
    data.outcomes.reduce((sum, row) => sum + row.orders.length, 0),
    0,
  );
  assert.deepEqual(data.sources, []);
});

test("selectable intervals preserve cohort totals and flag clipped UTC periods", () => {
  const orders = [order("2026-10-19T10:00:00Z"), order("2026-10-20T10:00:00Z")];
  for (const interval of ["day", "week", "month"] as const) {
    const data = buildOrderCharts(orders, snapshot, 7, interval);
    assert.equal(data.interval, interval);
    assert.equal(
      data.buckets.reduce((sum, bucket) => sum + bucket.total, 0),
      2,
    );
    assert.equal(
      data.buckets.reduce((sum, bucket) => sum + bucket.value, 0),
      20,
    );
    assert.equal(data.buckets[0].partialPeriod, true);
    assert.equal(data.buckets[0].coverageStart, snapshot - 7 * 86_400_000);
    assert.equal(data.buckets.at(-1)?.partialPeriod, true);
    assert.equal(data.buckets.at(-1)?.coverageEnd, snapshot);
  }
  const daily = buildOrderCharts(orders, snapshot, 7, "day");
  assert.equal(daily.buckets[1].partialPeriod, false);
});

test("interval controls bound long histories and use calendar month ends", () => {
  const data = buildOrderCharts(
    [order("2024-02-01T00:00:00Z")],
    snapshot,
    undefined,
    "month",
  );
  assert.equal(data.buckets[0].coverageEnd, Date.parse("2024-03-01T00:00:00Z"));
  assert.equal(data.buckets[0].partialPeriod, false);
  const bounded = buildOrderCharts(
    [order("2020-01-01T00:00:00Z")],
    snapshot,
    undefined,
    "day",
  );
  assert.equal(bounded.interval, "month");
  assert.ok(bounded.buckets.length < 100);
});
