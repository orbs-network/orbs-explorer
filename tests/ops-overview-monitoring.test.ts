import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListOrder, SpotConfig } from "../packages/domain/src/twap/types";
import type { PartnerCard } from "../packages/domain/src/twap/utils/orders-overview";
import { buildSpotOverview } from "../apps/ops/src/lib/overview-data";
import {
  buildOverviewSignals,
  buildRecentActivity,
  DEFAULT_MONITORING_RULES,
  parseMonitoringRules,
} from "../apps/ops/src/lib/overview-monitoring";

const snapshot = Date.parse("2026-10-21T12:30:00Z");
const hour = 3_600_000;
function order(
  hash: string,
  hoursAgo: number,
  status = "completed",
  extra: Partial<ListOrder> = {},
): ListOrder {
  return {
    hash,
    timestamp: new Date(snapshot - hoursAgo * hour).toISOString(),
    exchangeAdapter: "quick-adapter",
    inputToken: "input",
    outputToken: "output",
    totalUSDAmount: "10",
    metadata: { status, displayOnlyStatus: "" },
    order: { witness: { chainId: 137 } },
    ...extra,
  } as ListOrder;
}
const cards = (orders: ListOrder[]): PartnerCard[] =>
  [
    {
      partnerId: "quickswap",
      partnerName: "QuickSwap",
      chains: [
        { chainId: 137, chainName: "Polygon", orders, stats: {}, topPairs: [] },
      ],
    },
  ] as PartnerCard[];

test("recent activity uses complete rolling placement intervals and exclusive latest outcomes", () => {
  const orders = [
    order("start", 24),
    order("end", 0, "failed"),
    order("partial", 1, "partially_completed"),
    order("old", 24.0001, "failed"),
    order("future", -1, "failed"),
    order("invalid", 0, "failed", { timestamp: "invalid" }),
  ];
  const data = buildRecentActivity(orders, snapshot, 24);
  assert.equal(data.buckets.length, 24);
  assert.equal(data.buckets[0].timestamp, snapshot - 24 * hour);
  assert.equal(data.buckets.at(-1)?.end, snapshot);
  assert.equal(data.orders.length, 3);
  assert.equal(data.excludedTimestamps, 2);
  assert.deepEqual(
    data.buckets
      .flatMap((bucket) => bucket.orders)
      .map((record) => record.hash)
      .sort(),
    ["end", "partial", "start"],
  );
  for (const bucket of data.buckets)
    assert.equal(
      bucket.completed + bucket.failed + bucket.other,
      bucket.orders.length,
    );
  assert.equal(data.buckets[0].failureRate, 0);
  assert.equal(data.buckets[1].failureRate, undefined);
  assert.equal(data.buckets.at(-1)?.failureRate, 1 / 2);
  assert.equal(buildRecentActivity(orders, snapshot, 168).buckets.length, 7);
  assert.equal(buildRecentActivity(orders, 0, 24).buckets.length, 0);
});

test("failure review uses placed-order denominator, minimum sample, inclusive rate and recent window", () => {
  const orders = [
    order("failed", 1, "failed"),
    order("completed", 1),
    order("partial", 1, "partially_completed"),
    order("cancelled", 1, "cancelled"),
    order("expired", 1, "expired"),
    order("older-failed", 25, "failed"),
  ];
  const rules = { ...DEFAULT_MONITORING_RULES, minimumOrders: 5 };
  const data = buildOverviewSignals({
    orders,
    partnerCards: cards(orders),
    snapshot,
    rules,
  });
  assert.equal(data.elevatedApps.length, 1);
  assert.equal(data.elevatedApps[0].rate, 1 / 5);
  assert.equal(data.elevatedApps[0].failed.length, 1);
  assert.equal(data.elevatedApps[0].recent.length, 5);
  assert.equal(
    buildOverviewSignals({
      orders,
      partnerCards: cards(orders),
      snapshot,
      rules: { ...rules, minimumOrders: 6 },
    }).elevatedApps.length,
    0,
  );
  assert.equal(
    buildOverviewSignals({
      orders,
      partnerCards: cards(orders),
      snapshot,
      rules: { ...rules, failureRatePercent: 21 },
    }).elevatedApps.length,
    0,
  );
  assert.equal(
    buildOverviewSignals({
      orders: [],
      partnerCards: cards([]),
      snapshot,
      rules,
    }).elevatedApps.length,
    0,
  );
});

