import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListOrder, SpotConfig } from "../packages/domain/src/twap/types";
import { buildSpotOverview } from "../apps/ops/src/lib/overview-data";
import {
  buildPlacementReport,
  placementChange,
  summarizePlacements,
} from "../apps/ops/src/lib/placement-report";
import {
  placementComparisonExport,
  placementComparisonCsv,
} from "../apps/ops/src/lib/placement-report-export";
import {
  buildTradingAppRows,
  withTradingAppComparison,
  sortTradingAppRows,
  parseTradingAppColumns,
} from "../apps/ops/src/lib/trading-apps-table";

const end = Date.parse("2026-10-22T12:00:00Z");
const day = 86_400_000;
const config = {
  137: { dex: { quickswap: { adapter: "quick" } } },
  8453: { dex: { quickswap: { adapter: "quick" } } },
} as unknown as SpotConfig;
function order(age: number, chainId = 137, usd = "10"): ListOrder {
  return {
    hash: `${age}:${chainId}`,
    exchangeAdapter: "quick",
    totalUSDAmount: usd,
    timestamp: new Date(end - age * day).toISOString(),
    metadata: { status: "completed" },
    order: { witness: { chainId } },
  } as ListOrder;
}
function report(
  allOrders: ListOrder[],
  period: number | "all" = 7,
  chainIds: string[] = [],
) {
  const days = period === "all" ? undefined : period;
  const view = buildSpotOverview({
    allOrders,
    config,
    updatedAt: end,
    days,
    chainIds,
  });
  return buildPlacementReport({
    allOrders,
    config,
    updatedAt: end,
    days,
    chainIds,
    partnerIds: [],
    currentCards: view.partnerCards,
  });
}

test("equal rolling placement comparisons have no shared boundary, future orders or undated records", () => {
  const input = [
    order(0),
    order(7),
    order(8),
    order(14),
    order(15),
    order(-1),
    { ...order(2), timestamp: "invalid" },
  ];
  const result = report(input);
  assert.equal(result.current.orders, 2);
  assert.equal(result.previous?.orders, 2);
  assert.equal(result.start, end - 7 * day);
  assert.equal(result.previousStart, end - 14 * day);
  assert.equal(result.current.placedUsd, 20);
  assert.equal(report(input, "all").previous, undefined);
});

test("placement report applies the same app/network identity and filter to both periods", () => {
  const result = report(
    [order(1), order(8), order(2, 8453), order(10, 8453), order(11, 8453)],
    7,
    ["137"],
  );
  assert.equal(result.current.orders, 1);
  assert.equal(result.previous?.orders, 1);
  assert.equal(result.current.apps, 1);
  assert.equal(result.previous?.apps, 1);
  assert.equal(
    result.previousCards
      ?.flatMap((app) => app.chains)
      .some((chain) => chain.chainId === 8453),
    false,
  );
});

test("missing USD is unavailable, reported zero remains zero and empty prior periods never invent a growth rate", () => {
  const result = report([order(1, 137, ""), order(8, 137, "0")]);
  assert.equal(result.current.placedUsd, undefined);
  assert.equal(result.current.pricedOrders, 0);
  assert.equal(result.previous?.placedUsd, 0);
  assert.equal(placementChange(undefined, 0), "Unavailable");
  assert.equal(placementChange(2, 0), "New");
  assert.equal(placementChange(0, 0), "No change");
  assert.equal(placementChange(1, 2), "-50%");
  assert.equal(summarizePlacements([]).placedUsd, 0);
});

test("app/network growth uses stable row IDs and unknown growth sorts after measured changes", () => {
  const input = [order(1), order(2), order(8), order(1, 8453)];
  const current = buildSpotOverview({
    allOrders: input,
    config,
    updatedAt: end,
    days: 7,
  });
  const result = report(input);
  const rows = withTradingAppComparison(
    buildTradingAppRows(current.partnerCards, end, "networks"),
    buildTradingAppRows(result.previousCards!, end, "networks", true),
  );
  assert.equal(rows.find((row) => row.chainId === 137)?.orderChange, 1);
  assert.equal(rows.find((row) => row.chainId === 8453)?.previousOrders, 0);
  assert.equal(
    rows.find((row) => row.chainId === 8453)?.orderChange,
    undefined,
  );
  assert.equal(sortTradingAppRows(rows, "orderChange")[0].chainId, 137);
  assert.equal(parseTradingAppColumns("business"), "business");
});

test("aggregated exports retain scope, definitions, missing values, exact outcomes and safe spreadsheet strings", () => {
  const input = [order(1, 137, "")];
  const current = buildSpotOverview({
    allOrders: input,
    config,
    updatedAt: end,
    days: 7,
  });
  const rows = buildTradingAppRows(current.partnerCards, end).filter(
    (row) => row.totalOrders,
  );
  rows[0].partnerName = "=HYPERLINK(unsafe)";
  const result = placementComparisonExport({
    rows,
    query: "period=7&chain_id=137&order_search=hidden",
    snapshot: end,
    grouping: "apps",
    search: "quick",
    exportedAt: end + 1000,
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].placed_usd, null);
  assert.equal(result.rows[0].completed, 1);
  assert.equal(result.metadata.table_search, "quick");
  assert.equal(result.metadata.filter_query, "chain_id=137");
  assert.equal(result.metadata.snapshot_utc, "2026-10-22T12:00:00.000Z");
  assert.match(result.metadata.definitions, /not executed volume/);
  const csv = placementComparisonCsv(result);
  assert.match(csv, /snapshot_utc/);
  assert.match(csv, /'\=HYPERLINK/);
  assert.equal(csv.split("\r\n").length, 2);
  assert.equal(placementComparisonCsv({ ...result, rows: [] }), "");
});
