import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListOrder, SpotConfig } from "../packages/domain/src/twap/types";
import {
  getOrderValueUsd,
  groupOverviewOrders,
  type OverviewOrderStatus,
  type PartnerCard,
} from "../packages/domain/src/twap/utils/orders-overview";
import { buildSpotOverview } from "../apps/ops/src/lib/overview-data";
import {
  buildTradingAppRows,
  sortTradingAppRows,
  tradingAppOrdersHref,
  tradingAppPartnerHref,
  parseTradingAppColumns,
  type TradingAppRow,
} from "../apps/ops/src/lib/trading-apps-table";
import { resolvePartnerId } from "../apps/ops/src/lib/partner-navigation";

const updatedAt = Date.parse("2026-10-21T12:00:00Z");
const statuses: OverviewOrderStatus[] = [
  "completed",
  "partial",
  "active",
  "cancelled",
  "expired",
  "failed",
  "unknown",
];
const rawStatus: Record<OverviewOrderStatus, string> = {
  completed: "completed",
  partial: "partially_completed",
  active: "pending",
  cancelled: "cancelled",
  expired: "expired",
  failed: "failed",
  unknown: "new-service-state",
};
function order(
  hash: string,
  status: OverviewOrderStatus = "completed",
  overrides: Partial<ListOrder> = {},
): ListOrder {
  return {
    hash,
    exchangeAdapter: "quick-current",
    inputToken: "0xinput",
    outputToken: "0xoutput",
    totalUSDAmount: "10",
    timestamp: "2026-10-21T10:00:00Z",
    metadata: { status: rawStatus[status], displayOnlyStatus: "" },
    order: { witness: { chainId: 137 } },
    ...overrides,
  } as ListOrder;
}
function card(
  partnerId: string,
  partnerName: string,
  orders: ListOrder[],
): PartnerCard {
  return {
    partnerId,
    partnerName,
    chains: [
      { chainId: 137, chainName: "Polygon", orders, stats: {}, topPairs: [] },
    ],
  } as PartnerCard;
}
const ids = (rows: TradingAppRow[]) => rows.map((row) => row.partnerId);

function assertReconciles(view: ReturnType<typeof buildSpotOverview>) {
  const rows = buildTradingAppRows(view.partnerCards);
  const assigned = rows.flatMap((row) => row.orders);
  assert.equal(assigned.length, view.orders.length);
  for (const record of view.orders)
    assert.equal(
      assigned.filter((candidate) => candidate === record).length,
      1,
      record.hash,
    );
  assert.equal(
    rows.reduce((sum, row) => sum + row.totalOrders, 0),
    view.orders.length,
  );
  const totalUsd = view.orders.reduce(
    (sum, record) => sum + getOrderValueUsd(record),
    0,
  );
  assert.ok(
    Math.abs(rows.reduce((sum, row) => sum + row.totalUsd, 0) - totalUsd) <
      1e-9,
  );
  const globalGroups = groupOverviewOrders(view.orders);
  for (const status of statuses)
    assert.equal(
      rows.reduce((sum, row) => sum + row.groups[status].length, 0),
      globalGroups[status].length,
      status,
    );
  for (const row of rows) {
    assert.equal(
      Object.values(row.groups).flat().length,
      row.totalOrders,
      row.partnerId,
    );
    assert.equal(row.totalOrders, row.orders.length);
    assert.equal(
      row.totalUsd,
      row.orders.reduce((sum, record) => sum + getOrderValueUsd(record), 0),
    );
    assert.equal(
      row.failedRate,
      row.totalOrders ? row.groups.failed.length / row.totalOrders : undefined,
    );
  }
  return rows;
}

