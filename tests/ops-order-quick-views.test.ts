import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListOrder } from "../packages/domain/src/twap/types";
import {
  DEFAULT_INVESTIGATION_FILTERS,
  investigateOrders,
  orderDetailHref,
  ordersScopeHref,
  type InvestigationFilters,
} from "../apps/ops/src/lib/order-investigation";
import {
  buildOrderFacets,
  matchingOrderQuickView,
  ORDER_QUICK_VIEWS,
  orderHashSearchHref,
  orderQuickViewFilters,
} from "../apps/ops/src/lib/order-quick-views";
import {
  investigationFilterQuery,
  readInvestigationFilters,
} from "../apps/ops/src/lib/investigation-filter-query";

const snapshot = Date.parse("2026-10-22T12:00:00Z");
const day = 86_400_000;
const adapter = `0x${"a".repeat(40)}`;
const token = `0x${"b".repeat(40)}`;
const statusOrder = (
  hash: string,
  status = "pending",
  overrides: Partial<ListOrder> = {},
): ListOrder =>
  ({
    hash,
    source: "v2",
    exchangeAdapter: adapter,
    inputToken: token,
    outputToken: `0x${"c".repeat(40)}`,
    timestamp: new Date(snapshot - day).toISOString(),
    totalUSDAmount: "150",
    order: { witness: { chainId: 137 } },
    metadata: {
      status,
      orderType: "Limit",
      chunkSummary: { error: 1, lastChunkStatus: "success" },
    },
    ...overrides,
  }) as ListOrder;
const filters = (patch: Partial<InvestigationFilters> = {}) => ({
  ...DEFAULT_INVESTIGATION_FILTERS,
  ...patch,
});

test("status and error facets ignore only their own selection, retaining every other list facet", () => {
  const statuses = [
    "completed",
    "partially_completed",
    "pending",
    "failed",
    "cancelled",
    "expired",
    "future-state",
  ];
  const included = statuses.map((status) => statusOrder(status, status));
  const latest = statusOrder("latest", "eligible", {
    metadata: {
      status: "eligible",
      orderType: "Limit",
      chunkSummary: { error: 0, lastChunkStatus: "ERROR" },
    } as ListOrder["metadata"],
  });
  included.push(latest);
  const excluded = [
    statusOrder("other-adapter", "failed", { exchangeAdapter: "other" }),
    statusOrder("other-token", "failed", { inputToken: "other" }),
    statusOrder("other-source", "failed", { source: "v1" }),
    statusOrder("below-range", "failed", { totalUSDAmount: "99" }),
    statusOrder("above-range", "failed", { totalUSDAmount: "201" }),
    statusOrder("other-type", "failed", {
      metadata: {
        status: "failed",
        orderType: "Market",
        chunkSummary: { error: 2 },
      } as ListOrder["metadata"],
    }),
    statusOrder("other-label", "failed"),
  ];
  const all = [...included, ...excluded];
  const labels = new Map(
    all.map((order) => [
      order,
      order.hash === "other-label" ? "Beta app" : "Alpha app",
    ]),
  );
  const selection = filters({
    query: "Alpha",
    adapter,
    token,
    source: "v2",
    type: "Limit",
    minUsd: "100",
    maxUsd: "200",
    status: "failed",
    errors: "any",
  });
  const facets = buildOrderFacets(all, selection, labels, snapshot);
  assert.deepEqual(facets, {
    counts: {
      completed: 1,
      partial: 1,
      active: 2,
      failed: 1,
      cancelled: 1,
      expired: 1,
      unknown: 1,
    },
    all: 8,
    activeErroring: 1,
    withErrors: 1,
  });
  assert.equal(
    Object.values(facets.counts).reduce((sum, count) => sum + count, 0),
    facets.all,
  );

  const onlyLatest = buildOrderFacets(
    all,
    { ...selection, errors: "latest" },
    labels,
    snapshot,
  );
  assert.equal(
    onlyLatest.all,
    1,
    "status facets retain the selected latest-error constraint",
  );
  assert.equal(onlyLatest.counts.active, 1);
  assert.equal(
    onlyLatest.withErrors,
    1,
    "error facet removes latest-error selection but retains failed lifecycle status",
  );
});

test("facet age constraints survive facet changes and empty cohorts report actual zero counts", () => {
  const oldErroring = statusOrder("old-erroring", "pending", {
    metadata: {
      status: "pending",
      chunkSummary: { error: 1, lastChunkStatus: "failed" },
    } as ListOrder["metadata"],
  });
  const recent = statusOrder("recent", "pending", {
    timestamp: new Date(snapshot - 1000).toISOString(),
  });
  const oldFailed = statusOrder("old-failed", "failed");
  const facets = buildOrderFacets(
    [recent, oldFailed, oldErroring],
    filters({ status: "failed", errors: "any", activeAge: "24h" }),
    new Map(),
    snapshot,
  );
  assert.equal(facets.all, 1);
  assert.equal(facets.counts.active, 1);
  assert.equal(facets.counts.failed, 0);
  assert.equal(facets.activeErroring, 1);
  assert.equal(
    facets.withErrors,
    0,
    "the error facet retains incompatible status and age selections",
  );
  for (const orders of [[], [recent]]) {
    const empty = buildOrderFacets(
      orders,
      filters({ activeAge: "24h" }),
      new Map(),
      snapshot,
    );
    assert.equal(empty.all, 0);
    assert.equal(empty.withErrors, 0);
    assert.equal(empty.activeErroring, 0);
    assert.ok(Object.values(empty.counts).every((count) => count === 0));
  }
});