test("execution errors and active deadlines are distinct from lifecycle failures and historical retries", () => {
  const orders = [
    order("past", 1, "pending", {
      order: {
        witness: { chainId: 137, deadline: String((snapshot - 1) / 1000) },
      } as ListOrder["order"],
    }),
    order("at-deadline", 1, "pending", {
      order: {
        witness: { chainId: 137, deadline: String(snapshot / 1000) },
      } as ListOrder["order"],
    }),
    order("missing-deadline", 1, "pending"),
    order("retry", 1, "pending", {
      metadata: {
        status: "pending",
        chunkSummary: { error: 3, lastChunkStatus: "success" },
      } as ListOrder["metadata"],
    }),
    order("latest-error", 1, "pending", {
      metadata: {
        status: "pending",
        chunkSummary: { lastChunkStatus: "ERROR" },
      } as ListOrder["metadata"],
    }),
    order("expired", 1, "expired"),
    order("failed", 1, "failed"),
  ];
  const data = buildOverviewSignals({
    orders,
    partnerCards: cards(orders),
    snapshot,
    rules: DEFAULT_MONITORING_RULES,
  });
  assert.deepEqual(
    data.overdue.map((record) => record.hash),
    ["past", "at-deadline"],
  );
  assert.deepEqual(
    data.latestErrors.map((record) => record.hash),
    ["latest-error"],
  );
  assert.equal(data.activeWithoutDeadline, 3);
  assert.equal(data.networks[0].failed.length, 1);
  assert.equal(data.networks[0].latestErrors.length, 1);
  assert.equal(data.networks[0].orders.length, orders.length);
});

test("traffic expectations are opt-in and compare last reported placement without inventing activity", () => {
  const partnerCards = [
    ...cards([]),
    { partnerId: "none", partnerName: "None", chains: [] },
  ] as PartnerCard[];
  assert.equal(
    buildOverviewSignals({
      orders: [],
      partnerCards,
      snapshot,
      rules: DEFAULT_MONITORING_RULES,
    }).expectedApps.length,
    0,
  );
  const rules = {
    ...DEFAULT_MONITORING_RULES,
    inactivityHours: { quickswap: 24, none: 12 },
  };
  const data = buildOverviewSignals({
    orders: [],
    partnerCards,
    snapshot,
    rules,
    lastOrderByPartner: { quickswap: snapshot - 24 * hour },
  });
  assert.equal(data.expectedApps.length, 2);
  assert.equal(
    data.expectedApps.every((app) => app.idle),
    true,
  );
  assert.equal(
    data.expectedApps.find((app) => app.partnerId === "none")?.lastPlaced,
    undefined,
  );
  assert.equal(
    buildOverviewSignals({
      orders: [],
      partnerCards,
      snapshot,
      rules,
      lastOrderByPartner: { quickswap: snapshot - 23 * hour },
    }).expectedApps.find((app) => app.partnerId === "quickswap")?.idle,
    false,
  );
});

test("last placement uses loaded history beyond the period but respects the selected network and future-data guard", () => {
  const config = {
    137: { dex: { quick: { adapter: "quick-adapter" } } },
    8453: { dex: { quick: { adapter: "quick-adapter" } } },
  } as unknown as SpotConfig;
  const allOrders = [
    order("older", 24 * 10),
    order("base", 1, "completed", {
      order: { witness: { chainId: 8453 } } as ListOrder["order"],
    }),
    order("future", -1),
  ];
  const scoped = buildSpotOverview({
    allOrders,
    config,
    updatedAt: snapshot,
    days: 7,
    chainIds: ["137"],
  });
  assert.equal(scoped.orders.length, 0); // Future placements stay outside reporting totals and trends.
  assert.equal(scoped.lastOrderByPartner.quickswap, snapshot - 24 * 10 * hour);
  const both = buildSpotOverview({
    allOrders,
    config,
    updatedAt: snapshot,
    days: 7,
  });
  assert.equal(both.lastOrderByPartner.quickswap, snapshot - hour);
});

test("monitoring preferences reject bad versions and bound numeric rules without prototype keys", () => {
  assert.deepEqual(parseMonitoringRules("{broken"), DEFAULT_MONITORING_RULES);
  assert.deepEqual(
    parseMonitoringRules(
      JSON.stringify({ version: 2, rules: { failureRatePercent: 1 } }),
    ),
    DEFAULT_MONITORING_RULES,
  );
  const parsed = parseMonitoringRules(
    '{"version":1,"rules":{"failureRatePercent":101,"minimumOrders":1.5,"windowHours":168,"inactivityHours":{"known":12,"negative":-1,"huge":9000,"__proto__":24,"constructor":24}}}',
  );
  assert.equal(parsed.failureRatePercent, 20);
  assert.equal(parsed.minimumOrders, 10);
  assert.equal(parsed.windowHours, 168);
  assert.deepEqual(parsed.inactivityHours, { known: 12 });
  const stored = {
    failureRatePercent: 32.5,
    minimumOrders: 20,
    windowHours: 24,
    inactivityHours: { known: 48 },
  };
  assert.deepEqual(
    parseMonitoringRules(JSON.stringify({ version: 1, rules: stored })),
    stored,
  );
});

