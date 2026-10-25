import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSpotOverview } from "../apps/ops/src/lib/overview-data";
import { PARTNERS } from "../packages/domain/src/partners";
import type { ListOrder, SpotConfig } from "../packages/domain/src/twap/types";

const updatedAt = Date.parse("2026-10-20T12:00:00Z");
const config = {
  "137": {
    dex: {
      quickswap: { adapter: "quick-adapter" },
      spooky: { adapter: "spooky-adapter" },
      newapp: { adapter: "new-adapter" },
      dragon: { adapter: "dragon-adapter" },
    },
  },
  "1": { dex: { quickswap: { adapter: "ethereum-quick" } } },
} as unknown as SpotConfig;
function order(adapter: string, timestamp = "2026-10-20T10:00:00Z"): ListOrder {
  return {
    exchangeAdapter: adapter,
    hash: adapter,
    inputToken: "0xaaa",
    outputToken: "0xbbb",
    timestamp,
    totalUSDAmount: "10",
    metadata: { status: "completed", displayOnlyStatus: "SUCCEEDED" },
    order: { witness: { chainId: 137 } },
  } as ListOrder;
}

test("overview shows every registered and configured partner even without orders", () => {
  const view = buildSpotOverview({ allOrders: [], config, updatedAt });
  for (const partner of PARTNERS) {
    assert.ok(
      view.partnerCards.some((card) => card.partnerId === partner.id),
      partner.name,
    );
    assert.ok(
      view.partnerOptions.some((option) => option.value === partner.id),
      partner.name,
    );
  }
  assert.ok(view.partnerCards.some((card) => card.partnerId === "newapp"));
  assert.equal(
    view.partnerCards.filter((card) => card.partnerId === "spookyswap").length,
    1,
  );
  assert.ok(!view.partnerCards.some((card) => card.partnerId === "spooky"));
  assert.ok(!view.partnerCards.some((card) => card.partnerId === "dragon"));
  assert.equal(
    view.partnerCards.find((card) => card.partnerId === "dragonswap")?.chains
      .length,
    1,
  );
  const quick = view.partnerCards.find(
    (card) => card.partnerId === "quickswap",
  )!;
  assert.equal(quick.chains.length, 2);
  assert.ok(
    quick.chains.every(
      (chain) => chain.stats.totalOrders === 0 && chain.stats.totalUsd === 0,
    ),
  );
  assert.deepEqual(view.networkOptions.map((option) => option.value).sort(), [
    "1",
    "137",
  ]);
});

test("period filters retain zero-order cards and preserve active partner totals", () => {
  const view = buildSpotOverview({
    allOrders: [
      order("quick-adapter", "2026-09-01T10:00:00Z"),
      order("spooky-adapter"),
    ],
    config,
    updatedAt,
    days: 7,
  });
  assert.equal(view.orders.length, 1);
  assert.equal(view.partnerCards[0].partnerId, "spookyswap");
  const quick = view.partnerCards.find(
    (card) => card.partnerId === "quickswap",
  )!;
  assert.ok(quick.chains.every((chain) => chain.orders.length === 0));
  assert.equal(
    view.stats.reduce((sum, stat) => sum + stat.totalOrders, 0),
    1,
  );
  assert.equal(
    view.stats.reduce((sum, stat) => sum + stat.totalUsd, 0),
    10,
  );
});

test("network and partner filters limit cards to matching partners while supporting aliases", () => {
  const network = buildSpotOverview({
    allOrders: [],
    config,
    updatedAt,
    chainIds: ["1"],
  });
  assert.deepEqual(
    network.partnerCards.map((card) => card.partnerId),
    ["quickswap"],
  );
  const partner = buildSpotOverview({
    allOrders: [order("spooky-adapter")],
    config,
    updatedAt,
    partnerIds: ["spooky"],
    chainIds: ["137"],
  });
  assert.deepEqual(
    partner.partnerCards.map((card) => card.partnerId),
    ["spookyswap"],
  );
  assert.equal(partner.orders.length, 1);
});