test("active erroring requires a latest unsuccessful attempt, independently of historical counts or error wording", () => {
  const historic = statusOrder("historic", "pending", {
    metadata: {
      status: "pending",
      displayOnlyStatus: "FAILED",
      chunkSummary: { error: 4, lastChunkStatus: "success" },
    } as ListOrder["metadata"],
  });
  const wording = statusOrder("wording", "pending", {
    metadata: {
      status: "pending",
      description: "Failed to meet the limit price",
      chunkSummary: { error: 0, lastChunkStatus: "waiting" },
    } as ListOrder["metadata"],
  });
  const latest = statusOrder("latest", "pending", {
    metadata: {
      status: "pending",
      chunkSummary: { error: 0, lastChunkStatus: "FAILED" },
    } as ListOrder["metadata"],
  });
  const terminal = statusOrder("terminal", "failed", {
    metadata: {
      status: "failed",
      chunkSummary: { lastChunkStatus: "error" },
    } as ListOrder["metadata"],
  });
  const facets = buildOrderFacets(
    [historic, wording, latest, terminal],
    filters(),
    new Map(),
    snapshot,
  );
  assert.equal(facets.counts.active, 3);
  assert.equal(facets.counts.failed, 1);
  assert.equal(facets.activeErroring, 1);
  assert.equal(facets.withErrors, 3);
});

test("24h active age uses the supplied snapshot and excludes recent, future, invalid and terminal placements", () => {
  const at = (time: number) => new Date(time).toISOString();
  const boundary = statusOrder("boundary", "pending", {
    timestamp: at(snapshot - day),
  });
  const older = statusOrder("older", "eligible", {
    timestamp: at(snapshot - day - 1),
  });
  const excluded = [
    statusOrder("recent", "pending", { timestamp: at(snapshot - day + 1) }),
    statusOrder("future", "pending", { timestamp: at(snapshot + 1) }),
    statusOrder("invalid", "pending", { timestamp: "invalid" }),
    statusOrder("missing", "pending", {
      timestamp: undefined as unknown as string,
    }),
    statusOrder("epoch", "pending", { timestamp: at(0) }),
    statusOrder("terminal", "completed", { timestamp: at(snapshot - day - 1) }),
  ];
  const selection = orderQuickViewFilters("aged");
  const all = [boundary, ...excluded, older];
  assert.deepEqual(investigateOrders(all, selection, undefined, snapshot), [
    older,
    boundary,
  ]);
  assert.deepEqual(investigateOrders(all, selection, undefined, snapshot - 1), [
    older,
  ]);
  for (const invalidSnapshot of [NaN, Infinity])
    assert.deepEqual(
      investigateOrders(all, selection, undefined, invalidSnapshot),
      [],
    );
});

test("ascending and descending error sorts retain true zero and put unreported values last", () => {
  const count = (hash: string, error: unknown, timestamp: string) =>
    statusOrder(hash, "pending", {
      timestamp,
      metadata: {
        status: "pending",
        chunkSummary: { error },
      } as ListOrder["metadata"],
    });
  const zero = count("zero", 0, "2026-10-20T12:00:00Z");
  const one = count("one", "1", "2026-10-21T12:00:00Z");
  const many = count("many", 5, "2026-10-20T12:00:00Z");
  const missing = count("missing", undefined, "2026-10-22T12:00:00Z");
  const malformed = count("malformed", "NaN", "invalid");
  const negative = count("negative", -1, "invalid");
  const rows = [missing, malformed, many, zero, negative, one];
  const original = [...rows];
  assert.deepEqual(investigateOrders(rows, filters({ sort: "errors-asc" })), [
    zero,
    one,
    many,
    missing,
    malformed,
    negative,
  ]);
  assert.deepEqual(investigateOrders(rows, filters({ sort: "errors-desc" })), [
    many,
    one,
    zero,
    missing,
    malformed,
    negative,
  ]);
  assert.deepEqual(rows, original);
});

test("quick views produce independent complete list-filter replacements and recognize only exact presets", () => {
  for (const view of ORDER_QUICK_VIEWS) {
    const value = orderQuickViewFilters(view.value);
    assert.deepEqual(
      Object.keys(value).sort(),
      Object.keys(DEFAULT_INVESTIGATION_FILTERS).sort(),
    );
    assert.equal(matchingOrderQuickView(value), view.value);
    assert.equal(
      matchingOrderQuickView({ ...value, query: "custom search" }),
      "custom",
    );
    value.query = "mutated";
    assert.equal(orderQuickViewFilters(view.value).query, "");
  }
  const large = orderQuickViewFilters("large");
  const atMinimum = statusOrder("minimum", "pending", {
    totalUSDAmount: "1000",
  });
  assert.deepEqual(
    investigateOrders(
      [
        statusOrder("below", "pending", { totalUSDAmount: "999.99" }),
        statusOrder("unreported", "pending", { totalUSDAmount: "" }),
        atMinimum,
      ],
      large,
    ),
    [atMinimum],
  );
});

