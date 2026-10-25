import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListOrder, SpotConfig } from "../packages/domain/src/twap/types";
import { getSpotPartnerConfig } from "../packages/domain/src/twap/utils";
import {
  getOverviewOrderStatus,
  ordersToPartnerStats,
  groupOverviewOrders,
  getTopPairsByOrderCount,
  getTopPairsByVolume,
  filterOverviewOrders,
  getPartnerByAdapter,
  getPartnerChainPairs,
} from "../packages/domain/src/twap/utils/orders-overview";

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
test("popular pairs rank order frequency ahead of placed value", () => {
  const orders = [
    order("completed", "SUCCEEDED", {
      inputToken: "0xccc",
      totalUSDAmount: "1000000",
    }),
    order("completed", "SUCCEEDED", { totalUSDAmount: "1" }),
    order("pending", "PENDING", { totalUSDAmount: "1" }),
    order("failed", "FAILED", { totalUSDAmount: "1" }),
  ];

  assert.deepEqual(
    getTopPairsByOrderCount(orders).map((pair) => [
      pair.inputToken,
      pair.orderCount,
      pair.totalUsd,
    ]),
    [
      ["0xaaa", 3, 3],
      ["0xccc", 1, 1000000],
    ],
  );
  assert.equal(getTopPairsByVolume(orders)[0].inputToken, "0xccc");
});
test("orders with missing, zero or invalid USD values still count toward popularity", () => {
  const pairs = getTopPairsByOrderCount([
    order("completed", "SUCCEEDED", { totalUSDAmount: undefined }),
    order("completed", "SUCCEEDED", { totalUSDAmount: "0" }),
    order("completed", "SUCCEEDED", { totalUSDAmount: "NaN" }),
    order("completed", "SUCCEEDED", {
      inputToken: "0xccc",
      totalUSDAmount: "1000",
    }),
  ]);

  assert.equal(pairs[0].inputToken, "0xaaa");
  assert.equal(pairs[0].orderCount, 3);
  assert.equal(pairs[0].totalUsd, 0);
});
test("popular pair limits apply after counting all routes", () => {
  const orders = ["0xaaa", "0xbbb", "0xccc", "0xddd"].flatMap(
    (inputToken, index) =>
      Array.from({ length: index + 1 }, () =>
        order("completed", "SUCCEEDED", { inputToken }),
      ),
  );

  assert.deepEqual(
    getTopPairsByOrderCount(orders).map((pair) => pair.inputToken),
    ["0xddd", "0xccc", "0xbbb"],
  );
  assert.deepEqual(
    getTopPairsByOrderCount(orders, 2).map((pair) => pair.inputToken),
    ["0xddd", "0xccc"],
  );
  assert.deepEqual(getTopPairsByOrderCount(orders, 0), []);
});
test("popular pair counts combine address casing and retain each direction", () => {
  const pairs = getTopPairsByOrderCount([
    order("completed", "SUCCEEDED"),
    order("completed", "SUCCEEDED", { inputToken: "0xAAA" }),
    order("completed", "SUCCEEDED", {
      inputToken: "0xbbb",
      outputToken: "0xaaa",
    }),
    order("completed", "SUCCEEDED", { inputToken: "" }),
    order("completed", "SUCCEEDED", { outputToken: undefined }),
  ]);

  assert.deepEqual(
    pairs.map((pair) => [pair.inputToken, pair.outputToken, pair.orderCount]),
    [
      ["0xaaa", "0xbbb", 2],
      ["0xbbb", "0xaaa", 1],
    ],
  );
});
test("popularity ties use token addresses independently of value and arrival order", () => {
  const orders = [
    order("completed", "SUCCEEDED", {
      inputToken: "0xccc",
      outputToken: "0xaaa",
      totalUSDAmount: "1000000",
    }),
    order("completed", "SUCCEEDED", {
      outputToken: "0xddd",
      totalUSDAmount: "10000",
    }),
    order("completed", "SUCCEEDED", { totalUSDAmount: "0" }),
  ];
  const expected = [
    ["0xaaa", "0xbbb"],
    ["0xaaa", "0xddd"],
    ["0xccc", "0xaaa"],
  ];
  const addresses = (pairs: ReturnType<typeof getTopPairsByOrderCount>) =>
    pairs.map((pair) => [pair.inputToken, pair.outputToken]);

  assert.deepEqual(addresses(getTopPairsByOrderCount(orders)), expected);
  assert.deepEqual(
    addresses(getTopPairsByOrderCount([...orders].reverse())),
    expected,
  );
});
test("ranking pairs leaves the input order sequence and order data intact", () => {
  const orders = [
    order("completed", "SUCCEEDED", { inputToken: "0xCCC" }),
    order("pending", "PENDING", { totalUSDAmount: "3" }),
    order("completed", "SUCCEEDED", { totalUSDAmount: "2" }),
  ];
  const original = structuredClone(orders);

  getTopPairsByOrderCount(orders);
  getTopPairsByVolume(orders);

  assert.deepEqual(orders, original);
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
  const { getTwapOrderChainId } =
    await import("../packages/domain/src/twap/utils");
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

test("partner lookup includes legacy service adapters and de-duplicates current metadata", () => {
  const legacyAdapter = "0x426ec4bc0d58B80959CDE77576a1942dd40592Fa";
  const currentAdapter = "0x1111111111111111111111111111111111111111";
  const config = {
    "43114": {
      dex: { blackhole: { adapter: currentAdapter } },
      partnerAdapters: [
        {
          partnerId: "blackhole",
          partnerName: "Blackhole",
          adapter: currentAdapter,
        },
        {
          partnerId: "blackhole",
          partnerName: "Blackhole",
          adapter: legacyAdapter,
        },
        {
          partnerId: "blackhole",
          partnerName: "Blackhole",
          adapter: legacyAdapter.toLowerCase(),
        },
      ],
    },
  } as unknown as SpotConfig;
  const pairs = getPartnerChainPairs(config);

  assert.equal(pairs.length, 2);
  assert.deepEqual(
    pairs.map((pair) => [pair.partnerId, pair.chainId, pair.adapter]),
    [
      ["blackhole", 43114, currentAdapter],
      ["blackhole", 43114, legacyAdapter],
    ],
  );
  for (const adapter of [
    legacyAdapter,
    legacyAdapter.toUpperCase(),
    currentAdapter,
  ]) {
    assert.deepEqual(getPartnerByAdapter(config, adapter, 43114), {
      partnerId: "blackhole",
      partnerName: "Blackhole",
    });
  }
  assert.equal(getPartnerByAdapter(config, legacyAdapter, 137), null);
  assert.equal(getPartnerByAdapter(config, "unmapped-adapter", 43114), null);
});

test("adapter identity stays chain-specific when different apps reuse one address", () => {
  const sharedAdapter = "0x2222222222222222222222222222222222222222";
  const config = {
    "137": { dex: { quick: { adapter: sharedAdapter } } },
    "42161": {
      partnerAdapters: [
        {
          partnerId: "ramses",
          partnerName: "Ramses",
          adapter: sharedAdapter,
        },
      ],
    },
  } as unknown as SpotConfig;

  assert.deepEqual(getPartnerByAdapter(config, sharedAdapter, 137), {
    partnerId: "quickswap",
    partnerName: "Quickswap",
  });
  assert.deepEqual(getPartnerByAdapter(config, sharedAdapter, 42161), {
    partnerId: "ramses",
    partnerName: "Ramses",
  });
  assert.equal(getPartnerByAdapter(config, sharedAdapter), null);
  assert.equal(getPartnerByAdapter(config, sharedAdapter, 0), null);
  assert.equal(getPartnerByAdapter(config, sharedAdapter, 1), null);
});

test("known aliases resolve canonically and configured custom partner IDs retain their casing", () => {
  const config = {
    "137": {
      dex: {
        spooky: { adapter: "current-spooky" },
        MyDesk: { adapter: "current-custom" },
      },
      partnerAdapters: [
        {
          partnerId: "spooky",
          partnerName: "Spookyswap",
          adapter: "old-spooky",
        },
        {
          partnerId: "MyDesk",
          partnerName: "My Desk",
          adapter: "old-custom",
        },
      ],
    },
  } as unknown as SpotConfig;

  for (const adapter of ["current-spooky", "old-spooky"])
    assert.deepEqual(getPartnerByAdapter(config, adapter, 137), {
      partnerId: "spookyswap",
      partnerName: "Spookyswap",
    });
  assert.deepEqual(getPartnerByAdapter(config, "old-custom", 137), {
    partnerId: "MyDesk",
    partnerName: "My Desk",
  });
  assert.deepEqual(getPartnerByAdapter(config, "current-custom", 137), {
    partnerId: "MyDesk",
    partnerName: "MyDesk",
  });
});

test("the same named app on multiple networks remains identifiable without a chain", () => {
  const config = {
    "137": { dex: { quick: { adapter: "shared-quick" } } },
    "1": {
      partnerAdapters: [
        {
          partnerId: "quickswap",
          partnerName: "Quickswap",
          adapter: "SHARED-QUICK",
        },
      ],
    },
  } as unknown as SpotConfig;

  assert.deepEqual(getPartnerByAdapter(config, "shared-quick"), {
    partnerId: "quickswap",
    partnerName: "Quickswap",
  });
});

test("partner details identify a historical Blackhole adapter without claiming its current protocol config", () => {
  const legacyAdapter = "0x426ec4bc0d58B80959CDE77576a1942dd40592Fa";
  const currentConfig = {
    adapter: "0x1111111111111111111111111111111111111111",
    type: "current-protocol",
    fee: "0x0000000000000000000000000000000000000001",
  };
  const config = {
    "43114": {
      dex: { blackhole: currentConfig },
      partnerAdapters: [
        {
          partnerId: "blackhole",
          partnerName: "Blackhole",
          adapter: legacyAdapter,
        },
      ],
    },
  } as unknown as SpotConfig;

  const historical = getSpotPartnerConfig(config, legacyAdapter, 43114);
  assert.equal(historical.partnerId, "blackhole");
  assert.equal(historical.partnerName, "Blackhole");
  assert.equal(historical.partner?.name, "Blackhole");
  assert.equal(historical.chainId, 43114);
  assert.equal(historical.config, null);

  const current = getSpotPartnerConfig(config, currentConfig.adapter, 43114);
  assert.equal(current.partnerId, "blackhole");
  assert.equal(current.partnerName, "Blackhole");
  assert.deepEqual(current.config, currentConfig);
});

test("partner detail lookup respects network ambiguity, registered aliases and custom ID casing", () => {
  const sharedAdapter = "0x2222222222222222222222222222222222222222";
  const config = {
    "137": {
      dex: {
        quick: { adapter: sharedAdapter },
        MyDesk: { adapter: "current-custom" },
      },
      partnerAdapters: [
        {
          partnerId: "MyDesk",
          partnerName: "My Desk",
          adapter: "historical-custom",
        },
      ],
    },
    "42161": {
      partnerAdapters: [
        {
          partnerId: "ramses",
          partnerName: "Ramses",
          adapter: sharedAdapter,
        },
      ],
    },
  } as unknown as SpotConfig;

  for (const identifier of [sharedAdapter, "quick", "quickswap"]) {
    const quick = getSpotPartnerConfig(config, identifier, 137);
    assert.equal(quick.partnerId, "quickswap");
    assert.equal(quick.partnerName, "Quickswap");
    assert.equal(quick.chainId, 137);
  }
  const ramses = getSpotPartnerConfig(config, sharedAdapter, 42161);
  assert.equal(ramses.partnerId, "ramses");
  assert.equal(ramses.partnerName, "Ramses");
  assert.equal(ramses.chainId, 42161);
  assert.equal(ramses.config, null);

  const ambiguous = getSpotPartnerConfig(config, sharedAdapter, 0);
  assert.equal(ambiguous.partnerId, undefined);
  assert.equal(ambiguous.partnerName, "Unknown partner");
  assert.equal(ambiguous.partner, null);
  assert.equal(ambiguous.config, null);

  for (const identifier of ["mydesk", "current-custom", "historical-custom"]) {
    const custom = getSpotPartnerConfig(config, identifier, 137);
    assert.equal(custom.partnerId, "MyDesk");
    assert.equal(custom.chainId, 137);
  }
  assert.equal(
    getSpotPartnerConfig(config, "historical-custom", 137).partnerName,
    "My Desk",
  );
});