test("partners stay visible without config and unidentified historical apps remain represented", () => {
  const view = buildSpotOverview({
    allOrders: [order("unknown-adapter")],
    config: null,
    updatedAt,
  });
  assert.equal(view.partnerCards.length, PARTNERS.length + 1);
  assert.equal(view.partnerCards[0].partnerId, "adapter-unknown-adapter");
  assert.equal(view.partnerCards[0].chains[0].orders.length, 1);
  assert.equal(
    new Set(view.partnerCards.map((card) => card.partnerId)).size,
    view.partnerCards.length,
  );
});

test("old unidentified adapters do not add empty cards to the known partner roster", () => {
  const view = buildSpotOverview({
    allOrders: [order("old-adapter", "2026-09-01T10:00:00Z")],
    config: null,
    updatedAt,
    days: 7,
  });
  assert.equal(view.partnerCards.length, PARTNERS.length);
  assert.equal(view.orders.length, 0);
});

test("network totals combine partners once and respect multiple network filters", () => {
  const onEthereum = order("ethereum-quick");
  onEthereum.order.witness.chainId = 1;
  const view = buildSpotOverview({
    allOrders: [order("quick-adapter"), order("spooky-adapter"), onEthereum],
    config,
    updatedAt,
    chainIds: ["1", "137"],
  });
  assert.equal(
    view.networkActivity.find((chain) => chain.chainId === 137)?.orders.length,
    2,
  );
  assert.equal(
    view.networkActivity.find((chain) => chain.chainId === 1)?.orders.length,
    1,
  );
  assert.equal(
    view.networkActivity.reduce((sum, chain) => sum + chain.stats.totalUsd, 0),
    30,
  );
});

test("saved adapter-based filters continue to include orders after the app is identified", () => {
  const adapter = "0x426ec4bc0d58B80959CDE77576a1942dd40592Fa";
  const historic = order(adapter);
  historic.order.witness.chainId = 43114;
  const view = buildSpotOverview({
    allOrders: [historic],
    config: {
      "43114": {
        partnerAdapters: [
          { partnerId: "blackhole", partnerName: "Blackhole", adapter },
        ],
      },
    },
    updatedAt,
    partnerIds: [`adapter-${adapter.toLowerCase()}`],
    chainIds: ["43114"],
  });
  assert.deepEqual(view.orders, [historic]);
  assert.deepEqual(view.selectedPartnerIds, ["blackhole"]);
  assert.equal(view.partnerCards.length, 1);
  assert.equal(view.partnerCards[0].partnerId, "blackhole");
  assert.equal(view.partnerCards[0].partnerName, "Blackhole");
});

test("an unidentified adapter filter does not become a known app on a different network", () => {
  const adapter = `0x${"a".repeat(40)}`;
  const registered = order(adapter);
  const wrongNetwork = order(adapter);
  wrongNetwork.order.witness.chainId = 8453;
  const shared = {
    allOrders: [registered, wrongNetwork],
    config: {
      137: { dex: { quickswap: { adapter } } },
    } as unknown as SpotConfig,
    updatedAt,
    partnerIds: [`adapter-${adapter}`],
  };
  const allNetworks = buildSpotOverview(shared);
  assert.deepEqual(allNetworks.orders, [wrongNetwork]);
  assert.deepEqual(allNetworks.selectedPartnerIds, [`adapter-${adapter}`]);
  assert.equal(allNetworks.partnerCards.length, 1);
  assert.equal(allNetworks.partnerCards[0].partnerId, `adapter-${adapter}`);
  assert.equal(allNetworks.partnerCards[0].chains[0].chainId, 8453);
  assert.deepEqual(
    buildSpotOverview({ ...shared, chainIds: ["8453"] }).orders,
    [wrongNetwork],
  );
  const identifiedNetwork = buildSpotOverview({ ...shared, chainIds: ["137"] });
  assert.deepEqual(identifiedNetwork.orders, []);
  assert.deepEqual(identifiedNetwork.selectedPartnerIds, [`adapter-${adapter}`]);
  assert.deepEqual(identifiedNetwork.partnerCards, []);
});