test("table metrics use the exact cohort even when precomputed chain statistics disagree", () => {
  const orders = [
    ...Array.from({ length: 168 }, (_, index) => order(`completed-${index}`)),
    ...Array.from({ length: 2 }, (_, index) =>
      order(`partial-${index}`, "partial"),
    ),
    ...Array.from({ length: 7 }, (_, index) =>
      order(`failed-${index}`, "failed"),
    ),
  ];
  const view = buildSpotOverview({
    allOrders: orders,
    config: {
      137: { dex: { quick: { adapter: "quick-current" } } },
    } as unknown as SpotConfig,
    updatedAt,
    partnerIds: ["quick"],
  });
  // Deliberately inconsistent cached statistics must not leak into the table.
  Object.assign(view.partnerCards[0].chains[0].stats, {
    totalOrders: 177,
    filledOrders: 177,
    partiallyFilledOrders: 2,
    errorOrders: 7,
    totalUsd: 999_999,
  });
  const [row] = assertReconciles(view);
  assert.equal(row.totalOrders, 177);
  assert.equal(row.groups.completed.length, 168);
  assert.equal(row.groups.partial.length, 2);
  assert.equal(row.groups.failed.length, 7);
  assert.equal(row.totalUsd, 1770);
  assert.equal(row.pricedOrders, 177);
  assert.equal(row.failedRate, 7 / 177);
});

test("all row outcomes and totals reconcile across aliases, historical adapters, reused addresses, ambiguous apps and missing networks", () => {
  const config = {
    137: {
      dex: {
        quick: { adapter: "quick-current" },
        spooky: { adapter: "spooky-current" },
        customZero: { adapter: "zero-current" },
        firstAmbiguous: { adapter: "ambiguous" },
        secondAmbiguous: { adapter: "ambiguous" },
      },
      partnerAdapters: [
        {
          partnerId: "quickswap",
          partnerName: "Quickswap",
          adapter: "quick-current",
        },
        {
          partnerId: "quick",
          partnerName: "Quick alias",
          adapter: "quick-historical",
        },
        {
          partnerId: "quickswap",
          partnerName: "Quickswap",
          adapter: "QUICK-HISTORICAL",
        },
        {
          partnerId: "quick",
          partnerName: "Quick alias",
          adapter: "shared-cross-network",
        },
      ],
    },
    42161: { dex: { ramses: { adapter: "shared-cross-network" } } },
    1: { dex: { quickswap: { adapter: "ethereum-quick" } } },
  } as unknown as SpotConfig;
  const records = [
    order("completed"),
    order("cancelled-over-failed", "failed", {
      metadata: {
        status: "failed",
        displayOnlyStatus: "CANCELLED",
      } as ListOrder["metadata"],
    }),
    order("historical-partial", "partial", {
      exchangeAdapter: "QUICK-HISTORICAL",
      totalUSDAmount: "0",
    }),
    order("active-retry", "active", {
      exchangeAdapter: "spooky-current",
      metadata: {
        status: "pending",
        displayOnlyStatus: "ERROR",
        chunkSummary: { error: 3 },
      } as ListOrder["metadata"],
    }),
    order("polygon-shared-failed", "failed", {
      exchangeAdapter: "shared-cross-network",
      totalUSDAmount: "3.5",
    }),
    order("arbitrum-shared-completed", "completed", {
      exchangeAdapter: "shared-cross-network",
      order: { witness: { chainId: 42161 } } as ListOrder["order"],
      metadata: {
        status: "completed",
        chunkSummary: { error: 2 },
      } as ListOrder["metadata"],
    }),
    order("network-missing-expired", "expired", {
      exchangeAdapter: "shared-cross-network",
      order: { witness: {} } as ListOrder["order"],
      totalUSDAmount: "NaN",
    }),
    order("ambiguous-unknown", "unknown", {
      exchangeAdapter: "ambiguous",
      totalUSDAmount: "-1",
    }),
    order("adapter-missing", "completed", {
      exchangeAdapter: undefined as unknown as string,
      totalUSDAmount: "",
    }),
    order("ethereum-active", "active", {
      exchangeAdapter: "ethereum-quick",
      order: { witness: { chainId: 1 } } as ListOrder["order"],
    }),
    order("old-completed", "completed", { timestamp: "2026-08-01T10:00:00Z" }),
  ];
  const full = buildSpotOverview({ allOrders: records, config, updatedAt });
  const rows = assertReconciles(full);
  assert.equal(rows.filter((row) => row.partnerId === "quickswap").length, 1);
  assert.ok(!rows.some((row) => row.partnerId === "quick"));
  assert.deepEqual(
    rows
      .find((row) => row.partnerId === "ramses")!
      .orders.map((record) => record.hash),
    ["arbitrum-shared-completed"],
  );
  assert.deepEqual(
    rows
      .find((row) => row.partnerId === "adapter-shared-cross-network")!
      .orders.map((record) => record.hash),
    ["network-missing-expired"],
  );
  assert.equal(
    rows.find((row) => row.partnerId === "adapter-ambiguous")!.groups.unknown
      .length,
    1,
  );
  assert.equal(
    rows.find((row) => row.partnerId === "adapter-")!.totalOrders,
    1,
  );
  assert.equal(
    rows.find((row) => row.partnerId === "customZero")!.totalOrders,
    0,
  );
  assert.equal(
    rows.find((row) => row.partnerId === "customZero")!.failedRate,
    undefined,
  );
  assert.equal(
    rows.find((row) => row.partnerId === "spookyswap")!.groups.failed.length,
    0,
    "failed attempts do not turn active orders into terminal failures",
  );
  assert.equal(
    rows.find((row) => row.partnerId === "ramses")!.groups.failed.length,
    0,
    "recovered failures remain completed",
  );
  for (const scope of [
    { days: 7 },
    { chainIds: ["137"] },
    { chainIds: ["42161"] },
    { chainIds: ["0"] },
    { partnerIds: ["quick"] },
    { partnerIds: ["spooky"], days: 7 },
    { partnerIds: ["adapter-shared-cross-network"], chainIds: ["137"] },
    { partnerIds: ["quickswap"], chainIds: ["137", "1"], days: 7 },
    { partnerIds: ["customZero"], days: 7 },
  ]) {
    assertReconciles(
      buildSpotOverview({ allOrders: records, config, updatedAt, ...scope }),
    );
  }
  assertReconciles(
    buildSpotOverview({ allOrders: records, config: null, updatedAt }),
  );
});