test("old unidentified activity expectations survive period filtering without adding inactive table rows", () => {
  const sharedAdapter = "shared-address";
  const quietAdapter = "unknown-quiet";
  const unknownId = `adapter-${sharedAdapter}`;
  const quietId = `adapter-${quietAdapter}`;
  const config = {
    137: { dex: { quick: { adapter: sharedAdapter } } },
  } as unknown as SpotConfig;
  const records = [
    order("known-current", 1, "completed", { exchangeAdapter: sharedAdapter }),
    order("unknown-old", 24 * 8, "completed", {
      exchangeAdapter: sharedAdapter,
      order: { witness: { chainId: 8453 } } as ListOrder["order"],
    }),
    order("unknown-network-missing", 24 * 9, "completed", {
      exchangeAdapter: sharedAdapter,
      order: { witness: {} } as ListOrder["order"],
    }),
    order("unknown-quiet", 24 * 8, "completed", {
      exchangeAdapter: quietAdapter,
    }),
  ];
  const rules = {
    ...DEFAULT_MONITORING_RULES,
    inactivityHours: { [unknownId]: 24, [quietId]: 240, quickswap: 24 },
  };
  const signals = (
    scope: { days?: number; chainIds?: string[]; partnerIds?: string[] } = {},
  ) => {
    const view = buildSpotOverview({
      allOrders: records,
      config,
      updatedAt: snapshot,
      days: 7,
      ...scope,
    });
    return {
      view,
      data: buildOverviewSignals({
        orders: view.orders,
        partnerCards: view.partnerCards,
        lastOrderByPartner: view.lastOrderByPartner,
        activityPartners: view.activityPartners,
        snapshot,
        rules,
      }),
    };
  };
  const recent = signals();
  assert.ok(
    !recent.view.partnerCards.some((card) => card.partnerId === unknownId),
  );
  assert.ok(
    !recent.view.partnerCards.some((card) => card.partnerId === quietId),
  );
  const expected = recent.data.expectedApps.find(
    (app) => app.partnerId === unknownId,
  )!;
  assert.equal(expected.lastPlaced, snapshot - 24 * 8 * hour);
  assert.equal(expected.idle, true);
  assert.deepEqual([...expected.chainIds].sort(), ["0", "8453"]);
  assert.equal(
    recent.data.expectedApps.find((app) => app.partnerId === quietId)!.idle,
    false,
  );
  assert.equal(
    recent.data.expectedApps.find((app) => app.partnerId === "quickswap")!.idle,
    false,
  );
  assert.deepEqual(
    signals({ days: undefined }).data.expectedApps,
    recent.data.expectedApps,
    "periods cannot hide inactivity checks",
  );
  assert.ok(
    !signals({ chainIds: ["137"] }).data.expectedApps.some(
      (app) => app.partnerId === unknownId,
    ),
    "a known adapter on137 does not borrow the unidentified cohort's rule",
  );
  const base = signals({ chainIds: ["8453"] }).data.expectedApps;
  assert.deepEqual(
    base.map((app) => app.partnerId),
    [unknownId],
  );
  assert.deepEqual(base[0].chainIds, ["8453"]);
  const missing = signals({ chainIds: ["0"] }).data.expectedApps;
  assert.deepEqual(
    missing.map((app) => app.partnerId),
    [unknownId],
  );
  assert.equal(missing[0].lastPlaced, snapshot - 24 * 9 * hour);
  assert.deepEqual(
    signals({ partnerIds: ["quick"] }).data.expectedApps.map(
      (app) => app.partnerId,
    ),
    ["quickswap"],
  );
});

test("malformed deadline coverage and out-of-range snapshots remain unavailable", () => {
  const invalid = ["1e308", String(8.64e15 / 1000 + 1), "", "-1", "NaN"].map(
    (deadline, index) =>
      order(`bad-${index}`, 1, "pending", {
        order: { witness: { chainId: 137, deadline } } as ListOrder["order"],
      }),
  );
  invalid.push(
    order("missing-witness", 1, "pending", { order: {} } as Partial<ListOrder>),
  );
  const result = buildOverviewSignals({
    orders: invalid,
    partnerCards: [],
    snapshot,
    rules: DEFAULT_MONITORING_RULES,
  });
  assert.equal(result.activeWithoutDeadline, invalid.length);
  assert.deepEqual(result.overdue, []);
  for (const time of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    8.64e15 + 1,
    1e20,
  ]) {
    assert.deepEqual(buildRecentActivity(invalid, time, 24), {
      buckets: [],
      orders: [],
      excludedTimestamps: invalid.length,
    });
  }
  assert.equal(buildRecentActivity([], 8.64e15, 24).buckets.length, 24);
});

test("oversized stored monitoring rules are rejected before parsing", () => {
  const raw = JSON.stringify({
    version: 1,
    rules: { ...DEFAULT_MONITORING_RULES, failureRatePercent: 99 },
    padding: "x".repeat(100_000),
  });
  assert.deepEqual(parseMonitoringRules(raw), DEFAULT_MONITORING_RULES);
});