test("changing the period does not reassign an unidentified adapter filter to another app", () => {
  const adapter = `0x${"a".repeat(40)}`;
  const registered = order(adapter);
  const historicUnknown = order(adapter, "2026-09-01T10:00:00Z");
  historicUnknown.order.witness.chainId = 8453;
  const view = buildSpotOverview({
    allOrders: [registered, historicUnknown],
    config: {
      137: { dex: { quickswap: { adapter } } },
    } as unknown as SpotConfig,
    updatedAt,
    partnerIds: [`adapter-${adapter}`],
    days: 7,
  });
  assert.deepEqual(view.orders, []);
  assert.deepEqual(view.selectedPartnerIds, [`adapter-${adapter}`]);
  assert.equal(view.partnerCards.length, 1);
  assert.equal(view.partnerCards[0].partnerId, `adapter-${adapter}`);
  assert.deepEqual(view.partnerCards[0].chains[0].orders, []);
});

test("missing and non-string adapters remain inspectable under a readable unidentified app", () => {
  const records = [undefined, null, 123, {}, "", "   "].map((value) => {
    const record = order("");
    (record as unknown as { exchangeAdapter: unknown }).exchangeAdapter = value;
    return record;
  });
  const view = buildSpotOverview({
    allOrders: records,
    config: null,
    updatedAt,
  });
  assert.deepEqual(view.orders, records);
  const unidentified = view.partnerCards.find(
    (card) => card.partnerId === "adapter-",
  )!;
  assert.equal(
    unidentified.partnerName,
    "Unidentified app (address not provided)",
  );
  assert.deepEqual(unidentified.chains[0].orders, records);
});

const legacyBlackholeAdapter = "0x426ec4bc0d58B80959CDE77576a1942dd40592Fa";
const activeBlackholeAdapter = "0x1111111111111111111111111111111111111111";
const blackholeConfig = {
  "43114": {
    dex: { blackhole: { adapter: activeBlackholeAdapter } },
    partnerAdapters: [
      {
        partnerId: "blackhole",
        partnerName: "Blackhole",
        adapter: legacyBlackholeAdapter,
      },
      {
        partnerId: "blackhole",
        partnerName: "Blackhole",
        adapter: activeBlackholeAdapter,
      },
      {
        partnerId: "blackhole",
        partnerName: "Blackhole",
        adapter: legacyBlackholeAdapter.toLowerCase(),
      },
    ],
  },
} as unknown as SpotConfig;

function networkOrder(
  adapter: string,
  chainId: number | undefined,
  timestamp?: string,
) {
  return {
    ...order(adapter, timestamp),
    order: { witness: { chainId } },
  } as ListOrder;
}

test("historical and current Blackhole adapters form one named partner and share its filter", () => {
  const allOrders = [
    networkOrder(legacyBlackholeAdapter, 43114),
    networkOrder(activeBlackholeAdapter, 43114),
    networkOrder("unmapped-adapter", 43114),
  ];
  const view = buildSpotOverview({
    allOrders,
    config: blackholeConfig,
    updatedAt,
    partnerIds: ["blackhole"],
  });

  assert.equal(view.partnerCards.length, 1);
  const card = view.partnerCards[0];
  assert.equal(card.partnerId, "blackhole");
  assert.equal(card.partnerName, "Blackhole");
  assert.equal(card.chains.length, 1);
  assert.equal(card.chains[0].stats.totalOrders, 2);
  assert.equal(card.chains[0].stats.totalUsd, 20);
  assert.deepEqual(view.orders, allOrders.slice(0, 2));
  assert.deepEqual(
    view.partnerOptions.filter((option) => option.value === "blackhole"),
    [{ value: "blackhole", label: "Blackhole" }],
  );
  assert.ok(
    !view.partnerOptions.some((option) =>
      option.value.includes(legacyBlackholeAdapter.toLowerCase()),
    ),
  );
});