test("unidentified app links retain observed networks instead of resolving another app that reuses the address", () => {
  const adapter = "shared-adapter";
  const config = {
    137: { dex: { quick: { adapter } } },
  } as unknown as SpotConfig;
  const view = buildSpotOverview({
    allOrders: [
      order("registered", "completed", { exchangeAdapter: adapter }),
      order("wrong-network", "failed", {
        exchangeAdapter: adapter,
        order: { witness: { chainId: 8453 } } as ListOrder["order"],
      }),
      order("missing-network", "expired", {
        exchangeAdapter: adapter,
        order: { witness: {} } as ListOrder["order"],
      }),
    ],
    config,
    updatedAt,
  });
  const rows = buildTradingAppRows(view.partnerCards);
  const unknown = rows.find((row) => row.partnerId === `adapter-${adapter}`)!;
  assert.equal(
    resolvePartnerId(unknown.partnerId, config),
    "quickswap",
    "a link without network context would resolve the unrelated registered app",
  );
  const target = new URL(
    tradingAppPartnerHref(unknown, "period=30"),
    "https://ops.example",
  );
  assert.equal(target.pathname, `/partners/adapter-${adapter}`);
  assert.equal(target.searchParams.get("period"), "30");
  assert.deepEqual(target.searchParams.getAll("chain_id").sort(), [
    "0",
    "8453",
  ]);
  assert.equal(
    resolvePartnerId(
      unknown.partnerId,
      config,
      target.searchParams.getAll("chain_id"),
    ),
    unknown.partnerId,
  );
  const known = rows.find((row) => row.partnerId === "quickswap")!;
  assert.deepEqual(
    new URL(
      tradingAppPartnerHref(known, "period=30"),
      "https://ops.example",
    ).searchParams.getAll("chain_id"),
    [],
    "known app links retain the original all-network scope",
  );
  assert.deepEqual(
    new URL(
      tradingAppPartnerHref(known, "period=30&chain_id=137"),
      "https://ops.example",
    ).searchParams.getAll("chain_id"),
    ["137"],
  );
});