test("new age/error-sort parameters round-trip through filter models and internal order navigation with raw-column preference", () => {
  const value = filters({
    query: "allowance & gas",
    adapter,
    token,
    status: "active",
    type: "Limit",
    source: "v1",
    errors: "latest",
    activeAge: "24h",
    minUsd: "0",
    maxUsd: "1000",
    sort: "errors-asc",
  });
  const query = investigationFilterQuery(value);
  assert.deepEqual(readInvestigationFilters(query), value);
  const search = new URLSearchParams([
    ["period", "30"],
    ["chain_id", "137"],
    ["chain_id", "8453"],
    ["partner_id", "sushiswap"],
    ["order_raw", "1"],
    ["order_view", "execution"],
    ...Object.entries(query).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  ]);
  const detail = new URL(
    orderDetailHref("0xabc", "v2", { query: search.toString() }),
    "https://ops.example",
  );
  assert.equal(detail.searchParams.get("source"), "v2");
  const returned = new URL(
    ordersScopeHref({ query: detail.searchParams.toString() }),
    detail.origin,
  );
  assert.equal(returned.searchParams.get("order_raw"), "1");
  assert.equal(returned.searchParams.get("order_active_age"), "24h");
  assert.equal(returned.searchParams.get("order_sort"), "errors-asc");
  assert.equal(returned.searchParams.get("period"), "30");
  assert.deepEqual(returned.searchParams.getAll("chain_id"), ["137", "8453"]);
  assert.equal(returned.searchParams.get("partner_id"), "sushiswap");
  assert.equal(returned.searchParams.has("source"), false);
  assert.equal(returned.searchParams.has("order_view"), false);
  assert.deepEqual(
    readInvestigationFilters(Object.fromEntries(returned.searchParams)),
    value,
  );
  assert.deepEqual(
    readInvestigationFilters({
      order_active_age: "forever",
      order_sort: "random",
      order_errors: "maybe",
    }),
    DEFAULT_INVESTIGATION_FILTERS,
  );
});

test("complete hash searches navigate directly with the selected service and return without a redirecting hash search", () => {
  const hash = `0x${"ab".repeat(32)}`;
  const scope = {
    query: new URLSearchParams({
      period: "7",
      chain_id: "137",
      partner_id: "sushiswap",
      orders_view: "lookup",
      order_search: hash,
      order_source: "v1",
      source: "v2",
      order_raw: "1",
      order_active_age: "24h",
      order_errors: "latest",
      order_sort: "errors-asc",
    }).toString(),
    period: "30",
    chainIds: ["8453", "0"],
    partnerIds: ["fixed-app"],
  };
  const href = orderHashSearchHref(` ${hash} `, scope);
  assert.ok(href);
  const detail = new URL(href, "https://ops.example");
  assert.equal(detail.pathname, `/orders/${hash}`);
  assert.equal(detail.searchParams.get("source"), "v1");
  assert.equal(detail.searchParams.has("order_search"), false);
  assert.equal(detail.searchParams.has("orders_view"), false);
  assert.equal(detail.searchParams.get("period"), "30");
  assert.deepEqual(detail.searchParams.getAll("chain_id"), ["8453", "0"]);
  assert.deepEqual(detail.searchParams.getAll("partner_id"), ["fixed-app"]);
  assert.equal(detail.searchParams.get("order_raw"), "1");
  assert.equal(detail.searchParams.get("order_active_age"), "24h");
  assert.equal(detail.searchParams.get("order_errors"), "latest");
  assert.equal(detail.searchParams.get("order_sort"), "errors-asc");
  const returned = new URL(
    ordersScopeHref({ query: detail.searchParams.toString() }),
    detail.origin,
  );
  assert.equal(returned.searchParams.has("order_search"), false);
  assert.equal(returned.searchParams.has("source"), false);
  assert.equal(returned.searchParams.get("order_source"), "v1");
});

test("hash search accepts only a complete hash and never infers a service from global scope or an old detail source", () => {
  const hash = `0x${"cd".repeat(32)}`;
  for (const value of ["", "0xabc", `find ${hash}`, `${hash}/outside`, adapter])
    assert.equal(orderHashSearchHref(value, {}), undefined);
  for (const selectedSource of ["all", "unreported", "future", ""]) {
    const href = orderHashSearchHref(hash, {
      query: `order_source=${selectedSource}&source=v1&orders_view=technical&order_raw=1`,
    });
    assert.ok(href);
    const search = new URL(href, "https://ops.example").searchParams;
    assert.equal(search.has("source"), false);
    assert.equal(search.get("orders_view"), "technical");
    assert.equal(search.get("order_raw"), "1");
  }
});