test("an old known deployment retains a named zero-activity partner in a recent period", () => {
  const view = buildSpotOverview({
    allOrders: [
      networkOrder(legacyBlackholeAdapter, 43114, "2026-09-01T10:00:00Z"),
    ],
    config: blackholeConfig,
    updatedAt,
    days: 7,
    partnerIds: ["blackhole"],
  });

  assert.equal(view.orders.length, 0);
  assert.deepEqual(
    view.partnerCards.map((card) => [card.partnerId, card.partnerName]),
    [["blackhole", "Blackhole"]],
  );
  assert.equal(view.partnerCards[0].chains[0].chainId, 43114);
  assert.equal(view.partnerCards[0].chains[0].stats.totalOrders, 0);
  assert.equal(view.partnerCards[0].chains[0].stats.totalUsd, 0);
});

test("reused addresses resolve per network while orders without a network stay unidentified", () => {
  const sharedAdapter = "0x2222222222222222222222222222222222222222";
  const reusedConfig = {
    "137": {
      dex: { quick: { adapter: sharedAdapter } },
      partnerAdapters: [
        {
          partnerId: "quickswap",
          partnerName: "Quickswap",
          adapter: sharedAdapter,
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
  const allOrders = [
    networkOrder(sharedAdapter, 137),
    networkOrder(sharedAdapter, 42161),
    networkOrder(sharedAdapter, undefined),
  ];
  const view = buildSpotOverview({
    allOrders,
    config: reusedConfig,
    updatedAt,
  });
  const quick = view.partnerCards.find(
    (card) => card.partnerId === "quickswap",
  )!;
  const ramses = view.partnerCards.find((card) => card.partnerId === "ramses")!;
  const unidentified = view.partnerCards.find(
    (card) => card.partnerId === `adapter-${sharedAdapter}`,
  )!;

  assert.equal(quick.partnerName, "Quickswap");
  assert.equal(quick.chains[0].chainId, 137);
  assert.deepEqual(quick.chains[0].orders, [allOrders[0]]);
  assert.equal(ramses.partnerName, "Ramses");
  assert.equal(ramses.chains[0].chainId, 42161);
  assert.deepEqual(ramses.chains[0].orders, [allOrders[1]]);
  assert.match(unidentified.partnerName, /^Unidentified app \(/);
  assert.equal(unidentified.chains[0].chainId, 0);
  assert.deepEqual(unidentified.chains[0].orders, [allOrders[2]]);
  assert.equal(
    view.stats.reduce((sum, stat) => sum + stat.totalOrders, 0),
    3,
  );

  for (const [id, expectedOrder] of [
    ["quick", allOrders[0]],
    ["ramses", allOrders[1]],
  ] as const) {
    const filtered = buildSpotOverview({
      allOrders,
      config: reusedConfig,
      updatedAt,
      partnerIds: [id],
    });
    assert.deepEqual(filtered.orders, [expectedOrder]);
  }
});

test("an adapter absent from configuration and service metadata stays unidentified", () => {
  const unknownOrder = networkOrder(
    "0x9999999999999999999999999999999999999999",
    43114,
  );
  const view = buildSpotOverview({
    allOrders: [unknownOrder],
    config: blackholeConfig,
    updatedAt,
  });
  const unknown = view.partnerCards.find((card) =>
    card.partnerId.startsWith("adapter-"),
  )!;

  assert.equal(
    unknown.partnerId,
    `adapter-${unknownOrder.exchangeAdapter.toLowerCase()}`,
  );
  assert.equal(unknown.partnerName, "Unidentified app (0x9999…9999)");
  assert.deepEqual(unknown.chains[0].orders, [unknownOrder]);
  assert.ok(
    view.partnerCards
      .filter((card) => card.partnerId !== unknown.partnerId)
      .every((card) => card.chains.every((chain) => !chain.orders.length)),
  );
});
