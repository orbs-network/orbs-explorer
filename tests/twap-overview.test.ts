import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListOrder } from "../src/lib/twap/types";
import {
  getOverviewOrderStatus,
  ordersToPartnerStats,
  groupOverviewOrders,
  getTopPairsByVolume,
  filterOverviewOrders,
} from "../src/lib/twap/utils/orders-overview";

function order(
  status: string,
  displayOnlyStatus: string,
  overrides: Partial<ListOrder> = {},
): ListOrder {
  return {
    hash: "0x1",
    exchangeAdapter: "app",
    inputToken: "0xaaa",
    outputToken: "0xbbb",
    totalUSDAmount: "10",
    timestamp: "2026-10-13T10:00:00Z",
    metadata: { status, displayOnlyStatus },
    order: { witness: { chainId: 137 } },
    ...overrides,
  } as ListOrder;
}
test("cancelled and expired orders are separate from failures, including partial execution", () => {
  assert.equal(
    getOverviewOrderStatus(order("failed", "CANCELLED")),
    "cancelled",
  );
  assert.equal(getOverviewOrderStatus(order("failed", "EXPIRED")), "expired");
  assert.equal(
    getOverviewOrderStatus(order("partially_completed", "CANCELLED")),
    "cancelled",
  );
  assert.equal(getOverviewOrderStatus(order("failed", "FAILED")), "failed");
});
test("eligible orders and unsuccessful attempts stay active", () => {
  assert.equal(getOverviewOrderStatus(order("eligible", "PENDING")), "active");
  assert.equal(getOverviewOrderStatus(order("pending", "ERROR")), "active");
  assert.equal(
    getOverviewOrderStatus(order("pending", "PENDING-PRICE-CHECK")),
    "active",
  );
  assert.equal(
    getOverviewOrderStatus(order("completed", "SUCCEEDED")),
    "completed",
  );
  assert.equal(
    getOverviewOrderStatus(order("partially_completed", "PARTIALLY SUCCEEDED")),
    "partial",
  );
  assert.equal(
    getOverviewOrderStatus(order("new-service-status", "NEW")),
    "unknown",
  );
});
test("each order appears in exactly one outcome and dollar totals exclude invalid values", () => {
  const orders = [
    order("completed", "SUCCEEDED"),
    order("failed", "CANCELLED"),
    order("failed", "EXPIRED"),
    order("pending", "ERROR"),
    order("eligible", "PENDING"),
    order("failed", "FAILED"),
    order("partially_completed", "PARTIALLY SUCCEEDED"),
    order("new", "NEW", { totalUSDAmount: "NaN" }),
  ];
  const groups = groupOverviewOrders(orders);
  assert.equal(Object.values(groups).flat().length, orders.length);
  const stats = ordersToPartnerStats(orders, "app", "App");
  assert.equal(stats.totalOrders, 8);
  assert.equal(stats.totalUsd, 70);
  assert.equal(stats.errorOrders, 1);
  assert.equal(stats.pendingOrders, 2);
  assert.equal(stats.cancelledOrders, 1);
  assert.equal(stats.expiredOrders, 1);
  assert.equal(stats.unknownOrders, 1);
  assert.equal(
    stats.totalUsd,
    stats.filledUsd +
      stats.partiallyFilledUsd +
      stats.errorUsd +
      stats.pendingUsd +
      stats.cancelledUsd +
      stats.expiredUsd +
      stats.unknownUsd,
  );
});
test("opposite token directions stay separate in popular routes", () => {
  const routes = getTopPairsByVolume([
    order("completed", "SUCCEEDED", { totalUSDAmount: "30" }),
    order("pending", "PENDING", {
      inputToken: "0xbbb",
      outputToken: "0xaaa",
      totalUSDAmount: "20",
    }),
    order("completed", "SUCCEEDED", {
      inputToken: "0xAAA",
      totalUSDAmount: "5",
    }),
  ]);
  assert.equal(routes.length, 2);
  assert.deepEqual(
    routes.map((r) => [r.inputToken, r.outputToken, r.totalUsd, r.orderCount]),
    [
      ["0xaaa", "0xbbb", 35, 2],
      ["0xbbb", "0xaaa", 20, 1],
    ],
  );
});
test("period, app and network filters share the same snapshot boundary", () => {
  const updatedAt = Date.parse("2026-10-13T10:00:00Z");
  const orders = [
    order("completed", "SUCCEEDED"),
    order("completed", "SUCCEEDED", { timestamp: "2026-10-06T10:00:00Z" }),
    order("completed", "SUCCEEDED", { timestamp: "2026-10-06T09:59:59Z" }),
    order("completed", "SUCCEEDED", { exchangeAdapter: "another" }),
    order("completed", "SUCCEEDED", {
      order: { witness: { chainId: 1 } },
    } as Partial<ListOrder>),
  ];
  assert.equal(
    filterOverviewOrders(orders, {
      days: 7,
      updatedAt,
      chainIds: ["137"],
      partnerIds: ["app"],
      resolvePartner: (o) => o.exchangeAdapter,
    }).length,
    2,
  );
  assert.equal(
    filterOverviewOrders(orders, {
      updatedAt,
      resolvePartner: (o) => o.exchangeAdapter,
    }).length,
    5,
  );
});

test("order service chain IDs normalize numeric strings and legacy fields", async () => {
  const { getTwapOrderChainId } = await import("../src/lib/twap/utils");
  assert.equal(
    getTwapOrderChainId({ order: { witness: { chainId: "59144" } } }),
    59144,
  );
  assert.equal(
    getTwapOrderChainId({ order: { witness: { chainid: 137 } } }),
    137,
  );
  assert.equal(
    getTwapOrderChainId({ order: { witness: { chainId: "invalid" } } }),
    undefined,
  );
});