test("reported USD coverage includes zero but excludes missing or invalid values", () => {
  const records = [
    "0",
    "2.5",
    "",
    " ",
    "NaN",
    "Infinity",
    "-1",
    undefined,
    null,
  ].map((totalUSDAmount, index) =>
    order(String(index), "failed", {
      totalUSDAmount: totalUSDAmount as string,
    }),
  );
  const [row] = buildTradingAppRows([card("app", "App", records)]);
  assert.equal(row.totalOrders, 9);
  assert.equal(row.totalUsd, 2.5);
  assert.equal(row.pricedOrders, 2);
  assert.equal(row.failedRate, 1);
  const [empty] = buildTradingAppRows([card("empty", "Empty", [])]);
  assert.equal(empty.totalOrders, 0);
  assert.equal(empty.totalUsd, 0);
  assert.equal(empty.pricedOrders, 0);
  assert.equal(empty.failedRate, undefined);
});

test("all outcome columns and order totals sort numerically in both directions", () => {
  for (const status of statuses) {
    const rows = buildTradingAppRows([
      card(
        "small",
        "Small",
        Array.from({ length: 2 }, (_, index) =>
          order(`small-${index}`, status),
        ),
      ),
      card(
        "large",
        "Large",
        Array.from({ length: 10 }, (_, index) =>
          order(`large-${index}`, status),
        ),
      ),
    ]);
    for (const key of [status, "totalOrders"] as const) {
      assert.deepEqual(ids(sortTradingAppRows(rows, key, "desc")), [
        "large",
        "small",
      ]);
      assert.deepEqual(ids(sortTradingAppRows(rows, key, "asc")), [
        "small",
        "large",
      ]);
    }
  }
  const usdRows = buildTradingAppRows([
    card("two", "Two", [order("two", "completed", { totalUSDAmount: "2" })]),
    card("ten", "Ten", [order("ten", "completed", { totalUSDAmount: "10" })]),
  ]);
  assert.deepEqual(ids(sortTradingAppRows(usdRows, "totalUsd", "desc")), [
    "ten",
    "two",
  ]);
  assert.deepEqual(ids(sortTradingAppRows(usdRows, "totalUsd", "asc")), [
    "two",
    "ten",
  ]);
});

test("USD sorting puts unavailable values last while preserving reported and no-activity zero values", () => {
  const rows = buildTradingAppRows([
    card("missing", "Missing", [
      order("missing", "completed", { totalUSDAmount: "" }),
    ]),
    card("zero", "Zero", [order("zero", "completed", { totalUSDAmount: "0" })]),
    card("positive", "Positive", [
      order("positive", "completed", { totalUSDAmount: "10" }),
    ]),
    card("empty", "Empty", []),
  ]);
  assert.deepEqual(ids(sortTradingAppRows(rows, "totalUsd", "asc")), [
    "empty",
    "zero",
    "positive",
    "missing",
  ]);
  assert.deepEqual(ids(sortTradingAppRows(rows, "totalUsd", "desc")), [
    "positive",
    "empty",
    "zero",
    "missing",
  ]);
});

test("failure-rate sorting uses the ratio and puts no-activity apps last in either direction", () => {
  const rows = buildTradingAppRows([
    card("empty-z", "Zulu", []),
    card(
      "low",
      "Low",
      Array.from({ length: 20 }, (_, index) =>
        order(`low-${index}`, index < 2 ? "failed" : "completed"),
      ),
    ),
    card("high", "High", [
      order("high-failed", "failed"),
      order("high-complete"),
    ]),
    card("empty-a", "Alpha", []),
    card("zero", "Zero", [order("zero")]),
  ]);
  assert.deepEqual(ids(sortTradingAppRows(rows, "failedRate", "desc")), [
    "high",
    "low",
    "zero",
    "empty-a",
    "empty-z",
  ]);
  assert.deepEqual(ids(sortTradingAppRows(rows, "failedRate", "asc")), [
    "zero",
    "low",
    "high",
    "empty-a",
    "empty-z",
  ]);
});

test("ties are deterministic by app name then ID and building/sorting leave inputs intact", () => {
  const cards = [
    card("z", "Zulu", [order("z")]),
    card("b", "Alpha", [order("b")]),
    card("a", "Alpha", [order("a")]),
  ];
  const before = structuredClone(cards);
  for (const value of cards) Object.freeze(value.chains[0].orders);
  Object.freeze(cards);
  const rows = buildTradingAppRows(cards);
  const beforeRows = [...rows];
  for (const direction of ["asc", "desc"] as const) {
    assert.deepEqual(ids(sortTradingAppRows(rows, "totalOrders", direction)), [
      "a",
      "b",
      "z",
    ]);
    assert.deepEqual(
      ids(sortTradingAppRows([...rows].reverse(), "totalUsd", direction)),
      ["a", "b", "z"],
    );
  }
  assert.deepEqual(ids(sortTradingAppRows(rows, "partnerName", "asc")), [
    "a",
    "b",
    "z",
  ]);
  assert.deepEqual(ids(sortTradingAppRows(rows, "partnerName", "desc")), [
    "z",
    "a",
    "b",
  ]);
  assert.deepEqual(cards, before);
  assert.deepEqual(rows, beforeRows);
  assert.equal(
    rows[0].chains,
    cards[0].chains,
    "network metadata remains available for rendering",
  );
});

test("attention sorting prioritizes active deadlines and current attempt errors before failed count", () => {
  const active = (
    hash: string,
    deadline?: number,
    latest = "success",
    historicalErrors = 0,
  ) =>
    order(hash, "active", {
      order: { witness: { chainId: 137, deadline } } as ListOrder["order"],
      metadata: {
        status: "pending",
        chunkSummary: { lastChunkStatus: latest, error: historicalErrors },
      } as ListOrder["metadata"],
    });
  const rows = buildTradingAppRows(
    [
      card(
        "volume",
        "Volume",
        Array.from({ length: 50 }, (_, i) => order(`v-${i}`)),
      ),
      card("small", "Small", [order("one-failed", "failed")]),
      card(
        "failed",
        "Failed",
        Array.from({ length: 9 }, (_, i) => order(`f-${i}`, "failed")),
      ),
      card("recovered", "Recovered", [
        active("recovered", undefined, "success", 5),
      ]),
      card("current", "Current", [active("current", undefined, "error", 1)]),
      card("overdue", "Overdue", [
        active("past", updatedAt / 1000),
        active("future", updatedAt / 1000 + 1),
        active("missing"),
        order("terminal-past", "completed", {
          order: {
            witness: { chainId: 137, deadline: updatedAt / 1000 - 1 },
          } as ListOrder["order"],
        }),
      ]),
    ],
    updatedAt,
  );
  const overdue = rows.find((row) => row.partnerId === "overdue")!;
  assert.equal(overdue.activePastDeadline, 1);
  assert.equal(overdue.activeLatestErrors, 0);
  assert.equal(
    rows.find((row) => row.partnerId === "recovered")!.activeLatestErrors,
    0,
  );
  assert.equal(
    rows.find((row) => row.partnerId === "current")!.activeLatestErrors,
    1,
  );
  assert.deepEqual(ids(sortTradingAppRows(rows)), [
    "overdue",
    "current",
    "failed",
    "small",
    "volume",
    "recovered",
  ]);
});

test("recent placement sorting ignores invalid timestamps and keeps missing placements last", () => {
  const rows = buildTradingAppRows(
    [
      card("old", "Old", [
        order("old", "completed", { timestamp: "2026-10-20T10:00:00Z" }),
      ]),
      card("missing", "Missing", [
        order("invalid", "completed", { timestamp: "invalid" }),
      ]),
      card("recent", "Recent", [
        order("recent"),
        order("older", "completed", { timestamp: "2026-10-01T10:00:00Z" }),
      ]),
    ],
    updatedAt,
  );
  assert.equal(rows[2].lastPlaced, Date.parse("2026-10-21T10:00:00Z"));
  assert.deepEqual(ids(sortTradingAppRows(rows, "lastPlaced", "desc")), [
    "recent",
    "old",
    "missing",
  ]);
  assert.deepEqual(ids(sortTradingAppRows(rows, "lastPlaced", "asc")), [
    "old",
    "recent",
    "missing",
  ]);
});

test("count links preserve global scope and replace every hidden investigation facet", () => {
  const [row] = buildTradingAppRows(
    [card("quick", "Quick", [order("one")])],
    updatedAt,
  );
  const query =
    "period=30&chain_id=137&partner_id=wrong&order_status=completed&order_errors=none&order_deadline=soon&order_active_age=24h&order_search=hidden&min_usd=999&order_source=v1&order_adapter=wrong&order_raw=1&order_type=limit";
  const failed = new URL(
    tradingAppOrdersHref(row, query, { status: "failed" }),
    "https://ops.example",
  );
  assert.equal(failed.pathname, "/orders");
  assert.deepEqual(
    [...failed.searchParams],
    [
      ["period", "30"],
      ["chain_id", "137"],
      ["partner_id", "quickswap"],
      ["order_status", "failed"],
    ],
  );
  const all = new URL(tradingAppOrdersHref(row, query), "https://ops.example");
  assert.equal(all.searchParams.get("order_status"), null);
  const past = new URL(
    tradingAppOrdersHref(row, query, { deadline: "past" }),
    "https://ops.example",
  );
  assert.equal(past.searchParams.get("order_status"), "active");
  assert.equal(past.searchParams.get("order_deadline"), "past");
  assert.equal(past.searchParams.get("order_errors"), null);
  const errors = new URL(
    tradingAppOrdersHref(row, query, { errors: "latest" }),
    "https://ops.example",
  );
  assert.equal(errors.searchParams.get("order_status"), "active");
  assert.equal(errors.searchParams.get("order_errors"), "latest");
  const chain = new URL(
    tradingAppOrdersHref(row, query, { chainId: 42161 }),
    "https://ops.example",
  );
  assert.deepEqual(chain.searchParams.getAll("chain_id"), ["42161"]);
});

test("unknown adapter count links retain observed chains and columns preferences reject unknown values", () => {
  const row = {
    partnerId: "adapter-shared",
    chains: [{ chainId: 0 }, { chainId: 8453 }],
  } as TradingAppRow;
  const link = new URL(
    tradingAppOrdersHref(row, "period=7&chain_id=137", { status: "failed" }),
    "https://ops.example",
  );
  assert.deepEqual(link.searchParams.getAll("chain_id"), ["0", "8453"]);
  assert.equal(link.searchParams.get("partner_id"), "adapter-shared");
  assert.equal(parseTradingAppColumns("detailed"), "detailed");
  assert.equal(parseTradingAppColumns("compact"), "compact");
  assert.equal(parseTradingAppColumns("unknown"), "compact");
  assert.equal(parseTradingAppColumns(null), "compact");
});

test("network rows reconcile exactly with app totals and include inactive networks only when requested", () => {
  const polygon = statuses.map((status, index) =>
    order(`polygon-${status}`, status, { totalUSDAmount: String(index) }),
  );
  const base = [
    order("base-active", "active", {
      totalUSDAmount: "12.5",
      timestamp: "2026-10-21T11:00:00Z",
      order: {
        witness: { chainId: 8453, deadline: updatedAt / 1000 - 1 },
      } as ListOrder["order"],
      metadata: {
        status: "pending",
        chunkSummary: { lastChunkStatus: "error", error: 1 },
      } as ListOrder["metadata"],
    }),
    order("base-unpriced", "failed", { totalUSDAmount: "" }),
  ];
  const app = card("app", "App", polygon);
  app.chains.push(
    { ...app.chains[0], chainId: 8453, chainName: "Base", orders: base },
    { ...app.chains[0], chainId: 1, chainName: "Ethereum", orders: [] },
  );
  const cards = [app, card("empty", "Empty", [])];
  const original = structuredClone(cards);
  const apps = buildTradingAppRows(cards, updatedAt);
  const networks = buildTradingAppRows(cards, updatedAt, "networks");
  assert.equal(apps.length, 2, "app mode keeps existing no-activity rows");
  assert.equal(networks.length, 2);
  assert.deepEqual(
    networks.map((row) => row.chainId),
    [137, 8453],
  );
  assert.deepEqual(
    networks.map((row) => row.chainName),
    ["Polygon", "Base"],
  );
  assert.equal(new Set(networks.map((row) => row.rowId)).size, 2);
  assert.ok(apps.every((row) => row.chainId === undefined));
  for (const metric of [
    "totalOrders",
    "totalUsd",
    "pricedOrders",
    "activePastDeadline",
    "activeLatestErrors",
  ] as const) {
    assert.equal(
      networks.reduce((sum, row) => sum + row[metric], 0),
      apps[0][metric],
      metric,
    );
  }
  for (const status of statuses)
    assert.equal(
      networks.reduce((sum, row) => sum + row.groups[status].length, 0),
      apps[0].groups[status].length,
      status,
    );
  assert.equal(networks[1].failedRate, 1 / 2);
  assert.equal(networks[1].lastPlaced, Date.parse("2026-10-21T11:00:00Z"));
  assert.deepEqual(
    networks.flatMap((row) => row.orders),
    apps[0].orders,
  );
  const withInactive = buildTradingAppRows(cards, updatedAt, "networks", true);
  assert.equal(withInactive.length, 4);
  assert.deepEqual(
    withInactive
      .filter((row) => row.totalOrders === 0)
      .map((row) => row.chainName),
    ["Ethereum", "Polygon"],
  );
  assert.equal(new Set(withInactive.map((row) => row.rowId)).size, 4);
  assert.deepEqual(cards, original);
});

test("network drilldowns replace global network selections and hidden facets, including the missing-network bucket", () => {
  const app = card("quick", "Quick", [order("one")]);
  app.chains[0] = {
    ...app.chains[0],
    chainId: 0,
    chainName: "Network not provided",
  };
  const [row] = buildTradingAppRows([app], updatedAt, "networks");
  const query =
    "period=30&chain_id=137&chain_id=8453&partner_id=other&order_status=completed&order_source=v1&order_errors=none&order_search=hidden&overview_group=networks&overview_display=charts";
  const orders = new URL(
    tradingAppOrdersHref(row, query, { status: "failed" }),
    "https://ops.example",
  );
  assert.equal(orders.pathname, "/orders");
  assert.deepEqual(
    [...orders.searchParams],
    [
      ["period", "30"],
      ["chain_id", "0"],
      ["partner_id", "quickswap"],
      ["order_status", "failed"],
    ],
  );
  const partner = new URL(
    tradingAppPartnerHref(row, query),
    "https://ops.example",
  );
  assert.equal(partner.pathname, "/partners/quickswap");
  assert.deepEqual(
    [...partner.searchParams],
    [
      ["period", "30"],
      ["chain_id", "0"],
    ],
  );
  for (const href of [
    tradingAppOrdersHref(row, query, { chainId: 42161 }),
    tradingAppPartnerHref(row, query, 42161),
  ])
    assert.deepEqual(
      new URL(href, "https://ops.example").searchParams.getAll("chain_id"),
      ["42161"],
    );
  const unknown = { ...row, partnerId: "adapter-shared" };
  assert.deepEqual(
    new URL(
      tradingAppPartnerHref(unknown, query),
      "https://ops.example",
    ).searchParams.getAll("chain_id"),
    ["0"],
  );
});

test("network sorting remains deterministic when names and metrics match", () => {
  const app = card("app", "App", [order("polygon")]);
  app.chains.push(
    {
      ...app.chains[0],
      chainId: 8453,
      chainName: "Base",
      orders: [order("base")],
    },
    {
      ...app.chains[0],
      chainId: 100,
      chainName: "Base",
      orders: [order("base-other")],
    },
  );
  const rows = buildTradingAppRows([app], updatedAt, "networks");
  const original = rows.map((row) => row.rowId);
  for (const key of ["totalOrders", "partnerName", "needsAttention"] as const)
    for (const direction of ["asc", "desc"] as const)
      assert.deepEqual(
        sortTradingAppRows(rows, key, direction).map((row) => row.chainId),
        [100, 8453, 137],
      );
  assert.deepEqual(
    sortTradingAppRows([...rows].reverse(), "chainName", "desc").map(
      (row) => row.chainId,
    ),
    [137, 100, 8453],
  );
  assert.deepEqual(
    rows.map((row) => row.rowId),
    original,
  );
});
